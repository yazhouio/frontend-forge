export type VirtualFile = {
  path: string;
  content: string;
};

export type BuildFile = VirtualFile;

export type TailwindOptions = {
  enabled: boolean;
  input?: string;
  config?: string | null;
};

export type BuildOutputs = {
  js: VirtualFile;
  css: VirtualFile | null;
};

export type BuildResult = {
  js: BuildOutputs["js"];
  css: BuildOutputs["css"];
  meta: { buildMs: number };
};

export type BuildVirtualFilesResult = {
  files: VirtualFile[];
  meta: { buildMs: number };
};

export type BuildKeyInput = {
  files: BuildFile[];
  entry: string;
  externals: string[];
  tailwind: TailwindOptions;
};
