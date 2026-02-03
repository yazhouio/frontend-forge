import type { FastifyReply, FastifyRequest } from 'fastify';
import { ForgeError, isForgeError, type ForgeCore } from '@frontend-forge/forge-core';
import { isCodeExporterError, type CodeExporter } from '@frontend-forge/forge-core/advanced';
import type {
  BuildRequestBody,
  ExtensionManifest,
  PageSchemaRequestBody,
  ProjectJsBundleRequestBody,
  ProjectManifestRequestBody,
  SceneConfig,
  SceneJsBundleRequestBody,
  SceneRequestBody,
  SceneType,
} from './types.js';
import { createExtensionManifest } from './preview/extensionManifest.js';
import {
  buildSceneProjectFiles,
  buildSceneProjectTarGz,
  generateSceneProjectFiles,
} from './preview/sceneArtifacts.js';
import type { K8sConfig } from './runtimeConfig.js';
import { joinUrl, normalizeDns1123Label, postJson } from './k8sClient.js';

export type ControllerDeps = {
  forge: ForgeCore;
  k8s?: K8sConfig;
};

function requireExporter(forge: ForgeCore): CodeExporter {
  const exporter = forge.getCodeExporter();
  if (!exporter || typeof exporter !== 'object') {
    throw new ForgeError('codeExporter is required', 500);
  }
  if (typeof (exporter as CodeExporter).build !== 'function') {
    throw new ForgeError('codeExporter.build is required', 500);
  }
  return exporter as CodeExporter;
}

function requirePageSchema(body: PageSchemaRequestBody | unknown): unknown {
  if (body && typeof body === 'object' && 'pageSchema' in body) {
    const wrapper = body as PageSchemaRequestBody;
    if (wrapper.pageSchema == null) {
      throw new ForgeError('pageSchema is required', 400);
    }
    return wrapper.pageSchema;
  }
  if (body == null) {
    throw new ForgeError('pageSchema is required', 400);
  }
  return body;
}

function requireManifest(body: ProjectManifestRequestBody | unknown): ExtensionManifest {
  if (!body || typeof body !== 'object') {
    throw new ForgeError('manifest is required', 400);
  }
  const wrapper = body as ProjectManifestRequestBody;
  const hasManifest = Object.prototype.hasOwnProperty.call(wrapper, 'manifest');
  const manifest = hasManifest ? wrapper.manifest : body;
  if (!manifest || typeof manifest !== 'object') {
    throw new ForgeError('manifest is required', 400);
  }
  return manifest as ExtensionManifest;
}

function requireScene(body: SceneRequestBody | unknown): { type: SceneType; config: SceneConfig } {
  if (!body || typeof body !== 'object') {
    throw new ForgeError('scene is required', 400);
  }
  const wrapper = body as { scene?: SceneRequestBody };
  const raw = Object.prototype.hasOwnProperty.call(wrapper, 'scene')
    ? (wrapper.scene as SceneRequestBody)
    : (body as SceneRequestBody);
  if (raw.type !== 'crdTable' && raw.type !== 'workspaceCrdTable') {
    throw new ForgeError('scene.type must be "crdTable" or "workspaceCrdTable"', 400);
  }
  if (!raw.config || typeof raw.config !== 'object') {
    throw new ForgeError('scene.config must be an object', 400);
  }
  return { type: raw.type, config: raw.config };
}

function requireJsBundleParams(
  body: ProjectJsBundleRequestBody | unknown
): { name: string; extensionName: string; namespace: string | null; cluster: string | null } {
  if (!body || typeof body !== 'object') {
    throw new ForgeError('params is required', 400);
  }
  if (!('params' in body)) {
    throw new ForgeError('params is required', 400);
  }

  const params = (body as ProjectJsBundleRequestBody).params as unknown;
  if (!params || typeof params !== 'object') {
    throw new ForgeError('params must be an object', 400);
  }

  const rawName = (params as { name?: unknown }).name;
  if (typeof rawName !== 'string' || rawName.trim().length === 0) {
    throw new ForgeError('params.name is required', 400);
  }
  const name = normalizeDns1123Label(rawName.trim(), 'name');

  const rawExtensionName = (params as { extensionName?: unknown }).extensionName;
  if (typeof rawExtensionName !== 'string' || rawExtensionName.trim().length === 0) {
    throw new ForgeError('params.extensionName is required', 400);
  }
  const extensionName = normalizeDns1123Label(rawExtensionName.trim(), 'extensionName');

  const namespaceRaw = (params as { namespace?: unknown }).namespace;
  const namespace =
    typeof namespaceRaw === 'string' && namespaceRaw.trim().length > 0
      ? normalizeDns1123Label(namespaceRaw.trim(), 'namespace')
      : null;

  const clusterRaw = (params as { cluster?: unknown }).cluster;
  const cluster =
    typeof clusterRaw === 'string' && clusterRaw.trim().length > 0
      ? normalizeDns1123Label(clusterRaw.trim(), 'cluster')
      : null;

  return { name, extensionName, namespace, cluster };
}

