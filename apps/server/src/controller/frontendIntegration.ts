import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ForgeError,
  isForgeError,
  type ForgeCore,
} from "@frontend-forge/forge-core";
import type {
  FrontendIntegration,
  FrontendIntegrationListQuery,
  ProjectSceneConfig,
} from "../types.js";
import type { K8sConfig } from "../runtimeConfig.js";
import { joinUrl, requestJson } from "../k8sClient.js";
import { handleKnownError } from "./errors.js";
import {
  buildExtensionManifestFromProjectConfig,
  buildProjectSceneConfigFromCr,
} from "./frontendIntegrationTransform.js";
import { requireAuthToken, requireK8sConfig } from "./k8s.js";
import {
  normalizeLabelValue,
  parseFrontendIntegrationListQuery,
  requireEnabledFlag,
  requireFrontendIntegration,
  requireNonEmptyString,
} from "./validation.js";

type JsBundle = {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    name?: string;
    creationTimestamp?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    resourceVersion?: string;
    [key: string]: unknown;
  };
  spec?: {
    rawFrom?: {
      configMapKeyRef?: {
        namespace?: string;
        name?: string;
        key?: string;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  status?: unknown;
  [key: string]: unknown;
};

type JsBundleList = {
  items?: JsBundle[];
  totalItems?: number;
  [key: string]: unknown;
};

type ConfigMap = {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    resourceVersion?: string;
    [key: string]: unknown;
  };
  data?: Record<string, string>;
  [key: string]: unknown;
};

type FrontendIntegrationBuildOutput = {
  sceneConfig: ProjectSceneConfig;
  manifestJson: string;
  rawBundle: string;
};

const FRONTEND_INTEGRATION_ANNOTATION = "frontend-forge.io/frontendintegration";
const FRONTEND_INTEGRATION_MANIFEST_ANNOTATION = "frontend-forge.io/manifest";
const SCENE_CONFIG_ANNOTATION = "scene.frontend-forge.io/config";
const FRONTEND_INTEGRATION_LABEL_RESOURCE_KEY = "frontend-forge.io/resource";
const FRONTEND_INTEGRATION_LABEL_RESOURCE_VALUE = "frontendintegration";
const FRONTEND_INTEGRATION_LABEL_NAME_KEY = "frontend-forge.io/name";
const FRONTEND_INTEGRATION_LABEL_TYPE_KEY = "frontend-forge.io/type";
const FRONTEND_INTEGRATION_LABEL_ENABLED_KEY = "frontend-forge.io/enabled";
const FRONTEND_INTEGRATION_CONFIG_MAP_NAMESPACE =
  "extension-frontend-forge-config";
const FRONTEND_INTEGRATION_CONFIG_MAP_KEY = "index.js";

function buildFrontendIntegrationConfigMapName(
  integrationName: string,
): string {
  return `${integrationName}-config`;
}

function buildFrontendIntegrationConfigMapPath(
  integrationName: string,
): string {
  return `/api/v1/namespaces/${encodeURIComponent(FRONTEND_INTEGRATION_CONFIG_MAP_NAMESPACE)}/configmaps/${encodeURIComponent(buildFrontendIntegrationConfigMapName(integrationName))}`;
}

function buildFrontendIntegrationConfigMapCollectionPath(): string {
  return `/api/v1/namespaces/${encodeURIComponent(FRONTEND_INTEGRATION_CONFIG_MAP_NAMESPACE)}/configmaps`;
}

function buildFrontendIntegrationJsBundlePath(name: string): string {
  return `/kapis/extensions.kubesphere.io/v1alpha1/jsbundles/${encodeURIComponent(name)}`;
}

function buildFrontendIntegrationDistLink(name: string): string {
  return `/dist/${name}/index.js`;
}

function buildFrontendIntegrationLabels(
  integration: FrontendIntegration,
): Record<string, string> {
  const enabled = integration.spec.enabled ?? true;
  const type = integration.spec.integration.type;
  return {
    [FRONTEND_INTEGRATION_LABEL_RESOURCE_KEY]:
      FRONTEND_INTEGRATION_LABEL_RESOURCE_VALUE,
    [FRONTEND_INTEGRATION_LABEL_ENABLED_KEY]: enabled ? "true" : "false",
    [FRONTEND_INTEGRATION_LABEL_TYPE_KEY]: type,
    [FRONTEND_INTEGRATION_LABEL_NAME_KEY]: normalizeLabelValue(
      integration.metadata.name,
      "metadata.name",
    ),
  };
}

async function buildFrontendIntegrationBuildOutput(
  forge: ForgeCore,
  integration: FrontendIntegration,
): Promise<FrontendIntegrationBuildOutput> {
  const sceneConfig = buildProjectSceneConfigFromCr(integration);
  const manifest = buildExtensionManifestFromProjectConfig(sceneConfig, {
    displayName:
      integration.spec.displayName ??
      integration.spec.menu?.name ??
      integration.metadata.name,
  });
  const manifestJson = JSON.stringify(manifest);
  if (manifestJson.length > 200_000) {
    throw new ForgeError("manifest is too large to store in annotations", 400);
  }
  const files = await forge.buildProject(manifest, { build: true });
  const bundle = files.find(
    (file) =>
      file &&
      typeof file === "object" &&
      file.path === "index.js" &&
      typeof file.content === "string",
  );
  if (!bundle) {
    throw new ForgeError("build output is missing index.js", 500);
  }
  const rawBundle = bundle.content;

  return { sceneConfig, manifestJson, rawBundle };
}

function buildFrontendIntegrationConfigMap(
  integration: FrontendIntegration,
  buildOutput: FrontendIntegrationBuildOutput,
  existing?: ConfigMap,
): ConfigMap {
  const labels = buildFrontendIntegrationLabels(integration);
  const mergedLabels = { ...(existing?.metadata?.labels ?? {}), ...labels };
  const metadata = {
    ...(existing?.metadata ?? {}),
    name: buildFrontendIntegrationConfigMapName(integration.metadata.name),
    namespace: FRONTEND_INTEGRATION_CONFIG_MAP_NAMESPACE,
    labels: mergedLabels,
  };

  const base: ConfigMap = existing
    ? { ...existing }
    : { apiVersion: "v1", kind: "ConfigMap" };
  if (!base.apiVersion) base.apiVersion = "v1";
  if (!base.kind) base.kind = "ConfigMap";
  base.metadata = metadata;
  base.data = {
    [FRONTEND_INTEGRATION_CONFIG_MAP_KEY]: buildOutput.rawBundle,
  };
  return base;
}

function buildFrontendIntegrationJsBundle(
  integration: FrontendIntegration,
  buildOutput: FrontendIntegrationBuildOutput,
  existing?: JsBundle,
): JsBundle {
  const labels = buildFrontendIntegrationLabels(integration);
  const rawAnnotations = existing?.metadata?.annotations ?? {};
  const annotations = {
    ...rawAnnotations,
    [FRONTEND_INTEGRATION_ANNOTATION]: JSON.stringify(integration),
    [SCENE_CONFIG_ANNOTATION]: JSON.stringify(buildOutput.sceneConfig),
    [FRONTEND_INTEGRATION_MANIFEST_ANNOTATION]: buildOutput.manifestJson,
  };
  const mergedLabels = { ...(existing?.metadata?.labels ?? {}), ...labels };

  const metadata = {
    ...(existing?.metadata ?? {}),
    name: integration.metadata.name,
    labels: mergedLabels,
    annotations,
  };

  const base: JsBundle = existing
    ? { ...existing }
    : { apiVersion: "extensions.kubesphere.io/v1alpha1", kind: "JSBundle" };
  if (!base.apiVersion) base.apiVersion = "extensions.kubesphere.io/v1alpha1";
  if (!base.kind) base.kind = "JSBundle";
  base.metadata = metadata;

  const spec =
    typeof base.spec === "object" && base.spec
      ? { ...(base.spec as Record<string, unknown>) }
      : {};
  delete spec.raw;
  spec.rawFrom = {
    configMapKeyRef: {
      namespace: FRONTEND_INTEGRATION_CONFIG_MAP_NAMESPACE,
      name: buildFrontendIntegrationConfigMapName(integration.metadata.name),
      key: FRONTEND_INTEGRATION_CONFIG_MAP_KEY,
    },
  };
  base.spec = spec;
  const status =
    typeof base.status === "object" && base.status
      ? { ...(base.status as Record<string, unknown>) }
      : {};
  status.link = buildFrontendIntegrationDistLink(integration.metadata.name);
  status.state = "Available";
  base.status = status;
  return base;
}

async function deleteResourceIgnoreNotFound(url: string, token: string) {
  try {
    await requestJson(url, { token, method: "DELETE" });
  } catch (err) {
    if (!isForgeError(err) || err.statusCode !== 404) {
      throw err;
    }
  }
}

async function upsertFrontendIntegrationConfigMap(args: {
  k8sConfig: K8sConfig;
  token: string;
  integration: FrontendIntegration;
  buildOutput: FrontendIntegrationBuildOutput;
}) {
  const { k8sConfig, token, integration, buildOutput } = args;
  const createUrl = joinUrl(
    k8sConfig.server,
    buildFrontendIntegrationConfigMapCollectionPath(),
  );
  const configMap = buildFrontendIntegrationConfigMap(integration, buildOutput);
  try {
    await requestJson(createUrl, { token, method: "POST", body: configMap });
    return;
  } catch (err) {
    if (!isForgeError(err) || err.statusCode !== 409) {
      throw err;
    }
  }

  const itemUrl = joinUrl(
    k8sConfig.server,
    buildFrontendIntegrationConfigMapPath(integration.metadata.name),
  );
  const existing = await requestJson(itemUrl, { token, method: "GET" });
  const patched = buildFrontendIntegrationConfigMap(
    integration,
    buildOutput,
    existing.body as ConfigMap,
  );
  await requestJson(itemUrl, { token, method: "PUT", body: patched });
}

async function updateFrontendIntegrationConfigMap(args: {
  k8sConfig: K8sConfig;
  token: string;
  integration: FrontendIntegration;
  buildOutput: FrontendIntegrationBuildOutput;
}) {
  const { k8sConfig, token, integration, buildOutput } = args;
  const itemUrl = joinUrl(
    k8sConfig.server,
    buildFrontendIntegrationConfigMapPath(integration.metadata.name),
  );
  const existing = await requestJson(itemUrl, { token, method: "GET" });
  const patched = buildFrontendIntegrationConfigMap(
    integration,
    buildOutput,
    existing.body as ConfigMap,
  );
  await requestJson(itemUrl, { token, method: "PUT", body: patched });
}

async function deleteFrontendIntegrationConfigMapIgnoreNotFound(args: {
  k8sConfig: K8sConfig;
  token: string;
  integrationName: string;
}) {
  const { k8sConfig, token, integrationName } = args;
  const configMapUrl = joinUrl(
    k8sConfig.server,
    buildFrontendIntegrationConfigMapPath(integrationName),
  );
  await deleteResourceIgnoreNotFound(configMapUrl, token);
}

function extractFrontendIntegration(
  jsBundle: JsBundle,
): FrontendIntegration | null {
  const annotations = jsBundle.metadata?.annotations;
  const raw = annotations?.[FRONTEND_INTEGRATION_ANNOTATION];
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const obj = parsed as Record<string, unknown>;
  if (!obj.spec || typeof obj.spec !== "object") {
    return null;
  }
  const rawMeta = obj.metadata;
  const metaObj =
    rawMeta && typeof rawMeta === "object"
      ? (rawMeta as Record<string, unknown>)
      : {};
  const name =
    typeof metaObj.name === "string" && metaObj.name.trim().length > 0
      ? metaObj.name
      : jsBundle.metadata?.name;
  if (!name) return null;
  const creationTimestamp =
    typeof jsBundle.metadata?.creationTimestamp === "string" &&
    jsBundle.metadata.creationTimestamp.trim().length > 0
      ? jsBundle.metadata.creationTimestamp
      : undefined;
  const metadata = {
    ...metaObj,
    name,
    ...(creationTimestamp ? { creationTimestamp } : {}),
  };

  return {
    apiVersion:
      typeof obj.apiVersion === "string" && obj.apiVersion.trim().length > 0
        ? obj.apiVersion.trim()
        : "frontend-forge.io/v1alpha1",
    kind:
      typeof obj.kind === "string" && obj.kind.trim().length > 0
        ? obj.kind.trim()
        : "FrontendIntegration",
    metadata,
    spec: obj.spec as FrontendIntegration["spec"],
  };
}

function parseProjectSceneConfig(raw: string): ProjectSceneConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ForgeError("scene config annotation is invalid JSON", 500);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new ForgeError("scene config annotation is invalid", 500);
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.projectName !== "string" || !Array.isArray(obj.scenes)) {
    throw new ForgeError("scene config annotation is invalid", 500);
  }
  const enabled = typeof obj.enabled === "boolean" ? obj.enabled : true;
  return {
    ...(obj as unknown as ProjectSceneConfig),
    projectName: obj.projectName,
    enabled,
    scenes: obj.scenes as ProjectSceneConfig["scenes"],
  };
}

