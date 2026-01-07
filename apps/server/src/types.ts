import type { BuildFile, BuildOutputs, BuildResult, TailwindOptions } from "@frontend-forge/code-export";

export type { BuildFile, BuildOutputs, BuildResult, TailwindOptions };

export type BuildRequestBody = {
  files?: BuildFile[];
  entry?: string;
  externals?: string[];
  tailwind?: TailwindOptions;
};

export type CacheValue = {
  outputs: BuildOutputs;
  meta: { buildMs: number; queuedMs: number };
};

export type CacheHit = "memory" | "disk" | null;

export type BuildKeyInput = {
  files: BuildFile[];
  entry: string;
  externals: string[];
  tailwind: TailwindOptions;
};
