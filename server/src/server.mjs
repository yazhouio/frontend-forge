import Fastify from 'fastify';
import PQueue from 'p-queue';
import { PORT, MAX_BODY_BYTES, DEFAULT_EXTERNALS, CONCURRENCY, BUILD_TIMEOUT_MS } from './config.mjs';
import { getCache, setCache } from './cache.mjs';
import { computeBuildKey, nowMs, ALLOWED_FILE_RE } from './utils.mjs';
import { buildOnce } from './builder.mjs';

const queue = new PQueue({ concurrency: CONCURRENCY });

const app = Fastify({
  logger: true,
  bodyLimit: MAX_BODY_BYTES
});

app.get('/healthz', async () => ({ ok: true }));

app.post('/build', async (req, reply) => {
  const body = req.body ?? {};

  const files = Array.isArray(body.files) ? body.files : null;
  if (!files || files.length === 0) {
    reply.code(400);
    return { ok: false, error: 'files must be a non-empty array' };
  }

  const normalizedFiles = files.map((f) => {
    if (!f || typeof f.path !== 'string') throw new Error('each file must have a string path');
    if (typeof f.content !== 'string') throw new Error('each file must have a string content');
    if (!ALLOWED_FILE_RE.test(f.path)) {
      throw new Error(`unsupported file type: ${f.path}`);
    }
    return { path: f.path, content: f.content };
  });

  const entry = typeof body.entry === 'string' ? body.entry : 'src/index.tsx';
  const externals = Array.isArray(body.externals) && body.externals.length > 0
    ? body.externals.map(String)
    : DEFAULT_EXTERNALS;
  const tailwind = body.tailwind && typeof body.tailwind === 'object'
    ? {
        enabled: Boolean(body.tailwind.enabled),
        input: body.tailwind.input ? String(body.tailwind.input) : 'src/index.css',
        config: body.tailwind.config ? String(body.tailwind.config) : null
      }
    : { enabled: false };

  const key = computeBuildKey({ files: normalizedFiles, entry, externals, tailwind });

  const cached = getCache(key);
  if (cached.hit) {
    return {
      ok: true,
      cacheHit: cached.hit,
      key,
      outputs: cached.value.outputs,
      meta: { ...cached.value.meta, buildMs: 0 }
    };
  }

  const jobStart = nowMs();
  const result = await queue.add(async () => {
    const timeout = BUILD_TIMEOUT_MS;
    const p = buildOnce({ files: normalizedFiles, entry, externals, tailwind });

    const timed = await Promise.race([
      p,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`build timeout after ${timeout}ms`)), timeout))
    ]);

    return timed;
  });

  const jobMs = Math.max(0, Math.round(nowMs() - jobStart));

  const outputs = {
    js: result.js,
    css: result.css
  };

  const cacheValue = {
    outputs,
    meta: { buildMs: result.meta.buildMs, queuedMs: jobMs }
  };

  setCache(key, cacheValue);

  return {
    ok: true,
    cacheHit: false,
    key,
    outputs,
    meta: cacheValue.meta
  };
});

app.setErrorHandler((err, _req, reply) => {
  reply.code(500);
  return { ok: false, error: err.message || String(err) };
});

await app.listen({ port: PORT, host: '0.0.0.0' });
