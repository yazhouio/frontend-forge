import Fastify, { type FastifyReply } from 'fastify';
import PQueue from 'p-queue';
import { ForgeCore, ForgeError, isForgeError } from '@frontend-forge/forge-core';
import {
  CodeExporter,
  ComponentGenerator,
  ProjectGenerator,
  isCodeExporterError,
} from '@frontend-forge/forge-core/advanced';
import {
  PORT,
  MAX_BODY_BYTES,
  DEFAULT_EXTERNALS,
  CONCURRENCY,
  BUILD_TIMEOUT_MS,
  CHILD_MAX_OLD_SPACE_MB,
} from './config.js';
import { getCache, setCache } from './cache.js';
import type {
  BuildRequestBody,
  ExtensionManifest,
  PageSchemaRequestBody,
  ProjectManifestRequestBody,
} from './types.js';

const queue = new PQueue({ concurrency: CONCURRENCY });

const exporter = new CodeExporter({
  cache: {
    get: (key) => getCache(key),
    set: (key, value) => setCache(key, value),
  },
  schedule: (fn) => queue.add(() => fn()),
  buildTimeoutMs: BUILD_TIMEOUT_MS,
  childMaxOldSpaceMb: CHILD_MAX_OLD_SPACE_MB,
  defaultExternals: DEFAULT_EXTERNALS,
  defaultEntry: 'src/index.tsx',
});

const componentGenerator = ComponentGenerator.withDefaults();

const forge = new ForgeCore({
  componentGenerator,
  projectGenerator: new ProjectGenerator(),
  codeExporter: exporter,
});

const app = Fastify({
  logger: true,
  bodyLimit: MAX_BODY_BYTES
});

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

app.get('/healthz', async () => ({ ok: true }));

app.post<{ Body: BuildRequestBody }>('/build', async (req, reply) => {
  try {
    const result = await exporter.build(req.body);
    return { ok: true, ...result, cacheHit: result.cacheHit ?? false };
  } catch (err) {
    return handleKnownError(err, reply);
  }
});

app.post<{ Body: PageSchemaRequestBody }>('/page/code', async (req, reply) => {
  try {
    const schema = requirePageSchema(req.body);
    const code = forge.generatePageCode(schema);
    return { ok: true, code };
  } catch (err) {
    return handleKnownError(err, reply);
  }
});

app.post<{ Body: ProjectManifestRequestBody }>('/project/files', async (req, reply) => {
  try {
    const manifest = requireManifest(req.body);
    const files = await forge.generateProjectFiles(manifest);
    return { ok: true, files };
  } catch (err) {
    return handleKnownError(err, reply);
  }
});

app.post<{ Body: ProjectManifestRequestBody }>('/project/files.tar.gz', async (req, reply) => {
  try {
    const manifest = requireManifest(req.body);
    const files = await forge.generateProjectFiles(manifest);
    const archive = forge.emitToTarGz(files);
    reply.header('Content-Type', 'application/gzip');
    reply.header('Content-Disposition', 'attachment; filename="project.tar.gz"');
    return reply.send(archive);
  } catch (err) {
    return handleKnownError(err, reply);
  }
});

app.post<{ Body: ProjectManifestRequestBody }>('/project/build', async (req, reply) => {
  try {
    const manifest = requireManifest(req.body);
    const files = await forge.buildProject(manifest, { build: true });
    return { ok: true, files };
  } catch (err) {
    return handleKnownError(err, reply);
  }
});

app.post<{ Body: ProjectManifestRequestBody }>('/project/build.tar.gz', async (req, reply) => {
  try {
    const manifest = requireManifest(req.body);
    const files = await forge.buildProject(manifest, { build: true });
    const archive = forge.emitToTarGz(files);
    reply.header('Content-Type', 'application/gzip');
    reply.header('Content-Disposition', 'attachment; filename="build.tar.gz"');
    return reply.send(archive);
  } catch (err) {
    return handleKnownError(err, reply);
  }
});

app.setErrorHandler((err: Error, _req, reply) => {
  reply.code(500);
  return { ok: false, error: err.message || String(err) };
});

await app.listen({ port: PORT, host: '0.0.0.0' });
