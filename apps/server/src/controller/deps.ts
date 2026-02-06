import type { ForgeCore } from '@frontend-forge/forge-core';
import type { K8sConfig } from '../runtimeConfig.js';

export type ControllerDeps = {
  forge: ForgeCore;
  k8s?: K8sConfig;
};
