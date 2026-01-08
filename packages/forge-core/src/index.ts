import {
  ALLOWED_FILE_RE,
  buildOnce,
  computeBuildKey,
  nowMs,
  safeJoin,
  type BuildOutputs,
  type BuildFile,
  type BuildResult,
  type TailwindOptions
} from "@frontend-forge/code-export";
import {
  generateProjectFiles,
  type ComponentGenerator,
  type ExtensionManifest,
  type PageMeta,
  type ProjectFile,
  type VirtualFile
} from "@frontend-forge/project-generator";

export type MaybePromise<T> = T | Promise<T>;

export type ForgeCacheHit = string | null;

export type ForgeCacheResult<V> = {
  hit: ForgeCacheHit;
  value: V | null;
};

export type ForgeCache<V> = {
  get: (key: string) => MaybePromise<ForgeCacheResult<V>>;
  set: (key: string, value: V) => MaybePromise<void>;
};

export type ForgeScheduler = <T>(fn: () => Promise<T>) => Promise<T>;

export class ForgeError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = "ForgeError";
    this.statusCode = statusCode;
  }
}

export function isForgeError(err: unknown): err is ForgeError {
  return err instanceof ForgeError;
}

export type ForgeBuildCacheValue = {
  outputs: BuildOutputs;
  meta: { buildMs: number; queuedMs: number };
};

export type ForgeBuildRequestBody = {
  files?: BuildFile[];
  entry?: string;
  externals?: string[];
  tailwind?: TailwindOptions;
};

export type ForgeBuildResponse = {
  cacheHit: ForgeCacheHit;
  key: string;
  outputs: BuildOutputs;
  meta: { buildMs: number; queuedMs: number };
};

export type ForgeBuildOptions = {
  entry?: string;
  externals?: string[];
  tailwind?: TailwindOptions;
  buildTimeoutMs?: number;
  childMaxOldSpaceMb?: number;
  vendorNodeModules?: string;
  rootNodeModules?: string;
};

export type ForgeFileWriter = {
  writeFile: (filePath: string, content: string) => MaybePromise<void>;
};

export type ForgeProjectOptions = {
  manifest: ExtensionManifest;
  componentGenerator: ComponentGenerator;
  onLog?: (msg: string) => void;
  writer?: ForgeFileWriter;
  build?: ForgeBuildOptions | false;
};

export type ForgeResult = {
  files: VirtualFile[];
  warnings: string[];
  build?: ForgeBuildResponse | null;
};

