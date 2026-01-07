import fs from "fs";
import path from "path";
import * as esbuild from "esbuild";
import { execa } from "execa";
import { transformFile } from "@swc/core";
import { BUILD_TIMEOUT_MS, CHILD_MAX_OLD_SPACE_MB } from "./config.js";
import { safeJoin, mkWorkDir, rmWorkDir, binPath, nowMs } from "./utils.js";
import type { BuildFile, BuildResult, TailwindOptions } from "./types.js";

const ROOT_NODE_MODULES = path.resolve(process.cwd(), "node_modules");
const VENDOR_NODE_MODULES = path.resolve(
  process.cwd(),
  "vendor",
  "node_modules"
);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timeout after ${ms}ms`)),
      ms
    );
    promise.then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function runCmd(
  cmd: string,
  args: string[],
  { cwd, timeoutMs }: { cwd: string; timeoutMs: number }
): Promise<string> {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    NODE_OPTIONS: `--max-old-space-size=${CHILD_MAX_OLD_SPACE_MB}`,
    NODE_PATH: [process.env.NODE_PATH, VENDOR_NODE_MODULES, ROOT_NODE_MODULES]
      .filter(Boolean)
      .join(path.delimiter),
  };

  const subprocess = execa(cmd, args, {
    cwd,
    env,
    timeout: timeoutMs,
    killSignal: "SIGKILL",
  });

  const { stdout } = await subprocess;
  return stdout;
}

export async function buildOnce({
  files,
  entry,
  externals,
  tailwind,
}: {
  files: BuildFile[];
  entry: string;
  externals: string[];
  tailwind?: TailwindOptions;
}): Promise<BuildResult> {
  const start = nowMs();
  const workDir = mkWorkDir();
  const vendorNodeModules = VENDOR_NODE_MODULES;
  const rootNodeModules = ROOT_NODE_MODULES;
  const workNodeModules = path.join(workDir, "node_modules");

  const tmpDir = path.join(workDir, ".tmp");
  const distDir = path.join(workDir, "dist");
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(distDir, { recursive: true });

  try {
    // Expose vendor node_modules (fallback to root) to the temp workspace so tools can resolve deps
    if (!fs.existsSync(workNodeModules)) {
      const target = fs.existsSync(vendorNodeModules)
        ? vendorNodeModules
        : rootNodeModules;
      try {
        fs.symlinkSync(target, workNodeModules, "dir");
      } catch {
        // fallback silently if symlink is not permitted
      }
    }

    for (const f of files) {
      const full = safeJoin(workDir, f.path);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, String(f.content ?? ""), "utf8");
    }

    const entryFile = safeJoin(workDir, entry);
    if (!fs.existsSync(entryFile)) {
      throw new Error(`entry not found: ${entry}`);
    }

    const esbuildOut = path.join(tmpDir, "bundle.mjs");
    console.log('externals', externals)
    await withTimeout(
      esbuild.build({
        absWorkingDir: workDir,
        entryPoints: [entryFile],
        bundle: true,
        format: "esm",
        platform: "browser",
        minify: true,
        outfile: esbuildOut,
        target: ["chrome80", "firefox80", "safari13"],
        splitting: false,
        external: externals,
        plugins: [],
        nodePaths: [vendorNodeModules, rootNodeModules],
        resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".css", ".json"],
        logLevel: "silent",
        metafile: false,
        loader: {
          ".json": "json",
        },
      }),
      BUILD_TIMEOUT_MS,
      "esbuild build"
    );

    const outJs = path.join(distDir, "index.js");
    const swcResult = await withTimeout(
      transformFile(esbuildOut, {
        filename: esbuildOut,
        sourceMaps: false,
        minify: false,
        jsc: {
          target: "es2020",
          parser: { syntax: "ecmascript" },
        },
        module: {
          type: "systemjs",
          ignoreDynamic: true,
        },
      }),
      BUILD_TIMEOUT_MS,
      "swc transform"
    );

    fs.writeFileSync(outJs, swcResult.code, "utf8");
    let jsCode = swcResult.code;

    // Final minify to a single line
    const minified = await esbuild.transform(jsCode, {
      loader: "js",
      minify: true,
      legalComments: "none",
    });
    jsCode = minified.code.replace(/\n+/g, "").trim();

    let cssCode: string | null = null;
    if (tailwind?.enabled) {
      const inputCss = tailwind.input ?? "src/index.css";
      const configFile = tailwind.config ?? null;

      const inputCssFile = safeJoin(workDir, inputCss);
      if (fs.existsSync(inputCssFile)) {
        const outCss = path.join(distDir, "style.css");
        const twArgs = ["-i", inputCssFile, "-o", outCss, "--minify"];
        if (configFile) {
          const configAbs = safeJoin(workDir, configFile);
          if (fs.existsSync(configAbs)) {
            twArgs.push("-c", configAbs);
          }
        }

        // Run Tailwind from repo root so the CLI can resolve its own dependency tree
        await runCmd(binPath("tailwindcss"), twArgs, {
          cwd: process.cwd(),
          timeoutMs: BUILD_TIMEOUT_MS,
        });
        cssCode = fs.readFileSync(outCss, "utf8");
      }
    }

    const forbidden: string[] = [
      "__webpack_require__",
      "__webpack_exports__",
      "webpackChunk",
      "import(",
    ];
    for (const k of forbidden) {
      if (jsCode.includes(k)) {
        throw new Error(`illegal output: found forbidden token ${k}`);
      }
    }
    if (!jsCode.includes("System.register")) {
      throw new Error("illegal output: missing System.register");
    }

    const buildMs = Math.max(0, Math.round(nowMs() - start));
    return {
      js: { filename: "index.js", content: jsCode },
      css: cssCode ? { filename: "style.css", content: cssCode } : null,
      meta: { buildMs },
    };
  } finally {
    rmWorkDir(workDir);
  }
}
