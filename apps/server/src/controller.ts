import type { FastifyReply } from 'fastify';
import { ForgeError, isForgeError, type ForgeCore } from '@frontend-forge/forge-core';
import { isCodeExporterError, type CodeExporter } from '@frontend-forge/forge-core/advanced';
import type {
  BuildRequestBody,
  ExtensionManifest,
  PageSchemaRequestBody,
  ProjectManifestRequestBody,
} from './types.js';

export type ControllerDeps = {
  forge: ForgeCore;
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

function handleKnownError(err: unknown, reply: FastifyReply) {
  if (isForgeError(err)) {
    reply.code(err.statusCode);
    return { ok: false, error: err.message || String(err) };
  }
  if (isCodeExporterError(err)) {
    reply.code(err.statusCode);
    return { ok: false, error: err.message || String(err) };
  }
  throw err;
}

export function createController({ forge }: ControllerDeps) {
  return {
    healthz: async () => ({ ok: true }),

    build: async (body: BuildRequestBody, reply: FastifyReply) => {
      try {
        const exporter = requireExporter(forge);
        const result = await exporter.build(body);
        return { ok: true, ...result, cacheHit: result.cacheHit ?? false };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    pageCode: async (body: PageSchemaRequestBody, reply: FastifyReply) => {
      try {
        const schema = requirePageSchema(body);
        const code = forge.generatePageCode(schema);
        return { ok: true, code };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    projectFiles: async (body: ProjectManifestRequestBody, reply: FastifyReply) => {
      try {
        const manifest = requireManifest(body);
        const files = await forge.generateProjectFiles(manifest);
        return { ok: true, files };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    projectFilesTarGz: async (body: ProjectManifestRequestBody, reply: FastifyReply) => {
      try {
        const manifest = requireManifest(body);
        const files = await forge.generateProjectFiles(manifest);
        const archive = forge.emitToTarGz(files);
        reply.header('Content-Type', 'application/gzip');
        reply.header('Content-Disposition', 'attachment; filename="project.tar.gz"');
        return reply.send(archive);
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    projectBuild: async (body: ProjectManifestRequestBody, reply: FastifyReply) => {
      try {
        const manifest = requireManifest(body);
        const files = await forge.buildProject(manifest, { build: true });
        return { ok: true, files };
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },

    projectBuildTarGz: async (body: ProjectManifestRequestBody, reply: FastifyReply) => {
      try {
        const manifest = requireManifest(body);
        const files = await forge.buildProject(manifest, { build: true });
        const archive = forge.emitToTarGz(files);
        reply.header('Content-Type', 'application/gzip');
        reply.header('Content-Disposition', 'attachment; filename="build.tar.gz"');
        return reply.send(archive);
      } catch (err) {
        return handleKnownError(err, reply);
      }
    },
  };
}
