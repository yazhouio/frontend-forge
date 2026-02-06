import { ForgeError, type ForgeCore } from "@frontend-forge/forge-core";
import type { CodeExporter } from "@frontend-forge/forge-core/advanced";
import type {
  ExtensionManifest,
  FrontendIntegration,
  FrontendIntegrationListQuery,
  PageSchemaRequestBody,
  ProjectJsBundleRequestBody,
  ProjectManifestRequestBody,
  SceneConfig,
  SceneRequestBody,
  SceneType,
} from "../types.js";
import { normalizeDns1123Label } from "../k8sClient.js";

export function requireExporter(forge: ForgeCore): CodeExporter {
  const exporter = forge.getCodeExporter();
  if (!exporter || typeof exporter !== "object") {
    throw new ForgeError("codeExporter is required", 500);
  }
  if (typeof (exporter as CodeExporter).build !== "function") {
    throw new ForgeError("codeExporter.build is required", 500);
  }
  return exporter as CodeExporter;
}

export function requirePageSchema(
  body: PageSchemaRequestBody | unknown,
): unknown {
  if (body && typeof body === "object" && "pageSchema" in body) {
    const wrapper = body as PageSchemaRequestBody;
    if (wrapper.pageSchema == null) {
      throw new ForgeError("pageSchema is required", 400);
    }
    return wrapper.pageSchema;
  }
  if (body == null) {
    throw new ForgeError("pageSchema is required", 400);
  }
  return body;
}

export function requireManifest(
  body: ProjectManifestRequestBody | unknown,
): ExtensionManifest {
  if (!body || typeof body !== "object") {
    throw new ForgeError("manifest is required", 400);
  }
  const wrapper = body as ProjectManifestRequestBody;
  const hasManifest = Object.prototype.hasOwnProperty.call(wrapper, "manifest");
  const manifest = hasManifest ? wrapper.manifest : body;
  if (!manifest || typeof manifest !== "object") {
    throw new ForgeError("manifest is required", 400);
  }
  return manifest as ExtensionManifest;
}

export function requireScene(body: SceneRequestBody | unknown): {
  type: SceneType;
  config: SceneConfig;
} {
  if (!body || typeof body !== "object") {
    throw new ForgeError("scene is required", 400);
  }
  const wrapper = body as { scene?: SceneRequestBody };
  const raw = Object.prototype.hasOwnProperty.call(wrapper, "scene")
    ? (wrapper.scene as SceneRequestBody)
    : (body as SceneRequestBody);
  if (
    raw.type !== "crdTable" &&
    raw.type !== "workspaceCrdTable" &&
    raw.type !== "iframe"
  ) {
    throw new ForgeError(
      'scene.type must be "crdTable", "workspaceCrdTable", or "iframe"',
      400,
    );
  }
  if (!raw.config || typeof raw.config !== "object") {
    throw new ForgeError("scene.config must be an object", 400);
  }
  return { type: raw.type, config: raw.config };
}

export function requireJsBundleParams(
  body: ProjectJsBundleRequestBody | unknown,
): {
  name: string;
  extensionName: string;
  namespace: string | null;
  cluster: string | null;
} {
  if (!body || typeof body !== "object") {
    throw new ForgeError("params is required", 400);
  }
  if (!("params" in body)) {
    throw new ForgeError("params is required", 400);
  }

  const params = (body as ProjectJsBundleRequestBody).params as unknown;
  if (!params || typeof params !== "object") {
    throw new ForgeError("params must be an object", 400);
  }

  const rawName = (params as { name?: unknown }).name;
  if (typeof rawName !== "string" || rawName.trim().length === 0) {
    throw new ForgeError("params.name is required", 400);
  }
  const name = normalizeDns1123Label(rawName.trim(), "name");

  const rawExtensionName = (params as { extensionName?: unknown })
    .extensionName;
  if (
    typeof rawExtensionName !== "string" ||
    rawExtensionName.trim().length === 0
  ) {
    throw new ForgeError("params.extensionName is required", 400);
  }
  const extensionName = normalizeDns1123Label(
    rawExtensionName.trim(),
    "extensionName",
  );

  const namespaceRaw = (params as { namespace?: unknown }).namespace;
  const namespace =
    typeof namespaceRaw === "string" && namespaceRaw.trim().length > 0
      ? normalizeDns1123Label(namespaceRaw.trim(), "namespace")
      : null;

  const clusterRaw = (params as { cluster?: unknown }).cluster;
  const cluster =
    typeof clusterRaw === "string" && clusterRaw.trim().length > 0
      ? normalizeDns1123Label(clusterRaw.trim(), "cluster")
      : null;

  return { name, extensionName, namespace, cluster };
}