async function createJsBundleFromManifest(args: {
  forge: ForgeCore;
  k8s: K8sConfig;
  token: string;
  manifest: ExtensionManifest;
  name: string;
  extensionName: string;
  namespace: string | null;
  cluster: string | null;
  reply: FastifyReply;
}) {
  const { forge, k8s, token, manifest, name, extensionName, namespace, cluster, reply } = args;
  const files = await forge.buildProject(manifest, { build: true });
  const row: Record<string, string> = {};
  for (const f of files) {
    if (!f || typeof f !== 'object') continue;
    if (typeof f.path !== 'string' || typeof f.content !== 'string') continue;
    row[f.path] = Buffer.from(f.content, 'utf8').toString('base64');
  }
  if (!row['index.js']) {
    throw new ForgeError('build output is missing index.js', 500);
  }

  reply.log.info(
    {
      name,
      extensionName,
      namespace,
      cluster,
      k8sServer: k8s.server,
      outputFiles: Object.keys(row),
    },
    'K8s JSBundle create requested'
  );

  const manifestJson = JSON.stringify(manifest);
  if (manifestJson.length > 200_000) {
    throw new ForgeError('manifest is too large to store in annotations', 400);
  }

  const annotations: Record<string, string> = {
    'frontend-forge.io/manifest': manifestJson,
  };
  if (namespace) {
    annotations['meta.helm.sh/release-namespace'] = namespace;
  }

  const jsBundle = {
    apiVersion: 'extensions.kubesphere.io/v1alpha1',
    kind: 'JSBundle',
    metadata: {
      name,
      labels: {
        'kubesphere.io/extension-ref': extensionName,
      },
      annotations,
    },
    spec: { row },
    status: {
      state: 'Available',
    }
  };

  let path = '/apis/extensions.kubesphere.io/v1alpha1/jsbundles';
  if (cluster) {
    path = `/clusters/${cluster}${path}`;
  }
  const url = joinUrl(k8s.server, path);
  const result = await postJson(url, { token: token.trim(), body: jsBundle });
  reply.log.info(
    { name, extensionName, namespace, cluster, status: result.status },
    'K8s JSBundle create completed'
  );
  return { ok: true, name, extensionName, namespace, cluster, result: result.body };
}

function handleKnownError(err: unknown, reply: FastifyReply) {
  if (isForgeError(err)) {
    reply.code(err.statusCode);
    reply.log.warn({ statusCode: err.statusCode, err }, 'Request failed (ForgeError)');
    return { ok: false, error: err.message || String(err) };
  }
  if (isCodeExporterError(err)) {
    reply.code(err.statusCode);
    reply.log.warn({ statusCode: err.statusCode, err }, 'Request failed (CodeExporterError)');
    return { ok: false, error: err.message || String(err) };
  }
  throw err;
}

