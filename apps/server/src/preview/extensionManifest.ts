import type { ExtensionManifest } from "@frontend-forge/forge-core";
import type { CrdTableSceneConfig } from "./defineCrdTableScene.js";
import type { IframeSceneConfig } from "./defineIframeScene.js";
import type { WorkspaceTableSceneConfig } from "./defineWorkspaceTableScene.js";
import { defineCrdTableScene } from "./defineCrdTableScene.js";
import { defineIframeScene } from "./defineIframeScene.js";
import { defineWorkspaceTableScene } from "./defineWorkspaceTableScene.js";

type SceneType = "crdTable" | "workspaceCrdTable" | "iframe";
type SceneConfig =
  | CrdTableSceneConfig
  | WorkspaceTableSceneConfig
  | IframeSceneConfig;

const resolveDisplayName = (scene: SceneConfig) =>
  scene.meta.title ?? scene.meta.name ?? scene.meta.id;

export const createExtensionManifest = (
  type: SceneType,
  config: SceneConfig,
): ExtensionManifest => {
  const componentsTree =
    type === "workspaceCrdTable"
      ? defineWorkspaceTableScene(config as WorkspaceTableSceneConfig)
      : type === "iframe"
        ? defineIframeScene(config as IframeSceneConfig)
        : defineCrdTableScene(config as CrdTableSceneConfig);
  const pageId = config.meta.id;
  const displayName = resolveDisplayName(config);

  return {
    version: "1.0",
    name: config.meta.id,
    displayName,
    routes: [
      {
        path: config.meta.path,
        pageId,
      },
    ],
    menus: [
      {
        parent: "root",
        name: config.meta.id,
        title: displayName,
      },
    ],
    locales: [],
    pages: [
      {
        id: pageId,
        entryComponent: pageId,
        componentsTree,
      },
    ],
    build: {
      target: "kubesphere-extension",
      moduleName: config.meta.id,
      systemjs: true,
    },
  };
};