export type ForgeCoreOptions = {
  cache?: ForgeCache<ForgeBuildCacheValue>;
  schedule?: ForgeScheduler;
  now?: () => number;
  buildTimeoutMs?: number;
  childMaxOldSpaceMb?: number;
  vendorNodeModules?: string;
  rootNodeModules?: string;
  defaultEntry?: string;
  defaultExternals?: string[];
  defaultTailwind?: TailwindOptions;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} after ${ms}ms`)), ms);
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

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value.map((v) => String(v));
}

function validateFiles(value: unknown): BuildFile[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ForgeError("files must be a non-empty array", 400);
  }

  return value.map((f) => {
    const obj = f as { path?: unknown; content?: unknown } | null;
    if (!obj || typeof obj.path !== "string") {
      throw new ForgeError("each file must have a string path", 400);
    }
    if (typeof obj.content !== "string") {
      throw new ForgeError("each file must have a string content", 400);
    }
    if (!ALLOWED_FILE_RE.test(obj.path)) {
      throw new ForgeError(`unsupported file type: ${obj.path}`, 400);
    }
    try {
      safeJoin(".", obj.path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ForgeError(msg, 400);
    }
    return { path: obj.path, content: obj.content };
  });
}

function normalizeTailwind(value: unknown, fallback: TailwindOptions): TailwindOptions {
  if (!value || typeof value !== "object") return fallback;
  const obj = value as { enabled?: unknown; input?: unknown; config?: unknown };
  return {
    enabled: Boolean(obj.enabled),
    input: typeof obj.input === "string" && obj.input.length > 0 ? obj.input : "src/index.css",
    config: typeof obj.config === "string" && obj.config.length > 0 ? obj.config : null
  };
}

function pickEntry(
  entry: string | undefined,
  defaultEntry: string,
  files: BuildFile[]
): string {
  if (typeof entry === "string" && entry.length > 0) return entry;
  if (files.some((f) => f.path === defaultEntry)) return defaultEntry;
  if (files.some((f) => f.path === "src/index.tsx")) return "src/index.tsx";
  return "src/index.ts";
}

export class ForgeCore {
  private cache: ForgeCache<ForgeBuildCacheValue> | null;
  private schedule: ForgeScheduler;
  private now: () => number;
  private buildTimeoutMs: number;
  private childMaxOldSpaceMb: number | undefined;
  private vendorNodeModules: string | undefined;
  private rootNodeModules: string | undefined;
  private defaultEntry: string;
  private defaultExternals: string[];
  private defaultTailwind: TailwindOptions;

  constructor(options: ForgeCoreOptions = {}) {
    this.cache = options.cache ?? null;
    this.schedule = options.schedule ?? (async (fn) => fn());
    this.now = options.now ?? nowMs;
    this.buildTimeoutMs = options.buildTimeoutMs ?? 30_000;
    this.childMaxOldSpaceMb = options.childMaxOldSpaceMb;
    this.vendorNodeModules = options.vendorNodeModules;
    this.rootNodeModules = options.rootNodeModules;
    this.defaultEntry = options.defaultEntry ?? "src/index.tsx";
    this.defaultExternals = Array.isArray(options.defaultExternals) ? options.defaultExternals : [];
    this.defaultTailwind = options.defaultTailwind ?? { enabled: false };
  }

  async build(body: unknown): Promise<ForgeBuildResponse> {
    const obj = (body ?? {}) as ForgeBuildRequestBody;
    const files = validateFiles(obj.files);
    const entry = pickEntry(obj.entry, this.defaultEntry, files);
    const externals = asStringArray(obj.externals) ?? this.defaultExternals;
    const tailwind = normalizeTailwind(obj.tailwind, this.defaultTailwind);
    return this.buildFromInput({ files, entry, externals, tailwind });
  }

  async forgeProject(options: ForgeProjectOptions): Promise<ForgeResult> {
    const project = generateProjectFiles(options.manifest, {
      componentGenerator: options.componentGenerator,
      onLog: options.onLog,
      build: false,
      archive: false
    });

    if (options.writer) {
      for (const f of project.files) {
        await options.writer.writeFile(f.path, f.content);
      }
    }

    let build: ForgeBuildResponse | null = null;
    if (options.build) {
      const entry = pickEntry(options.build.entry, "src/index.ts", project.files);
      const externals = Array.isArray(options.build.externals) ? options.build.externals : [];
      const tailwind = options.build.tailwind ?? { enabled: false };
      const files: BuildFile[] = project.files
        .filter((f) => ALLOWED_FILE_RE.test(f.path))
        .map((f) => ({ path: f.path, content: f.content }));

      build = await this.buildFromInput({
        files,
        entry,
        externals,
        tailwind,
        buildTimeoutMs: options.build.buildTimeoutMs,
        childMaxOldSpaceMb: options.build.childMaxOldSpaceMb,
        vendorNodeModules: options.build.vendorNodeModules,
        rootNodeModules: options.build.rootNodeModules
      });
    }

    return { files: project.files, warnings: project.warnings, build };
  }

  private async buildFromInput({
    files,
    entry,
    externals,
    tailwind,
    buildTimeoutMs,
    childMaxOldSpaceMb,
    vendorNodeModules,
    rootNodeModules
  }: {
    files: BuildFile[];
    entry: string;
    externals: string[];
    tailwind: TailwindOptions;
    buildTimeoutMs?: number;
    childMaxOldSpaceMb?: number;
    vendorNodeModules?: string;
    rootNodeModules?: string;
  }): Promise<ForgeBuildResponse> {
    const key = computeBuildKey({ files, entry, externals, tailwind });

    if (this.cache) {
      const cached = await this.cache.get(key);
      if (cached.hit && cached.value) {
        return {
          cacheHit: cached.hit,
          key,
          outputs: cached.value.outputs,
          meta: { ...cached.value.meta, buildMs: 0 }
        };
      }
    }

    const jobStart = this.now();
    const result = await this.schedule(async () => {
      const timeout = buildTimeoutMs ?? this.buildTimeoutMs;
      return withTimeout(
        buildOnce({
          files,
          entry,
          externals,
          tailwind,
          buildTimeoutMs: timeout,
          childMaxOldSpaceMb: childMaxOldSpaceMb ?? this.childMaxOldSpaceMb,
          vendorNodeModules: vendorNodeModules ?? this.vendorNodeModules,
          rootNodeModules: rootNodeModules ?? this.rootNodeModules
        }),
        timeout,
        "build timeout"
      );
    });

    const jobMs = Math.max(0, Math.round(this.now() - jobStart));
    const outputs: BuildOutputs = { js: result.js, css: result.css };
    const cacheValue: ForgeBuildCacheValue = {
      outputs,
      meta: { buildMs: result.meta.buildMs, queuedMs: jobMs }
    };

    if (this.cache) {
      await this.cache.set(key, cacheValue);
    }

    return { cacheHit: null, key, outputs, meta: cacheValue.meta };
  }
}

export async function forgeProject(options: ForgeProjectOptions): Promise<ForgeResult> {
  const core = new ForgeCore({});
  return core.forgeProject(options);
}

// Re-exports for consumers (server/cli) to avoid depending on underlying packages directly.
export {
  ALLOWED_FILE_RE,
  buildOnce,
  computeBuildKey,
  nowMs,
  safeJoin,
  generateProjectFiles
};
export type {
  BuildFile,
  BuildOutputs,
  BuildResult,
  TailwindOptions,
  ComponentGenerator,
  ExtensionManifest,
  PageMeta,
  ProjectFile,
  VirtualFile
};
