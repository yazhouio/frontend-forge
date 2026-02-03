import type { ExtensionManifest } from "@frontend-forge/forge-core";
import type { CrdTableSceneConfig } from "./preview/defineCrdTableScene.js";
import type { WorkspaceTableSceneConfig } from "./preview/defineWorkspaceTableScene.js";
import type {
  BuildOutputs,
  CodeExporterRequestBody,
  TailwindOptions,
  VirtualFile
} from "@frontend-forge/forge-core/advanced";

export type { BuildOutputs, ExtensionManifest, TailwindOptions, VirtualFile };

export type BuildRequestBody = CodeExporterRequestBody;

export type PageSchemaRequestBody = {
  pageSchema?: unknown;
};

export type ProjectManifestRequestBody = {
  manifest?: ExtensionManifest;
};

export type ProjectJsBundleParams = {
  name: string;
  extensionName: string;
  namespace?: string;
  cluster?: string;
};

export type ProjectJsBundleRequestBody = ProjectManifestRequestBody & {
  params: ProjectJsBundleParams;
};

export type SceneType = "crdTable" | "workspaceCrdTable";
export type SceneConfig = CrdTableSceneConfig | WorkspaceTableSceneConfig;

export type SceneRequestBody = {
  type: SceneType;
  config: SceneConfig;
};

export type SceneJsBundleRequestBody = {
  params: ProjectJsBundleParams;
  scene?: SceneRequestBody;
} & Partial<SceneRequestBody>;

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
