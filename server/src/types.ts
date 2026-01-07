export type BuildFile = {
  path: string;
  content: string;
};

export type TailwindOptions = {
  enabled: boolean;
  input?: string;
  config?: string | null;
};

export type BuildRequestBody = {
  files?: BuildFile[];
  entry?: string;
  externals?: string[];
  tailwind?: TailwindOptions;
};

export type BuildOutputs = {
  js: { filename: string; content: string };
  css: { filename: string; content: string } | null;
};

export type BuildResult = {
  js: BuildOutputs["js"];
  css: BuildOutputs["css"];
  meta: { buildMs: number };
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
