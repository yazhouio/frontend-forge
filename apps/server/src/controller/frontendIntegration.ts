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
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    resourceVersion?: string;
    [key: string]: unknown;
  };
  spec?: {
    raw?: string;
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

const FRONTEND_INTEGRATION_ANNOTATION = "frontend-forge.io/frontendintegration";
const FRONTEND_INTEGRATION_MANIFEST_ANNOTATION = "frontend-forge.io/manifest";
const SCENE_CONFIG_ANNOTATION = "scene.frontend-forge.io/config";
const FRONTEND_INTEGRATION_LABEL_RESOURCE_KEY = "frontend-forge.io/resource";
const FRONTEND_INTEGRATION_LABEL_RESOURCE_VALUE = "frontendintegration";
const FRONTEND_INTEGRATION_LABEL_NAME_KEY = "frontend-forge.io/name";
const FRONTEND_INTEGRATION_LABEL_TYPE_KEY = "frontend-forge.io/type";
const FRONTEND_INTEGRATION_LABEL_ENABLED_KEY = "frontend-forge.io/enabled";

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

async function buildFrontendIntegrationJsBundle(
  forge: ForgeCore,
  integration: FrontendIntegration,
  existing?: JsBundle,
): Promise<JsBundle> {
  const labels = buildFrontendIntegrationLabels(integration);
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
  const rawBundle = Buffer.from(bundle.content, "utf8").toString("base64");

  const rawAnnotations = existing?.metadata?.annotations ?? {};
  const annotations = {
    ...rawAnnotations,
    [FRONTEND_INTEGRATION_ANNOTATION]: JSON.stringify(integration),
    [SCENE_CONFIG_ANNOTATION]: JSON.stringify(sceneConfig),
    [FRONTEND_INTEGRATION_MANIFEST_ANNOTATION]: manifestJson,
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
    typeof base.spec === "object" && base.spec ? { ...base.spec } : {};
  spec.raw = rawBundle;
  base.spec = spec;
  base.status = {
    state: "Available",
  };
  return base;
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

  return {
    apiVersion:
      typeof obj.apiVersion === "string" && obj.apiVersion.trim().length > 0
        ? obj.apiVersion.trim()
        : "frontend-forge.io/v1alpha1",
    kind:
      typeof obj.kind === "string" && obj.kind.trim().length > 0
        ? obj.kind.trim()
        : "FrontendIntegration",
    metadata: { ...metaObj, name },
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

  return {
    ...jsBundle,
    metadata: {
      ...(jsBundle.metadata ?? {}),
      labels,
      annotations,
    },
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
        const { enabled, type, name } = parseFrontendIntegrationListQuery(
          req.query ?? {},
        );
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
        const path = `/kapis/extensions.kubesphere.io/v1alpha1/jsbundles/${encodeURIComponent(name)}`;
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
        const jsBundle = await buildFrontendIntegrationJsBundle(
          forge,
          integration,
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
        const deletePath = `/kapis/extensions.kubesphere.io/v1alpha1/jsbundles/${encodeURIComponent(name)}`;
        const deleteUrl = joinUrl(k8sConfig.server, deletePath);
        try {
          await requestJson(deleteUrl, { token, method: "DELETE" });
        } catch (err) {
          if (!isForgeError(err) || err.statusCode !== 404) {
            throw err;
          }
        }

        const jsBundle = await buildFrontendIntegrationJsBundle(
          forge,
          integration,
        );
        const createUrl = joinUrl(
          k8sConfig.server,
          "/kapis/extensions.kubesphere.io/v1alpha1/jsbundles",
        );
        await requestJson(createUrl, { token, method: "POST", body: jsBundle });
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
        const path = `/kapis/extensions.kubesphere.io/v1alpha1/jsbundles/${encodeURIComponent(name)}`;
        const url = joinUrl(k8sConfig.server, path);
        await requestJson(url, { token, method: "DELETE" });
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
        const path = `/kapis/extensions.kubesphere.io/v1alpha1/jsbundles/${encodeURIComponent(name)}`;
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
