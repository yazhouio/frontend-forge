import type { FastifyReply, FastifyRequest } from 'fastify';
import { ForgeError, isForgeError, type ForgeCore } from '@frontend-forge/forge-core';
import { isCodeExporterError, type CodeExporter } from '@frontend-forge/forge-core/advanced';
import type {
  BuildRequestBody,
  ExtensionManifest,
  PageSchemaRequestBody,
  ProjectJsBundleRequestBody,
  ProjectManifestRequestBody,
} from './types.js';
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

function jsBundleNameFrom(body: ProjectJsBundleRequestBody, manifest: ExtensionManifest): string {
  const direct = body?.jsBundleName;
  if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim();
  const buildModuleName = manifest.build?.moduleName;
  if (typeof buildModuleName === 'string' && buildModuleName.trim().length > 0) return buildModuleName.trim();
  return String(manifest.name);
}

function namespaceFrom(body: ProjectJsBundleRequestBody): string | null {
  const ns = body?.namespace;
  if (typeof ns === 'string' && ns.trim().length > 0) return ns.trim();
  return null;
}

function clusterFrom(body: ProjectJsBundleRequestBody): string | null {
  const cluster = body?.cluster;
  if (typeof cluster === 'string' && cluster.trim().length > 0) return cluster.trim();
  return null;
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

        const manifest = requireManifest(req.body);
        const files = await forge.buildProject(manifest, { build: true });
        const row: Record<string, string> = {};
        for (const f of files) {
          if (!f || typeof f !== 'object') continue;
          if (typeof f.path !== 'string' || typeof f.content !== 'string') continue;
          row[f.path] = f.content;
        }
        if (!row['index.js']) {
          throw new ForgeError('build output is missing index.js', 500);
        }

        const rawName = jsBundleNameFrom(req.body, manifest);
        const name = normalizeDns1123Label(rawName, 'jsBundleName');
        const namespaceRaw = namespaceFrom(req.body);
        const namespace = namespaceRaw ? normalizeDns1123Label(namespaceRaw, 'namespace') : null;
        const clusterRaw = clusterFrom(req.body);
        const cluster = clusterRaw ? normalizeDns1123Label(clusterRaw, 'cluster') : null;

        reply.log.info(
          {
            name,
            namespace,
            cluster,
            k8sServer: k8s.server,
            outputFiles: Object.keys(row),
          },
          'K8s JSBundle create requested'
        );

        const jsBundle = {
          apiVersion: 'extensions.kubesphere.io/v1alpha1',
          kind: 'JSBundle',
          metadata: namespace ? { name, namespace } : { name },
          spec: { row },
        };

        let path: string;
        if (namespace) {
          path = `/apis/extensions.kubesphere.io/v1alpha1/namespaces/${namespace}/jsbundles`;
        } else {
          path = '/apis/extensions.kubesphere.io/v1alpha1/jsbundles';
        }
        if (cluster) {
          path = `/clusters/${cluster}${path}`;
        }
        const url = joinUrl(k8s.server, path);
        const result = await postJson(url, { token: token.trim(), body: jsBundle });
        reply.log.info({ name, status: result.status }, 'K8s JSBundle create completed');
        return { ok: true, name, namespace, cluster, result: result.body };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },
  };
}
