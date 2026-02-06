import type { FastifyReply, FastifyRequest } from 'fastify';
import { ForgeError, isForgeError } from '@frontend-forge/forge-core';
import type { FrontendIntegration, FrontendIntegrationListQuery } from '../types.js';
import type { K8sConfig } from '../runtimeConfig.js';
import { joinUrl, requestJson } from '../k8sClient.js';
import { handleKnownError } from './errors.js';
import {
  buildExtensionManifestFromProjectConfig,
  buildProjectSceneConfigFromCr,
} from './frontendIntegrationTransform.js';
import { requireAuthToken, requireK8sConfig } from './k8s.js';
import {
  normalizeLabelValue,
  parseFrontendIntegrationListQuery,
  requireFrontendIntegration,
  requireNonEmptyString,
} from './validation.js';

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
    row?: Record<string, string>;
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

const FRONTEND_INTEGRATION_ANNOTATION = 'frontend-forge.io/frontendintegration';
const FRONTEND_INTEGRATION_MANIFEST_ANNOTATION = 'frontend-forge.io/manifest';
const SCENE_CONFIG_ANNOTATION = 'scene.frontend-forge.io/config';
const FRONTEND_INTEGRATION_LABEL_RESOURCE_KEY = 'frontend-forge.io/resource';
const FRONTEND_INTEGRATION_LABEL_RESOURCE_VALUE = 'frontendintegration';
const FRONTEND_INTEGRATION_LABEL_NAME_KEY = 'frontend-forge.io/name';
const FRONTEND_INTEGRATION_LABEL_TYPE_KEY = 'frontend-forge.io/type';
const FRONTEND_INTEGRATION_LABEL_ENABLED_KEY = 'frontend-forge.io/enabled';

const EMPTY_BUNDLE_JS =
  'System.register([], function (_export, _context) { "use strict"; return { execute: function () {} }; });';
const EMPTY_BUNDLE_BASE64 = Buffer.from(EMPTY_BUNDLE_JS, 'utf8').toString('base64');

function buildFrontendIntegrationLabels(integration: FrontendIntegration): Record<string, string> {
  const enabled = integration.spec.enabled ?? true;
  const type = integration.spec.integration.type;
  return {
    [FRONTEND_INTEGRATION_LABEL_RESOURCE_KEY]: FRONTEND_INTEGRATION_LABEL_RESOURCE_VALUE,
    [FRONTEND_INTEGRATION_LABEL_ENABLED_KEY]: enabled ? 'true' : 'false',
    [FRONTEND_INTEGRATION_LABEL_TYPE_KEY]: type,
    [FRONTEND_INTEGRATION_LABEL_NAME_KEY]: normalizeLabelValue(integration.metadata.name, 'metadata.name'),
  };
}

function buildFrontendIntegrationJsBundle(
  integration: FrontendIntegration,
  existing?: JsBundle
): JsBundle {
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
    throw new ForgeError('manifest is too large to store in annotations', 400);
  }

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
    : { apiVersion: 'extensions.kubesphere.io/v1alpha1', kind: 'JSBundle' };
  if (!base.apiVersion) base.apiVersion = 'extensions.kubesphere.io/v1alpha1';
  if (!base.kind) base.kind = 'JSBundle';
  base.metadata = metadata;

  const spec = typeof base.spec === 'object' && base.spec ? { ...base.spec } : {};
  if (!spec.row || typeof spec.row !== 'object') {
    spec.row = { 'index.js': EMPTY_BUNDLE_BASE64 };
  } else if (Object.keys(spec.row).length === 0) {
    spec.row['index.js'] = EMPTY_BUNDLE_BASE64;
  }
  base.spec = spec;
  return base;
}

function extractFrontendIntegration(jsBundle: JsBundle): FrontendIntegration | null {
  const annotations = jsBundle.metadata?.annotations;
  const raw = annotations?.[FRONTEND_INTEGRATION_ANNOTATION];
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }
  const obj = parsed as Record<string, unknown>;
  if (!obj.spec || typeof obj.spec !== 'object') {
    return null;
  }
  const rawMeta = obj.metadata;
  const metaObj = rawMeta && typeof rawMeta === 'object' ? (rawMeta as Record<string, unknown>) : {};
  const name =
    typeof metaObj.name === 'string' && metaObj.name.trim().length > 0
      ? metaObj.name
      : jsBundle.metadata?.name;
  if (!name) return null;

  return {
    apiVersion:
      typeof obj.apiVersion === 'string' && obj.apiVersion.trim().length > 0
        ? obj.apiVersion.trim()
        : 'frontend-forge.io/v1alpha1',
    kind: typeof obj.kind === 'string' && obj.kind.trim().length > 0 ? obj.kind.trim() : 'FrontendIntegration',
    metadata: { ...metaObj, name },
    spec: obj.spec as FrontendIntegration['spec'],
  };
}