function parseFrontendIntegrationAnnotation(raw: string): FrontendIntegration {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ForgeError("frontendIntegration annotation is invalid JSON", 500);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new ForgeError("frontendIntegration annotation is invalid", 500);
  }
  const obj = parsed as Record<string, unknown>;
  if (!obj.spec || typeof obj.spec !== "object") {
    throw new ForgeError("frontendIntegration annotation is invalid", 500);
  }
  return obj as FrontendIntegration;
}

function withEnabledOverridden(jsBundle: JsBundle, enabled: boolean): JsBundle {
  const labels = { ...(jsBundle.metadata?.labels ?? {}) };
  labels[FRONTEND_INTEGRATION_LABEL_ENABLED_KEY] = enabled ? "true" : "false";

  if (
    labels[FRONTEND_INTEGRATION_LABEL_RESOURCE_KEY] !==
    FRONTEND_INTEGRATION_LABEL_RESOURCE_VALUE
  ) {
    throw new ForgeError("frontendIntegration jsbundle not found", 404);
  }

  const annotations = { ...(jsBundle.metadata?.annotations ?? {}) };
  const rawSceneConfig = annotations[SCENE_CONFIG_ANNOTATION];
  if (
    typeof rawSceneConfig !== "string" ||
    rawSceneConfig.trim().length === 0
  ) {
    throw new ForgeError("scene config annotation is missing", 400);
  }
  const sceneConfig = parseProjectSceneConfig(rawSceneConfig);
  annotations[SCENE_CONFIG_ANNOTATION] = JSON.stringify({
    ...sceneConfig,
    enabled,
  });

  const rawIntegration = annotations[FRONTEND_INTEGRATION_ANNOTATION];
  if (
    typeof rawIntegration !== "string" ||
    rawIntegration.trim().length === 0
  ) {
    throw new ForgeError("frontendIntegration annotation is missing", 400);
  }
  const integration = parseFrontendIntegrationAnnotation(rawIntegration);
  annotations[FRONTEND_INTEGRATION_ANNOTATION] = JSON.stringify({
    ...integration,
    spec: {
      ...integration.spec,
      enabled,
    },
  });
  const status =
    typeof jsBundle.status === "object" && jsBundle.status
      ? { ...(jsBundle.status as Record<string, unknown>) }
      : {};
  status.state = enabled ? "Available" : "Disable";

  return {
    ...jsBundle,
    metadata: {
      ...(jsBundle.metadata ?? {}),
      labels,
      annotations,
    },
    status,
  };
}

