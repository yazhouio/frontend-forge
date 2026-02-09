import { ForgeError } from "@frontend-forge/forge-core";
import type {
  ExtensionManifest,
  FrontendIntegration,
  MenuMeta,
  ProjectSceneConfig,
  ProjectSceneType,
  SceneConfig,
} from "../types.js";
import { createExtensionManifestFromProjectConfig } from "../preview/extensionManifest.js";

type Placement = "workspace" | "cluster" | "global";

const VALID_PLACEMENTS = new Set<Placement>(["workspace", "cluster", "global"]);

const DEFAULT_COLUMNS = [
  {
    key: "name",
    title: "NAME",
    render: {
      type: "text",
      path: "metadata.name",
    },
  },
  {
    key: "updatedAt",
    title: "UPDATED_AT",
    render: {
      type: "time",
      path: "metadata.creationTimestamp",
      format: "local-datetime",
    },
  },
];

function normalizeRoutingPath(pathValue: string): string {
  const normalized = pathValue.replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    throw new ForgeError("spec.routing.path is required", 400);
  }
  return normalized;
}

function dedupePlacements(raw: Placement[]): Placement[] {
  const seen = new Set<Placement>();
  const out: Placement[] = [];
  for (const item of raw) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function normalizePlacements(raw: unknown): Placement[] {
  if (!Array.isArray(raw)) return [];
  const result: Placement[] = [];
  for (const item of raw) {
    if (typeof item !== "string") {
      throw new ForgeError("spec.menu.placements must be a string array", 400);
    }
    const placement = item.trim().toLowerCase();
    if (!VALID_PLACEMENTS.has(placement as Placement)) {
      throw new ForgeError(
        "spec.menu.placements only supports workspace, cluster, global",
        400,
      );
    }
    result.push(placement as Placement);
  }
  return dedupePlacements(result);
}

function routePrefix(placement: Placement, crName: string): string {
  if (placement === "workspace")
    return "/workspaces/:workspace/frontendintegrations";
  if (placement === "cluster") return "/clusters/:cluster/frontendintegrations";
  return `/extension/${crName}`;
}

function resolveMenuMeta(
  integration: FrontendIntegration,
  placement: Placement,
): MenuMeta {
  return {
    parent: placement,
    name: integration.metadata.name,
    title:
      integration.spec.menu?.name ??
      integration.spec.displayName ??
      integration.metadata.name,
    icon: "GridDuotone",
    order: 999,
  };
}

function resolveSceneType(
  integrationType: FrontendIntegration["spec"]["integration"]["type"],
  placement: Placement,
): ProjectSceneType {
  if (integrationType === "iframe") return "IframeScene";
  return placement === "workspace" ? "WorkspaceTableScene" : "CrdTableScene";
}

export function buildRoutePath(
  placement: Placement,
  crName: string,
  routingPath: string,
): string {
  const suffix = normalizeRoutingPath(routingPath);
  return `${routePrefix(placement, crName)}/${suffix}`;
}

export function resolvePlacements(integration: FrontendIntegration): {
  placements: Placement[];
  explicit: boolean;
} {
  const integrationType = integration.spec.integration.type;
  const normalized = normalizePlacements(integration.spec.menu?.placements);
  const explicit = normalized.length > 0;

  if (integrationType === "iframe") {
    if (normalized.length === 0) {
      return { placements: ["global"], explicit: false };
    }
    return { placements: normalized, explicit: true };
  }

  if (normalized.length === 0) {
    throw new ForgeError(
      "spec.menu.placements is required for crd integration",
      400,
    );
  }
  const filtered = normalized.filter((item) => item !== "global");
  if (filtered.length === 0) {
    throw new ForgeError(
      "spec.menu.placements must include workspace or cluster for crd integration",
      400,
    );
  }
  return { placements: filtered, explicit: true };
}

export function buildProjectSceneConfigFromCr(
  integration: FrontendIntegration,
): ProjectSceneConfig {
  const crName = integration.metadata.name;
  const displayName =
    integration.spec.displayName ?? integration.spec.menu?.name ?? crName;
  const routingPath = normalizeRoutingPath(integration.spec.routing.path);
  const { placements, explicit } = resolvePlacements(integration);

  const scenes = placements.map((placement) => {
    const pageId = `${crName}-${placement}`;
    const sceneType = resolveSceneType(
      integration.spec.integration.type,
      placement,
    );
    const menu = explicit ? resolveMenuMeta(integration, placement) : undefined;
    const meta = {
      route: {
        path: buildRoutePath(placement, crName, routingPath),
        pageId,
      },
      ...(menu ? { menu } : {}),
    };

    if (integration.spec.integration.type === "iframe") {
      const config: SceneConfig = {
        meta: {
          id: pageId,
          name: displayName,
          title: displayName,
          path: `/${pageId}`,
        },
        page: {
          id: pageId,
          title: displayName,
        },
        frameUrl: integration.spec.integration.iframe.url,
      };
      return { type: sceneType, meta, config };
    }

    const crd = integration.spec.integration.crd;
    const scope = crd.scope === "Namespaced" ? "namespace" : "cluster";
    const config: SceneConfig = {
      meta: {
        id: pageId,
        name: displayName,
        title: displayName,
        path: `/${pageId}`,
      },
      crd: {
        apiVersion: crd.version,
        kind: crd.names.kind,
        plural: crd.names.plural,
        group: crd.group,
        kapi: true,
      },
      scope,
      page: {
        id: pageId,
        title: displayName,
        authKey: crName,
      },
      columns: DEFAULT_COLUMNS,
    };
    return { type: sceneType, meta, config };
  });

  return {
    projectName: crName,
    enabled: integration.spec.enabled ?? true,
    scenes,
  };
}

export function buildExtensionManifestFromProjectConfig(
  config: ProjectSceneConfig,
  options?: { displayName?: string; description?: string },
): ExtensionManifest {
  return createExtensionManifestFromProjectConfig(config, options);
}