export function createFrontendIntegrationHandlers(deps: { k8s?: K8sConfig }) {
  const { k8s } = deps;

  return {
    frontendIntegrationList: async (
      req: FastifyRequest<{ Querystring: FrontendIntegrationListQuery }>,
      reply: FastifyReply
    ) => {
      try {
        const k8sConfig = requireK8sConfig(k8s);
        const token = requireAuthToken(req, k8sConfig);
        const { enabled, type, name } = parseFrontendIntegrationListQuery(req.query ?? {});
        const selectors = [
          `${FRONTEND_INTEGRATION_LABEL_RESOURCE_KEY}=${FRONTEND_INTEGRATION_LABEL_RESOURCE_VALUE}`,
        ];
        if (enabled !== undefined) {
          selectors.push(`${FRONTEND_INTEGRATION_LABEL_ENABLED_KEY}=${enabled ? 'true' : 'false'}`);
        }
        if (type) {
          selectors.push(`${FRONTEND_INTEGRATION_LABEL_TYPE_KEY}=${type}`);
        }
        if (name) {
          selectors.push(
            `${FRONTEND_INTEGRATION_LABEL_NAME_KEY}=${normalizeLabelValue(name, 'name')}`
          );
        }

        const params = new URLSearchParams();
        if (selectors.length > 0) {
          params.set('labelSelector', selectors.join(','));
        }
        const suffix = params.toString();
        const path = `/kapis/extensions.kubesphere.io/v1alpha1/jsbundles${suffix ? `?${suffix}` : ''}`;
        const url = joinUrl(k8sConfig.server, path);
        const result = await requestJson(url, { token, method: 'GET' });
        const body = result.body as JsBundleList;
        const items = Array.isArray(body?.items) ? body.items : [];
        const integrations = items
          .map((item) => extractFrontendIntegration(item))
          .filter((item): item is FrontendIntegration => Boolean(item));
        return { ok: true, items: integrations, totalItems: integrations.length };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    frontendIntegrationGet: async (
      req: FastifyRequest<{ Params: { name: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const name = requireNonEmptyString(req.params?.name, 'name');
        const k8sConfig = requireK8sConfig(k8s);
        const token = requireAuthToken(req, k8sConfig);
        const path = `/kapis/extensions.kubesphere.io/v1alpha1/jsbundles/${encodeURIComponent(name)}`;
        const url = joinUrl(k8sConfig.server, path);
        const result = await requestJson(url, { token, method: 'GET' });
        const integration = extractFrontendIntegration(result.body as JsBundle);
        if (!integration) {
          throw new ForgeError('frontendIntegration not found', 404);
        }
        return { ok: true, item: integration };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    frontendIntegrationCreate: async (
      req: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply
    ) => {
      try {
        const integration = requireFrontendIntegration(req.body);
        const k8sConfig = requireK8sConfig(k8s);
        const token = requireAuthToken(req, k8sConfig);
        const jsBundle = buildFrontendIntegrationJsBundle(integration);
        const url = joinUrl(k8sConfig.server, '/kapis/extensions.kubesphere.io/v1alpha1/jsbundles');
        await requestJson(url, { token, method: 'POST', body: jsBundle });
        return { ok: true, item: integration };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    frontendIntegrationUpdate: async (
      req: FastifyRequest<{ Params: { name: string }; Body: unknown }>,
      reply: FastifyReply
    ) => {
      try {
        const name = requireNonEmptyString(req.params?.name, 'name');
        const integration = requireFrontendIntegration(req.body, name);
        if (integration.metadata.name !== name) {
          throw new ForgeError('metadata.name must match path parameter', 400);
        }
        const k8sConfig = requireK8sConfig(k8s);
        const token = requireAuthToken(req, k8sConfig);
        const deletePath = `/kapis/extensions.kubesphere.io/v1alpha1/jsbundles/${encodeURIComponent(name)}`;
        const deleteUrl = joinUrl(k8sConfig.server, deletePath);
        try {
          await requestJson(deleteUrl, { token, method: 'DELETE' });
        } catch (err) {
          if (!isForgeError(err) || err.statusCode !== 404) {
            throw err;
          }
        }

        const jsBundle = buildFrontendIntegrationJsBundle(integration);
        const createUrl = joinUrl(
          k8sConfig.server,
          '/kapis/extensions.kubesphere.io/v1alpha1/jsbundles'
        );
        await requestJson(createUrl, { token, method: 'POST', body: jsBundle });
        return { ok: true, item: integration };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    frontendIntegrationDelete: async (
      req: FastifyRequest<{ Params: { name: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const name = requireNonEmptyString(req.params?.name, 'name');
        const k8sConfig = requireK8sConfig(k8s);
        const token = requireAuthToken(req, k8sConfig);
        const path = `/kapis/extensions.kubesphere.io/v1alpha1/jsbundles/${encodeURIComponent(name)}`;
        const url = joinUrl(k8sConfig.server, path);
        await requestJson(url, { token, method: 'DELETE' });
        return { ok: true };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },
  };
}
