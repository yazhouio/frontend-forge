import type { ExtensionManifest } from "@frontend-forge/forge-core";
import type {
  CrdTableColumn,
  CrdTableSceneConfig,
} from "./preview/defineCrdTableScene.js";
import type { IframeSceneConfig } from "./preview/defineIframeScene.js";
import type { WorkspaceTableSceneConfig } from "./preview/defineWorkspaceTableScene.js";
import type {
  BuildOutputs,
  CodeExporterRequestBody,
  TailwindOptions,
  VirtualFile,
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

export type SceneType = "crdTable" | "workspaceCrdTable" | "iframe";
export type SceneConfig =
  | CrdTableSceneConfig
  | WorkspaceTableSceneConfig
  | IframeSceneConfig;

export type SceneRequestBody = {
  type: SceneType;
  config: SceneConfig;
};

export type SceneJsBundleRequestBody = {
  params: ProjectJsBundleParams;
  scene?: SceneRequestBody;
} & Partial<SceneRequestBody>;

export type RouteMeta = {
  path: string;
  pageId: string;
};

export type MenuMeta = {
  parent: string;
  name: string;
  title: string;
  icon?: string;
  order?: number;
  clusterModule?: string;
};

export type SceneMeta = {
  route: RouteMeta;
  menu?: MenuMeta;
};

export type ProjectSceneType =
  | "CrdTableScene"
  | "WorkspaceTableScene"
  | "IframeScene";

export type SceneDescriptor = {
  type: ProjectSceneType;
  meta: SceneMeta;
  config: SceneConfig;
};

export type ProjectSceneConfig = {
  projectName: string;
  enabled: boolean;
  scenes: SceneDescriptor[];
};

export type FrontendIntegrationMetadata = {
  name: string;
  creationTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  [key: string]: unknown;
};

export type FrontendIntegrationSpec = {
  displayName?: string;
  enabled?: boolean;
  integration:
    | {
        type: "crd";
        crd: {
          names: {
            kind?: string;
            plural: string;
          };
          group: string;
          version: string;
          scope: "Namespaced" | "Cluster";
          columns?: CrdTableColumn[];
          authKey?: string;
        };
      }
    | {
        type: "iframe";
        iframe: {
          url: string;
        };
      };
  routing: {
    path: string;
  };
  menu?: {
    name?: string;
    placements?: string[];
  };
};

export type FrontendIntegration = {
  apiVersion?: string;
  kind?: string;
  metadata: FrontendIntegrationMetadata;
  spec: FrontendIntegrationSpec;
};

export type FrontendIntegrationListQuery = {
  enabled?: string;
  type?: string;
  name?: string;
  sortBy?: string;
  ascending?: string;
};

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
