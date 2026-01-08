import type {
  BuildOutputs,
  CodeExporterRequestBody,
  TailwindOptions,
  VirtualFile
} from "@frontend-forge/forge-core/advanced";

export type { BuildOutputs, TailwindOptions, VirtualFile };

export type BuildRequestBody = CodeExporterRequestBody;

export type CacheValue = {
  outputs: BuildOutputs;
  meta: { buildMs: number; queuedMs: number };
};

export type CacheHit = "memory" | "disk" | null;

export type BuildKeyInput = {
  files: VirtualFile[];
  entry: string;
  externals: string[];
  tailwind: TailwindOptions;
};
