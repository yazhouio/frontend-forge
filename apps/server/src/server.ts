import Fastify from 'fastify';
import PQueue from 'p-queue';
import { ForgeCore, isForgeError } from '@frontend-forge/forge-core';
import {
  PORT,
  MAX_BODY_BYTES,
  DEFAULT_EXTERNALS,
  CONCURRENCY,
  BUILD_TIMEOUT_MS,
  CHILD_MAX_OLD_SPACE_MB,
} from './config.js';
import { getCache, setCache } from './cache.js';
import type { BuildRequestBody } from './types.js';

const queue = new PQueue({ concurrency: CONCURRENCY });

const forge = new ForgeCore({
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

const app = Fastify({
  logger: true,
  bodyLimit: MAX_BODY_BYTES
});

app.get('/healthz', async () => ({ ok: true }));

app.post<{ Body: BuildRequestBody }>('/build', async (req, reply) => {
  try {
    const result = await forge.build(req.body);
    return { ok: true, ...result, cacheHit: result.cacheHit ?? false };
  } catch (err) {
    if (isForgeError(err)) {
      reply.code(err.statusCode);
      return { ok: false, error: err.message || String(err) };
    }
    throw err;
  }
});

app.setErrorHandler((err: Error, _req, reply) => {
  reply.code(500);
  return { ok: false, error: err.message || String(err) };
});

await app.listen({ port: PORT, host: '0.0.0.0' });