export function createController({ forge, k8s }: ControllerDeps) {
  return {
    healthz: async () => ({ ok: true }),

    build: async (body: BuildRequestBody, reply: FastifyReply) => {
      try {
        const exporter = requireExporter(forge);
        const fileCount = Array.isArray(body?.files) ? body.files.length : 0;
        reply.log.info(
          {
            entry: body?.entry,
            fileCount,
            externalsCount: Array.isArray(body?.externals) ? body.externals.length : 0,
            tailwindEnabled: Boolean(body?.tailwind?.enabled),
          },
          'Build requested'
        );
        const result = await exporter.build(body);
        reply.log.info(
          { cacheHit: result.cacheHit ?? false, key: result.key, meta: result.meta },
          'Build completed'
        );
        return { ok: true, ...result, cacheHit: result.cacheHit ?? false };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    pageCode: async (body: PageSchemaRequestBody, reply: FastifyReply) => {
      try {
        reply.log.info('Page code generation requested');
        const schema = requirePageSchema(body);
        const code = forge.generatePageCode(schema);
        reply.log.info({ codeSize: code.length }, 'Page code generation completed');
        return { ok: true, code };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    projectFiles: async (body: ProjectManifestRequestBody, reply: FastifyReply) => {
      try {
        const manifest = requireManifest(body);
        reply.log.info(
          { name: manifest.name, pages: manifest.pages?.length ?? 0, routes: manifest.routes?.length ?? 0 },
          'Project files generation requested'
        );
        const files = await forge.generateProjectFiles(manifest);
        reply.log.info({ fileCount: files.length }, 'Project files generation completed');
        return { ok: true, files };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    projectFilesTarGz: async (body: ProjectManifestRequestBody, reply: FastifyReply) => {
      try {
        const manifest = requireManifest(body);
        reply.log.info(
          { name: manifest.name, pages: manifest.pages?.length ?? 0, routes: manifest.routes?.length ?? 0 },
          'Project tar.gz generation requested'
        );
        const files = await forge.generateProjectFiles(manifest);
        const archive = forge.emitToTarGz(files);
        reply.header('Content-Type', 'application/gzip');
        reply.header('Content-Disposition', 'attachment; filename="project.tar.gz"');
        reply.log.info({ fileCount: files.length, size: archive.byteLength }, 'Project tar.gz generation completed');
        return reply.send(archive);
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    projectBuild: async (body: ProjectManifestRequestBody, reply: FastifyReply) => {
      try {
        const manifest = requireManifest(body);
        reply.log.info(
          { name: manifest.name, pages: manifest.pages?.length ?? 0, routes: manifest.routes?.length ?? 0 },
          'Project build requested'
        );
        const files = await forge.buildProject(manifest, { build: true });
        reply.log.info({ fileCount: files.length }, 'Project build completed');
        return { ok: true, files };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    projectBuildTarGz: async (body: ProjectManifestRequestBody, reply: FastifyReply) => {
      try {
        const manifest = requireManifest(body);
        reply.log.info(
          { name: manifest.name, pages: manifest.pages?.length ?? 0, routes: manifest.routes?.length ?? 0 },
          'Project build tar.gz requested'
        );
        const files = await forge.buildProject(manifest, { build: true });
        const archive = forge.emitToTarGz(files);
        reply.header('Content-Type', 'application/gzip');
        reply.header('Content-Disposition', 'attachment; filename="build.tar.gz"');
        reply.log.info({ fileCount: files.length, size: archive.byteLength }, 'Project build tar.gz completed');
        return reply.send(archive);
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    sceneProjectFiles: async (body: SceneRequestBody, reply: FastifyReply) => {
      try {
        const { type, config } = requireScene(body);
        reply.log.info({ type, sceneId: config.meta?.id }, 'Scene project files requested');
        const files = await generateSceneProjectFiles(forge, type, config);
        reply.log.info({ fileCount: files.length }, 'Scene project files completed');
        return { ok: true, files };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    sceneProjectFilesTarGz: async (body: SceneRequestBody, reply: FastifyReply) => {
      try {
        const { type, config } = requireScene(body);
        reply.log.info({ type, sceneId: config.meta?.id }, 'Scene project tar.gz requested');
        const files = await generateSceneProjectFiles(forge, type, config);
        const archive = forge.emitToTarGz(files);
        reply.header('Content-Type', 'application/gzip');
        reply.header('Content-Disposition', 'attachment; filename="project.tar.gz"');
        reply.log.info({ fileCount: files.length, size: archive.byteLength }, 'Scene project tar.gz completed');
        return reply.send(archive);
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    sceneProjectBuild: async (body: SceneRequestBody, reply: FastifyReply) => {
      try {
        const { type, config } = requireScene(body);
        reply.log.info({ type, sceneId: config.meta?.id }, 'Scene project build requested');
        const files = await buildSceneProjectFiles(forge, type, config);
        reply.log.info({ fileCount: files.length }, 'Scene project build completed');
        return { ok: true, files };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    sceneProjectBuildTarGz: async (body: SceneRequestBody, reply: FastifyReply) => {
      try {
        const { type, config } = requireScene(body);
        reply.log.info({ type, sceneId: config.meta?.id }, 'Scene project build tar.gz requested');
        const archive = await buildSceneProjectTarGz(forge, type, config);
        reply.header('Content-Type', 'application/gzip');
        reply.header('Content-Disposition', 'attachment; filename="build.tar.gz"');
        reply.log.info({ size: archive.byteLength }, 'Scene project build tar.gz completed');
        return reply.send(archive);
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    projectJsBundle: async (
      req: FastifyRequest<{ Body: ProjectJsBundleRequestBody }>,
      reply: FastifyReply
    ) => {
      try {
        if (!k8s?.server) {
          throw new ForgeError('k8s config is required (config.json: k8s.server)', 500);
        }

        const cookieName = k8s.tokenCookieName || 'token';
        const token = req.cookies?.[cookieName];
        if (typeof token !== 'string' || token.trim().length === 0) {
          throw new ForgeError(`auth token is required (cookie: ${cookieName})`, 401);
        }

        const { name, extensionName, namespace, cluster } = requireJsBundleParams(req.body);
        const manifest = requireManifest(req.body);
        return createJsBundleFromManifest({
          forge,
          k8s,
          token,
          manifest,
          name,
          extensionName,
          namespace,
          cluster,
          reply,
        });
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    sceneJsBundle: async (
      req: FastifyRequest<{ Body: SceneJsBundleRequestBody }>,
      reply: FastifyReply
    ) => {
      try {
        if (!k8s?.server) {
          throw new ForgeError('k8s config is required (config.json: k8s.server)', 500);
        }

        const cookieName = k8s.tokenCookieName || 'token';
        const token = req.cookies?.[cookieName];
        if (typeof token !== 'string' || token.trim().length === 0) {
          throw new ForgeError(`auth token is required (cookie: ${cookieName})`, 401);
        }

        const { name, extensionName, namespace, cluster } = requireJsBundleParams(req.body);
        const { type, config } = requireScene(req.body);
        const manifest = createExtensionManifest(type, config);

        return createJsBundleFromManifest({
          forge,
          k8s,
          token,
          manifest,
          name,
          extensionName,
          namespace,
          cluster,
          reply,
        });
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },
  };
}
