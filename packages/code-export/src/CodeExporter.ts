import {
  ALLOWED_FILE_RE,
  computeBuildKey,
  nowMs,
  safeJoin
} from "./utils.js";
import { buildOnce } from "./builder.js";
import type {
  BuildOutputs,
  BuildVirtualFilesResult,
  TailwindOptions,
  VirtualFile
} from "./types.js";

export type MaybePromise<T> = T | Promise<T>;

export type CodeExporterCacheHit = string | null;

export type CodeExporterCacheResult<V> = {
  hit: CodeExporterCacheHit;
  value: V | null;
};

export type CodeExporterCache<V> = {
  get: (key: string) => MaybePromise<CodeExporterCacheResult<V>>;
  set: (key: string, value: V) => MaybePromise<void>;
};

export type CodeExporterScheduler = <T>(fn: () => Promise<T>) => Promise<T>;

export class CodeExporterError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = "CodeExporterError";
    this.statusCode = statusCode;
  }
}

export function isCodeExporterError(err: unknown): err is CodeExporterError {
  return err instanceof CodeExporterError;
}

export type CodeExporterCacheValue = {
  outputs: BuildOutputs;
  meta: { buildMs: number; queuedMs: number };
};

export type CodeExporterRequestBody = {
  files?: VirtualFile[];
  entry?: string;
  externals?: string[];
  tailwind?: TailwindOptions;
};

export type CodeExporterResult = {
  cacheHit: CodeExporterCacheHit;
  key: string;
  outputs: BuildOutputs;
  files: VirtualFile[];
  meta: { buildMs: number; queuedMs: number };
};

export type CodeExporterBuildOptions = {
  entry?: string;
  externals?: string[];
  tailwind?: TailwindOptions;
  buildTimeoutMs?: number;
  childMaxOldSpaceMb?: number;
  vendorNodeModules?: string;
  rootNodeModules?: string;
};

export type CodeExporterOptions = {
  cache?: CodeExporterCache<CodeExporterCacheValue>;
  schedule?: CodeExporterScheduler;
  now?: () => number;
  buildTimeoutMs?: number;
  childMaxOldSpaceMb?: number;
  vendorNodeModules?: string;
  rootNodeModules?: string;
  defaultEntry?: string;
  defaultExternals?: string[];
  defaultTailwind?: TailwindOptions;
};

export interface CodeExporterLike {
  buildVirtualFiles(
    files: VirtualFile[],
    options?: CodeExporterBuildOptions
  ): MaybePromise<CodeExporterResult | BuildVirtualFilesResult | VirtualFile[]>;
}

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

function normalizeTailwind(value: unknown, fallback: TailwindOptions): TailwindOptions {
  if (!value || typeof value !== "object") return fallback;
  const obj = value as { enabled?: unknown; input?: unknown; config?: unknown };
  return {
    enabled: Boolean(obj.enabled),
    input: typeof obj.input === "string" && obj.input.length > 0 ? obj.input : "src/index.css",
    config: typeof obj.config === "string" && obj.config.length > 0 ? obj.config : null
  };
}

function validateFiles(value: unknown): VirtualFile[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new CodeExporterError("files must be a non-empty array", 400);
  }

  return value.map((f) => {
    const obj = f as { path?: unknown; content?: unknown } | null;
    if (!obj || typeof obj.path !== "string") {
      throw new CodeExporterError("each file must have a string path", 400);
    }
    if (typeof obj.content !== "string") {
      throw new CodeExporterError("each file must have a string content", 400);
    }
    if (!ALLOWED_FILE_RE.test(obj.path)) {
      throw new CodeExporterError(`unsupported file type: ${obj.path}`, 400);
    }
    try {
      safeJoin(".", obj.path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new CodeExporterError(msg, 400);
    }
    return { path: obj.path, content: obj.content };
  });
}

function pickEntry(
  entry: string | undefined,
  defaultEntry: string,
  files: VirtualFile[]
): string {
  if (typeof entry === "string" && entry.length > 0) return entry;
  if (files.some((f) => f.path === defaultEntry)) return defaultEntry;
  if (files.some((f) => f.path === "src/index.tsx")) return "src/index.tsx";
  return "src/index.ts";
}

function normalizeOutputs(outputs: BuildOutputs): BuildOutputs {
  const normalizeFile = (file: VirtualFile | null): VirtualFile | null => {
    if (!file) return null;
    const record = file as VirtualFile & { filename?: string };
    const pathValue = record.path ?? record.filename;
    if (!pathValue) {
      throw new CodeExporterError("cached output is missing path", 500);
    }
    return { path: pathValue, content: String(record.content ?? "") };
  };

  return {
    js: normalizeFile(outputs.js) as VirtualFile,
    css: normalizeFile(outputs.css)
  };
}

export class CodeExporter {
  private cache: CodeExporterCache<CodeExporterCacheValue> | null;
  private schedule: CodeExporterScheduler;
  private now: () => number;
  private buildTimeoutMs: number;
  private childMaxOldSpaceMb: number | undefined;
  private vendorNodeModules: string | undefined;
  private rootNodeModules: string | undefined;
  private defaultEntry: string;
  private defaultExternals: string[];
  private defaultTailwind: TailwindOptions;

  constructor(options: CodeExporterOptions = {}) {
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

  async build(body: unknown): Promise<CodeExporterResult> {
    const obj = (body ?? {}) as CodeExporterRequestBody;
    const files = validateFiles(obj.files);
    const entry = pickEntry(obj.entry, this.defaultEntry, files);
    const externals = asStringArray(obj.externals) ?? this.defaultExternals;
    const tailwind = normalizeTailwind(obj.tailwind, this.defaultTailwind);
    return this.buildFromInput({ files, entry, externals, tailwind });
  }

  async buildVirtualFiles(
    files: VirtualFile[],
    options: CodeExporterBuildOptions = {}
  ): Promise<CodeExporterResult> {
    const validated = validateFiles(files);
    const entry = pickEntry(options.entry, this.defaultEntry, validated);
    const externals = Array.isArray(options.externals) ? options.externals : this.defaultExternals;
    const tailwind = normalizeTailwind(options.tailwind, this.defaultTailwind);
    return this.buildFromInput({
      files: validated,
      entry,
      externals,
      tailwind,
      buildTimeoutMs: options.buildTimeoutMs,
      childMaxOldSpaceMb: options.childMaxOldSpaceMb,
      vendorNodeModules: options.vendorNodeModules,
      rootNodeModules: options.rootNodeModules
    });
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
    files: VirtualFile[];
    entry: string;
    externals: string[];
    tailwind: TailwindOptions;
    buildTimeoutMs?: number;
    childMaxOldSpaceMb?: number;
    vendorNodeModules?: string;
    rootNodeModules?: string;
  }): Promise<CodeExporterResult> {
    const key = computeBuildKey({ files, entry, externals, tailwind });

    if (this.cache) {
      const cached = await this.cache.get(key);
      if (cached.hit && cached.value) {
        const outputs = normalizeOutputs(cached.value.outputs);
        const filesOut = [outputs.js, ...(outputs.css ? [outputs.css] : [])];
        return {
          cacheHit: cached.hit,
          key,
          outputs,
          files: filesOut,
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
    const filesOut = [outputs.js, ...(outputs.css ? [outputs.css] : [])];
    const cacheValue: CodeExporterCacheValue = {
      outputs,
      meta: { buildMs: result.meta.buildMs, queuedMs: jobMs }
    };

    if (this.cache) {
      await this.cache.set(key, cacheValue);
    }

    return { cacheHit: null, key, outputs, files: filesOut, meta: cacheValue.meta };
  }
}