export function createFrontendIntegrationHandlers(deps: {
  forge: ForgeCore;
  k8s?: K8sConfig;
}) {
  const { forge, k8s } = deps;

  return {
    frontendIntegrationList: async (
      req: FastifyRequest<{ Querystring: FrontendIntegrationListQuery }>,
      reply: FastifyReply,
    ) => {
      try {
        const k8sConfig = requireK8sConfig(k8s);
        const token = requireAuthToken(req, k8sConfig);
        const { enabled, type, name, sortBy, ascending } =
          parseFrontendIntegrationListQuery(req.query ?? {});
        const selectors = [
          `${FRONTEND_INTEGRATION_LABEL_RESOURCE_KEY}=${FRONTEND_INTEGRATION_LABEL_RESOURCE_VALUE}`,
        ];
        if (enabled !== undefined) {
          selectors.push(
            `${FRONTEND_INTEGRATION_LABEL_ENABLED_KEY}=${enabled ? "true" : "false"}`,
          );
        }
        if (type) {
          selectors.push(`${FRONTEND_INTEGRATION_LABEL_TYPE_KEY}=${type}`);
        }
        if (name) {
          selectors.push(
            `${FRONTEND_INTEGRATION_LABEL_NAME_KEY}=${normalizeLabelValue(name, "name")}`,
          );
        }

        const params = new URLSearchParams();
        if (selectors.length > 0) {
          params.set("labelSelector", selectors.join(","));
        }
        if (sortBy !== undefined) {
          params.set("sortBy", sortBy);
        }
        if (ascending !== undefined) {
          params.set("ascending", ascending);
        }
        const suffix = params.toString();
        const path = `/kapis/extensions.kubesphere.io/v1alpha1/jsbundles${suffix ? `?${suffix}` : ""}`;
        const url = joinUrl(k8sConfig.server, path);
        const result = await requestJson(url, { token, method: "GET" });
        const body = result.body as JsBundleList;
        const items = Array.isArray(body?.items) ? body.items : [];
        const integrations = items
          .map((item) => extractFrontendIntegration(item))
          .filter((item): item is FrontendIntegration => Boolean(item));
        return {
          ok: true,
          items: integrations,
          totalItems: integrations.length,
        };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    frontendIntegrationGet: async (
      req: FastifyRequest<{ Params: { name: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const name = requireNonEmptyString(req.params?.name, "name");
        const k8sConfig = requireK8sConfig(k8s);
        const token = requireAuthToken(req, k8sConfig);
        const path = buildFrontendIntegrationJsBundlePath(name);
        const url = joinUrl(k8sConfig.server, path);
        const result = await requestJson(url, { token, method: "GET" });
        const integration = extractFrontendIntegration(result.body as JsBundle);
        if (!integration) {
          throw new ForgeError("frontendIntegration not found", 404);
        }
        return { ok: true, item: integration };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    frontendIntegrationCreate: async (
      req: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const integration = requireFrontendIntegration(req.body);
        const k8sConfig = requireK8sConfig(k8s);
        const token = requireAuthToken(req, k8sConfig);
        const buildOutput = await buildFrontendIntegrationBuildOutput(
          forge,
          integration,
        );
        await upsertFrontendIntegrationConfigMap({
          k8sConfig,
          token,
          integration,
          buildOutput,
        });
        const jsBundle = buildFrontendIntegrationJsBundle(
          integration,
          buildOutput,
        );
        const url = joinUrl(
          k8sConfig.server,
          "/kapis/extensions.kubesphere.io/v1alpha1/jsbundles",
        );
        await requestJson(url, { token, method: "POST", body: jsBundle });
        return { ok: true, item: integration };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    frontendIntegrationUpdate: async (
      req: FastifyRequest<{ Params: { name: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const name = requireNonEmptyString(req.params?.name, "name");
        const integration = requireFrontendIntegration(req.body, name);
        if (integration.metadata.name !== name) {
          throw new ForgeError("metadata.name must match path parameter", 400);
        }
        const k8sConfig = requireK8sConfig(k8s);
        const token = requireAuthToken(req, k8sConfig);
        const path = buildFrontendIntegrationJsBundlePath(name);
        const url = joinUrl(k8sConfig.server, path);
        const existing = await requestJson(url, { token, method: "GET" });
        const buildOutput = await buildFrontendIntegrationBuildOutput(
          forge,
          integration,
        );
        await updateFrontendIntegrationConfigMap({
          k8sConfig,
          token,
          integration,
          buildOutput,
        });
        const patched = buildFrontendIntegrationJsBundle(
          integration,
          buildOutput,
          existing.body as JsBundle,
        );
        await requestJson(url, { token, method: "PUT", body: patched });
        return { ok: true, item: integration };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    frontendIntegrationDelete: async (
      req: FastifyRequest<{ Params: { name: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const name = requireNonEmptyString(req.params?.name, "name");
        const k8sConfig = requireK8sConfig(k8s);
        const token = requireAuthToken(req, k8sConfig);
        const path = buildFrontendIntegrationJsBundlePath(name);
        const url = joinUrl(k8sConfig.server, path);
        await requestJson(url, { token, method: "DELETE" });
        await deleteFrontendIntegrationConfigMapIgnoreNotFound({
          k8sConfig,
          token,
          integrationName: name,
        });
        return { ok: true };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    frontendIntegrationUpdateEnabled: async (
      req: FastifyRequest<{ Params: { name: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const name = requireNonEmptyString(req.params?.name, "name");
        const enabled = requireEnabledFlag(req.body);
        const k8sConfig = requireK8sConfig(k8s);
        const token = requireAuthToken(req, k8sConfig);
        const path = buildFrontendIntegrationJsBundlePath(name);
        const url = joinUrl(k8sConfig.server, path);
        const existing = await requestJson(url, { token, method: "GET" });
        const patched = withEnabledOverridden(
          existing.body as JsBundle,
          enabled,
        );
        await requestJson(url, { token, method: "PUT", body: patched });
        return { ok: true, name, enabled };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },
  };
}
