export type BuildFile = {
  path: string;
  content: string;
};

export type TailwindOptions = {
  enabled: boolean;
  input?: string;
  config?: string | null;
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

export type BuildKeyInput = {
  files: BuildFile[];
  entry: string;
  externals: string[];
  tailwind: TailwindOptions;
};