export function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ForgeError(`${field} is required`, 400);
  }
  return value.trim();
}

export function requireEnabledFlag(body: unknown): boolean {
  if (!body || typeof body !== "object") {
    throw new ForgeError("enabled is required", 400);
  }
  const enabled = (body as { enabled?: unknown }).enabled;
  if (typeof enabled !== "boolean") {
    throw new ForgeError("enabled must be a boolean", 400);
  }
  return enabled;
}

export function normalizeLabelValue(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ForgeError(`${field} is required`, 400);
  }
  const replaced = trimmed.replace(/[^A-Za-z0-9._-]/g, "-");
  const stripped = replaced
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[^A-Za-z0-9]+$/, "");
  const sliced = stripped.slice(0, 63);
  if (!sliced) {
    throw new ForgeError(`${field} must be a valid label value`, 400);
  }
  return sliced;
}

export function requireFrontendIntegration(
  body: unknown,
  fallbackName?: string,
): FrontendIntegration {
  if (!body || typeof body !== "object") {
    throw new ForgeError("frontendIntegration is required", 400);
  }

  const raw = body as Record<string, unknown>;
  const rawMetadata = raw.metadata;
  const metadataObj =
    rawMetadata && typeof rawMetadata === "object"
      ? (rawMetadata as Record<string, unknown>)
      : {};
  const nameRaw = metadataObj.name ?? fallbackName;
  const name = requireNonEmptyString(nameRaw, "metadata.name");

  const rawSpec = raw.spec;
  if (!rawSpec || typeof rawSpec !== "object") {
    throw new ForgeError("spec is required", 400);
  }
  const specObj = rawSpec as Record<string, unknown>;

  const rawIntegration = specObj.integration;
  if (!rawIntegration || typeof rawIntegration !== "object") {
    throw new ForgeError("spec.integration is required", 400);
  }
  const integrationObj = rawIntegration as Record<string, unknown>;
  const integrationType = integrationObj.type;
  if (integrationType !== "crd" && integrationType !== "iframe") {
    throw new ForgeError(
      'spec.integration.type must be "crd" or "iframe"',
      400,
    );
  }

  if (integrationType === "crd") {
    const crd = integrationObj.crd;
    if (!crd || typeof crd !== "object") {
      throw new ForgeError("spec.integration.crd is required", 400);
    }
    const crdObj = crd as Record<string, unknown>;
    const resource = crdObj.resource;
    if (!resource || typeof resource !== "object") {
      throw new ForgeError("spec.integration.crd.resource is required", 400);
    }
    const resourceObj = resource as Record<string, unknown>;
    requireNonEmptyString(
      resourceObj.kind,
      "spec.integration.crd.resource.kind",
    );
    requireNonEmptyString(
      resourceObj.plural,
      "spec.integration.crd.resource.plural",
    );

    const api = crdObj.api;
    if (!api || typeof api !== "object") {
      throw new ForgeError("spec.integration.crd.api is required", 400);
    }
    const apiObj = api as Record<string, unknown>;
    requireNonEmptyString(apiObj.group, "spec.integration.crd.api.group");
    requireNonEmptyString(apiObj.version, "spec.integration.crd.api.version");

    const scope = crdObj.scope;
    if (typeof scope !== "string" || scope.trim().length === 0) {
      throw new ForgeError("spec.integration.crd.scope is required", 400);
    }
    if (scope !== "Namespaced" && scope !== "Cluster") {
      throw new ForgeError(
        'spec.integration.crd.scope must be "Namespaced" or "Cluster"',
        400,
      );
    }
  } else {
    const iframe = integrationObj.iframe;
    if (!iframe || typeof iframe !== "object") {
      throw new ForgeError("spec.integration.iframe is required", 400);
    }
    const iframeObj = iframe as Record<string, unknown>;
    requireNonEmptyString(iframeObj.src, "spec.integration.iframe.src");
  }

  const routing = specObj.routing;
  if (!routing || typeof routing !== "object") {
    throw new ForgeError("spec.routing is required", 400);
  }
  const routingObj = routing as Record<string, unknown>;
  const routingPath = requireNonEmptyString(
    routingObj.path,
    "spec.routing.path",
  );
  if (routingPath.startsWith("/")) {
    throw new ForgeError('spec.routing.path must not start with "/"', 400);
  }

  if (
    specObj.displayName !== undefined &&
    typeof specObj.displayName !== "string"
  ) {
    throw new ForgeError("spec.displayName must be a string", 400);
  }
  if (specObj.enabled !== undefined && typeof specObj.enabled !== "boolean") {
    throw new ForgeError("spec.enabled must be a boolean", 400);
  }

  if (specObj.menu !== undefined) {
    if (!specObj.menu || typeof specObj.menu !== "object") {
      throw new ForgeError("spec.menu must be an object", 400);
    }
    const menuObj = specObj.menu as Record<string, unknown>;
    if (menuObj.name !== undefined && typeof menuObj.name !== "string") {
      throw new ForgeError("spec.menu.name must be a string", 400);
    }
    if (menuObj.placements !== undefined) {
      if (
        !Array.isArray(menuObj.placements) ||
        menuObj.placements.some((v) => typeof v !== "string")
      ) {
        throw new ForgeError(
          "spec.menu.placements must be a string array",
          400,
        );
      }
      const invalid = menuObj.placements.find((placement) => {
        const value = String(placement).trim().toLowerCase();
        return (
          value !== "workspace" && value !== "cluster" && value !== "global"
        );
      });
      if (invalid !== undefined) {
        throw new ForgeError(
          "spec.menu.placements only supports workspace, cluster, global",
          400,
        );
      }
    }
  }

  if (integrationType === "crd") {
    const placements =
      specObj.menu && typeof specObj.menu === "object"
        ? (specObj.menu as { placements?: unknown }).placements
        : undefined;
    if (!Array.isArray(placements) || placements.length === 0) {
      throw new ForgeError(
        "spec.menu.placements is required for crd integration",
        400,
      );
    }
  }

  const apiVersionRaw = raw.apiVersion;
  const kindRaw = raw.kind;

  return {
    apiVersion:
      typeof apiVersionRaw === "string" && apiVersionRaw.trim().length > 0
        ? apiVersionRaw.trim()
        : "frontend-forge.io/v1alpha1",
    kind:
      typeof kindRaw === "string" && kindRaw.trim().length > 0
        ? kindRaw.trim()
        : "FrontendIntegration",
    metadata: { ...metadataObj, name },
    spec: {
      ...(specObj as FrontendIntegration["spec"]),
      enabled: (specObj as FrontendIntegration["spec"]).enabled ?? true,
    },
  };
}

function parseQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

export function parseFrontendIntegrationListQuery(
  query: FrontendIntegrationListQuery,
) {
  const enabledRaw = parseQueryValue(query.enabled);
  let enabled: boolean | undefined;
  if (enabledRaw !== undefined) {
    const normalized = enabledRaw.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      enabled = true;
    } else if (normalized === "false" || normalized === "0") {
      enabled = false;
    } else {
      throw new ForgeError('enabled must be "true" or "false"', 400);
    }
  }

  const typeRaw = parseQueryValue(query.type);
  let type: "crd" | "iframe" | undefined;
  if (typeRaw !== undefined) {
    const normalized = typeRaw.trim().toLowerCase();
    if (normalized === "crd" || normalized === "iframe") {
      type = normalized as "crd" | "iframe";
    } else {
      throw new ForgeError('type must be "crd" or "iframe"', 400);
    }
  }

  const nameRaw = parseQueryValue(query.name);
  const name = nameRaw !== undefined ? nameRaw.trim() : undefined;
  if (name !== undefined && name.length === 0) {
    throw new ForgeError("name must be a non-empty string", 400);
  }

  return { enabled, type, name };
}
