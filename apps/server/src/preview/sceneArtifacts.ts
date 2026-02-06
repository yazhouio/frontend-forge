import type { ForgeCore, VirtualFile } from "@frontend-forge/forge-core";
import type { CrdTableSceneConfig } from "./defineCrdTableScene.js";
import type { IframeSceneConfig } from "./defineIframeScene.js";
import type { WorkspaceTableSceneConfig } from "./defineWorkspaceTableScene.js";
import { createExtensionManifest } from "./extensionManifest.js";

export type SceneType = "crdTable" | "workspaceCrdTable" | "iframe";
export type SceneConfig =
  | CrdTableSceneConfig
  | WorkspaceTableSceneConfig
  | IframeSceneConfig;

const manifestFromScene = (type: SceneType, config: SceneConfig) =>
  createExtensionManifest(type, config);

export const generateSceneProjectFiles = async (
  forge: ForgeCore,
  type: SceneType,
  config: SceneConfig,
): Promise<VirtualFile[]> => {
  const manifest = manifestFromScene(type, config);
  return forge.generateProjectFiles(manifest);
};

export const buildSceneProjectFiles = async (
  forge: ForgeCore,
  type: SceneType,
  config: SceneConfig,
): Promise<VirtualFile[]> => {
  const manifest = manifestFromScene(type, config);
  return forge.buildProject(manifest, { build: true });
};

export const buildSceneProjectTarGz = async (
  forge: ForgeCore,
  type: SceneType,
  config: SceneConfig,
): Promise<Buffer> => {
  const files = await buildSceneProjectFiles(forge, type, config);
  return forge.emitToTarGz(files);
};
