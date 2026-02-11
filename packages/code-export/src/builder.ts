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
  safeJoin,
} from "./utils.js";
import type {
  BuildFile,
  BuildResult,
  BuildVirtualFilesResult,
  TailwindOptions,
} from "./types.js";

const DEFAULT_BUILD_TIMEOUT_MS = 30_000;
const DEFAULT_CHILD_MAX_OLD_SPACE_MB = 512;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const USE_SYNC_EXTERNAL_STORE_VIRTUAL_NS = "frontend-forge-use-sync-external-store";

const USE_SYNC_EXTERNAL_STORE_MODULES: Record<string, string> = {
  "use-sync-external-store": `
import shimApi, { useSyncExternalStore } from "use-sync-external-store/shim";
export { useSyncExternalStore };
export default shimApi;
`,
  "use-sync-external-store/index.js": `
import shimApi, { useSyncExternalStore } from "use-sync-external-store/shim";
export { useSyncExternalStore };
export default shimApi;
`,
  "use-sync-external-store/with-selector": `
import withSelectorApi, { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";
export { useSyncExternalStoreWithSelector };
export default withSelectorApi;
`,
  "use-sync-external-store/with-selector.js": `
import withSelectorApi, { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";
export { useSyncExternalStoreWithSelector };
export default withSelectorApi;
`,
  "use-sync-external-store/shim": `
import * as React from "react";

function is(x, y) {
  return (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y);
}

function checkIfSnapshotChanged(inst) {
  const latestGetSnapshot = inst.getSnapshot;
  const prevValue = inst.value;
  try {
    const nextValue = latestGetSnapshot();
    return !is(prevValue, nextValue);
  } catch {
    return true;
  }
}

function useSyncExternalStoreClient(subscribe, getSnapshot) {
  const value = getSnapshot();
  const tuple = React.useState({
    inst: { value, getSnapshot },
  });
  const inst = tuple[0].inst;
  const forceUpdate = tuple[1];

  React.useLayoutEffect(() => {
    inst.value = value;
    inst.getSnapshot = getSnapshot;
    if (checkIfSnapshotChanged(inst)) {
      forceUpdate({ inst });
    }
  }, [subscribe, value, getSnapshot]);

  React.useEffect(() => {
    if (checkIfSnapshotChanged(inst)) {
      forceUpdate({ inst });
    }
    return subscribe(() => {
      if (checkIfSnapshotChanged(inst)) {
        forceUpdate({ inst });
      }
    });
  }, [subscribe]);

  React.useDebugValue(value);
  return value;
}

function useSyncExternalStoreServer(_subscribe, getSnapshot) {
  return getSnapshot();
}

const isServer =
  typeof window === "undefined" ||
  typeof window.document === "undefined" ||
  typeof window.document.createElement === "undefined";

export const useSyncExternalStore =
  typeof React.useSyncExternalStore === "function"
    ? React.useSyncExternalStore
    : isServer
      ? useSyncExternalStoreServer
      : useSyncExternalStoreClient;

const shimApi = { useSyncExternalStore };
export default shimApi;
`,
  "use-sync-external-store/shim/index.js": `
import shimApi, { useSyncExternalStore } from "use-sync-external-store/shim";
export { useSyncExternalStore };
export default shimApi;
`,
  "use-sync-external-store/shim/with-selector": `
import * as React from "react";
import { useSyncExternalStore } from "use-sync-external-store/shim";

function is(x, y) {
  return (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y);
}

export function useSyncExternalStoreWithSelector(
  subscribe,
  getSnapshot,
  getServerSnapshot,
  selector,
  isEqual
) {
  const instRef = React.useRef(null);
  if (instRef.current === null) {
    instRef.current = { hasValue: false, value: null };
  }
  const inst = instRef.current;

  const memoized = React.useMemo(() => {
    let hasMemo = false;
    let memoizedSnapshot;
    let memoizedSelection;
    const maybeGetServerSnapshot =
      getServerSnapshot === undefined ? null : getServerSnapshot;

    const memoizedSelector = (nextSnapshot) => {
      if (!hasMemo) {
        hasMemo = true;
        memoizedSnapshot = nextSnapshot;
        const nextSelection = selector(nextSnapshot);
        if (isEqual !== undefined && inst.hasValue) {
          const currentSelection = inst.value;
          if (isEqual(currentSelection, nextSelection)) {
            memoizedSelection = currentSelection;
            return currentSelection;
          }
        }
        memoizedSelection = nextSelection;
        return nextSelection;
      }

      const currentSelection = memoizedSelection;
      if (is(memoizedSnapshot, nextSnapshot)) {
        return currentSelection;
      }

      const nextSelection = selector(nextSnapshot);
      if (isEqual !== undefined && isEqual(currentSelection, nextSelection)) {
        memoizedSnapshot = nextSnapshot;
        return currentSelection;
      }

      memoizedSnapshot = nextSnapshot;
      memoizedSelection = nextSelection;
      return nextSelection;
    };

    const getSnapshotWithSelector = () => memoizedSelector(getSnapshot());
    const getServerSnapshotWithSelector =
      maybeGetServerSnapshot === null
        ? undefined
        : () => memoizedSelector(maybeGetServerSnapshot());

    return [getSnapshotWithSelector, getServerSnapshotWithSelector];
  }, [getSnapshot, getServerSnapshot, selector, isEqual]);

  const value = useSyncExternalStore(subscribe, memoized[0], memoized[1]);
  React.useEffect(() => {
    inst.hasValue = true;
    inst.value = value;
  }, [value]);

  React.useDebugValue(value);
  return value;
}

const withSelectorApi = { useSyncExternalStoreWithSelector };
export default withSelectorApi;
`,
  "use-sync-external-store/shim/with-selector.js": `
import withSelectorApi, { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";
export { useSyncExternalStoreWithSelector };
export default withSelectorApi;
`
};

