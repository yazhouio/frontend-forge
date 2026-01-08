import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as esbuild from "esbuild";
import { execa } from "execa";
import { transformFile } from "@swc/core";
import {
  binPath,
  findFirstExisting,
  mkWorkDir,
  nowMs,
  rmWorkDir,
  safeJoin
} from "./utils.js";
import type { BuildFile, BuildResult, BuildVirtualFilesResult, TailwindOptions } from "./types.js";

const DEFAULT_BUILD_TIMEOUT_MS = 30_000;
const DEFAULT_CHILD_MAX_OLD_SPACE_MB = 512;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
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
  {
    cwd,
    timeoutMs,
    childMaxOldSpaceMb,
    vendorNodeModules,
    rootNodeModules
  }: { cwd: string; timeoutMs: number; childMaxOldSpaceMb: number; vendorNodeModules: string | null; rootNodeModules: string | null }
): Promise<string> {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    NODE_OPTIONS: `--max-old-space-size=${childMaxOldSpaceMb}`,
    NODE_PATH: [process.env.NODE_PATH, vendorNodeModules, rootNodeModules].filter(Boolean).join(path.delimiter)
  };

  const subprocess = execa(cmd, args, {
    cwd,
    env,
    timeout: timeoutMs,
    killSignal: "SIGKILL"
  });

  const { stdout } = await subprocess;
  return stdout;
}

export type BuildOnceOptions = {
  files: BuildFile[];
  entry: string;
  externals: string[];
  tailwind?: TailwindOptions;
  buildTimeoutMs?: number;
  childMaxOldSpaceMb?: number;
  vendorNodeModules?: string;
  rootNodeModules?: string;
  workDir?: string;
};

export async function buildOnce({
  files,
  entry,
  externals,
  tailwind,
  buildTimeoutMs = DEFAULT_BUILD_TIMEOUT_MS,
  childMaxOldSpaceMb = DEFAULT_CHILD_MAX_OLD_SPACE_MB,
  vendorNodeModules,
  rootNodeModules,
  workDir: providedWorkDir
}: BuildOnceOptions): Promise<BuildResult> {
  const start = nowMs();
  const workDir = providedWorkDir ?? mkWorkDir();
  const shouldCleanup = !providedWorkDir;

  const vendorCandidates = [
    vendorNodeModules,
    path.resolve(process.cwd(), "packages", "vendor", "node_modules"),
    path.resolve(process.cwd(), "vendor", "node_modules"),
    path.resolve(process.cwd(), "..", "vendor", "node_modules"),
    path.resolve(process.cwd(), "..", "..", "packages", "vendor", "node_modules"),
    path.resolve(__dirname, "..", "..", "..", "packages", "vendor", "node_modules")
  ].filter(Boolean) as string[];
  const resolvedVendorNodeModules = findFirstExisting(vendorCandidates);

  const rootCandidates = [
    rootNodeModules,
    path.resolve(process.cwd(), "node_modules"),
    path.resolve(process.cwd(), "..", "node_modules")
  ].filter(Boolean) as string[];
  const resolvedRootNodeModules = findFirstExisting(rootCandidates);

  const workNodeModules = path.join(workDir, "node_modules");
  const tmpDir = path.join(workDir, ".tmp");
  const distDir = path.join(workDir, "dist");
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(distDir, { recursive: true });

  try {
    // Expose vendor node_modules (fallback to root) to the temp workspace so tools can resolve deps
    if (!fs.existsSync(workNodeModules)) {
      const target = resolvedVendorNodeModules || resolvedRootNodeModules;
      if (target) {
        try {
          fs.symlinkSync(target, workNodeModules, "dir");
        } catch {
          // fallback silently if symlink is not permitted
        }
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
        nodePaths: [resolvedVendorNodeModules, resolvedRootNodeModules].filter(Boolean) as string[],
        resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".css", ".json"],
        logLevel: "silent",
        metafile: false,
        loader: {
          ".json": "json"
        }
      }),
      buildTimeoutMs,
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
          parser: { syntax: "ecmascript" }
        },
        // `ignoreDynamic` is accepted by SWC runtime even though the types omit it.
        module: {
          type: "systemjs",
          // @ts-expect-error Missing in @swc/core types
          ignoreDynamic: true
        }
      }),
      buildTimeoutMs,
      "swc transform"
    );

    fs.writeFileSync(outJs, swcResult.code, "utf8");
    let jsCode = swcResult.code;

    // Final minify to a single line
    const minified = await esbuild.transform(jsCode, {
      loader: "js",
      minify: true,
      legalComments: "none"
    });
    jsCode = minified.code.replace(/\n+/g, "").trim();

    let cssCode: string | null = null;
    const tailwindOpts: TailwindOptions = tailwind && typeof tailwind === "object" ? tailwind : { enabled: false };
    if (tailwindOpts.enabled) {
      const inputCss = tailwindOpts.input ?? "src/index.css";
      const configFile = tailwindOpts.config ?? null;

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
          timeoutMs: buildTimeoutMs,
          childMaxOldSpaceMb,
          vendorNodeModules: resolvedVendorNodeModules,
          rootNodeModules: resolvedRootNodeModules
        });
        cssCode = fs.readFileSync(outCss, "utf8");
      }
    }

    const forbidden: string[] = ["__webpack_require__", "__webpack_exports__", "webpackChunk", "import("];
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
      js: { path: "index.js", content: jsCode },
      css: cssCode ? { path: "style.css", content: cssCode } : null,
      meta: { buildMs }
    };
  } finally {
    if (shouldCleanup) {
      rmWorkDir(workDir);
    }
  }
}

export async function buildVirtualFiles(
  options: BuildOnceOptions
): Promise<BuildVirtualFilesResult> {
  const result = await buildOnce(options);
  const files = [result.js, ...(result.css ? [result.css] : [])];
  return { files, meta: result.meta };
}
