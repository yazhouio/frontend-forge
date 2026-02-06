import type { ExtensionManifest } from "@frontend-forge/forge-core";
import type { CrdTableSceneConfig } from "./defineCrdTableScene.js";
import type { IframeSceneConfig } from "./defineIframeScene.js";
import type { WorkspaceTableSceneConfig } from "./defineWorkspaceTableScene.js";
import type { ProjectSceneConfig } from "../types.js";
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

const buildComponentsTree = (
  type: SceneType | "CrdTableScene" | "WorkspaceTableScene" | "IframeScene",
  config: SceneConfig,
) => {
  if (type === "workspaceCrdTable" || type === "WorkspaceTableScene") {
    return defineWorkspaceTableScene(config as WorkspaceTableSceneConfig);
  }
  if (type === "iframe" || type === "IframeScene") {
    return defineIframeScene(config as IframeSceneConfig);
  }
  return defineCrdTableScene(config as CrdTableSceneConfig);
};

export const createExtensionManifest = (
  type: SceneType,
  config: SceneConfig,
): ExtensionManifest => {
  const componentsTree = buildComponentsTree(type, config);
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

function resolveConfigPageId(config: SceneConfig): string | null {
  if ("page" in config && config.page && typeof config.page === "object") {
    const id = (config.page as { id?: unknown }).id;
    if (typeof id === "string" && id.trim().length > 0) {
      return id.trim();
    }
  }
  return null;
}

export const createExtensionManifestFromProjectConfig = (
  projectConfig: ProjectSceneConfig,
  options?: { displayName?: string; description?: string },
): ExtensionManifest => {
  const pages = new Map<string, { id: string; entryComponent: string; componentsTree: unknown }>();

  for (const scene of projectConfig.scenes) {
    const pageId = scene.meta.route.pageId;
    const configPageId = resolveConfigPageId(scene.config as SceneConfig);
    if (configPageId && configPageId !== pageId) {
      throw new Error(`scene page id mismatch: route=${pageId}, config=${configPageId}`);
    }
    if (pages.has(pageId)) {
      continue;
    }
    pages.set(pageId, {
      id: pageId,
      entryComponent: pageId,
      componentsTree: buildComponentsTree(scene.type, scene.config as SceneConfig),
    });
  }

  return {
    version: "1.0",
    name: projectConfig.projectName,
    displayName: options?.displayName,
    description: options?.description,
    routes: projectConfig.scenes.map((scene) => ({ ...scene.meta.route })),
    menus: projectConfig.scenes
      .map((scene) => scene.meta.menu)
      .filter((menu): menu is NonNullable<typeof menu> => Boolean(menu))
      .map((menu) => ({ ...menu })),
    locales: [],
    pages: Array.from(pages.values()),
    build: {
      target: "kubesphere-extension",
      moduleName: projectConfig.projectName,
      systemjs: true,
    },
  };
};