function useSyncExternalStorePlugin(): esbuild.Plugin {
  return {
    name: "frontend-forge-use-sync-external-store-plugin",
    setup(build) {
      build.onResolve({ filter: /^use-sync-external-store(\/.*)?$/ }, (args) => {
        if (!(args.path in USE_SYNC_EXTERNAL_STORE_MODULES)) return null;
        return {
          path: args.path,
          namespace: USE_SYNC_EXTERNAL_STORE_VIRTUAL_NS
        };
      });

      build.onLoad({ filter: /.*/, namespace: USE_SYNC_EXTERNAL_STORE_VIRTUAL_NS }, (args) => {
        const contents = USE_SYNC_EXTERNAL_STORE_MODULES[args.path];
        if (typeof contents !== "string") return null;
        return {
          contents,
          loader: "js"
        };
      });
    }
  };
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timeout after ${ms}ms`)),
      ms,
    );
    promise.then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
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
    rootNodeModules,
  }: {
    cwd: string;
    timeoutMs: number;
    childMaxOldSpaceMb: number;
    vendorNodeModules: string | null;
    rootNodeModules: string | null;
  },
): Promise<string> {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    NODE_OPTIONS: `--max-old-space-size=${childMaxOldSpaceMb}`,
    NODE_PATH: [process.env.NODE_PATH, vendorNodeModules, rootNodeModules]
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
  workDir: providedWorkDir,
}: BuildOnceOptions): Promise<BuildResult> {
  const start = nowMs();
  const workDir = providedWorkDir ?? mkWorkDir();
  const shouldCleanup = !providedWorkDir;

  const vendorCandidates = [
    vendorNodeModules,
    path.resolve(process.cwd(), "packages", "vendor", "node_modules"),
    path.resolve(process.cwd(), "vendor", "node_modules"),
    path.resolve(process.cwd(), "..", "vendor", "node_modules"),
    path.resolve(
      process.cwd(),
      "..",
      "..",
      "packages",
      "vendor",
      "node_modules",
    ),
    path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "packages",
      "vendor",
      "node_modules",
    ),
  ].filter(Boolean) as string[];
  const resolvedVendorNodeModules = findFirstExisting(vendorCandidates);

  const rootCandidates = [
    rootNodeModules,
    path.resolve(process.cwd(), "node_modules"),
    path.resolve(process.cwd(), "..", "node_modules"),
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
        plugins: [useSyncExternalStorePlugin()],
        nodePaths: [resolvedVendorNodeModules, resolvedRootNodeModules].filter(
          Boolean,
        ) as string[],
        resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".css", ".json"],
        logLevel: "silent",
        metafile: false,
        loader: {
          ".json": "json",
        },
      }),
      buildTimeoutMs,
      "esbuild build",
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
        // `ignoreDynamic` is accepted by SWC runtime even though the types omit it.
        module: {
          type: "systemjs",
          // @ts-expect-error Missing in @swc/core types
          ignoreDynamic: true,
        },
      }),
      buildTimeoutMs,
      "swc transform",
    );

    fs.writeFileSync(outJs, swcResult.code, "utf8");
    let jsCode = swcResult.code;

    // Final minify; avoid stripping literal newlines from string/template contents.
    const minified = await esbuild.transform(jsCode, {
      loader: "js",
      minify: true,
      legalComments: "none",
    });
    jsCode = minified.code.trim();

    let cssCode: string | null = null;
    const tailwindOpts: TailwindOptions =
      tailwind && typeof tailwind === "object" ? tailwind : { enabled: false };
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
          rootNodeModules: resolvedRootNodeModules,
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
      js: { path: "index.js", content: jsCode },
      css: cssCode ? { path: "style.css", content: cssCode } : null,
      meta: { buildMs },
    };
  } finally {
    if (shouldCleanup) {
      rmWorkDir(workDir);
    }
  }
}

export async function buildVirtualFiles(
  options: BuildOnceOptions,
): Promise<BuildVirtualFilesResult> {
  const result = await buildOnce(options);
  const files = [result.js, ...(result.css ? [result.css] : [])];
  return { files, meta: result.meta };
}
