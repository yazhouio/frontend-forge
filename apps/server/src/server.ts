import path from 'path';
import { fileURLToPath } from 'url';
import Fastify from "fastify";
import PQueue from 'p-queue';
import { ForgeCore } from "@frontend-forge/forge-core";
import {
  CodeExporter,
  ComponentGenerator,
  ProjectGenerator,
} from "@frontend-forge/forge-core/advanced";
import {
  PORT,
  MAX_BODY_BYTES,
  DEFAULT_EXTERNALS,
  CONCURRENCY,
  BUILD_TIMEOUT_MS,
  CHILD_MAX_OLD_SPACE_MB,
} from './config.js';
import { getCache, setCache } from './cache.js';
import router from "./router.js";

const queue = new PQueue({ concurrency: CONCURRENCY });
const here = path.dirname(fileURLToPath(import.meta.url));
const vendorNodeModules = path.resolve(here, '..', 'vendor', 'node_modules');

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
  vendorNodeModules,
});

const componentGenerator = ComponentGenerator.withDefaults();

const forge = new ForgeCore({
  componentGenerator,
  projectGenerator: new ProjectGenerator(),
  codeExporter: exporter,
});

const app = Fastify({
  logger: true,
  bodyLimit: MAX_BODY_BYTES,
});

await app.register(router, { forge });

app.setErrorHandler((err: Error, _req, reply) => {
  reply.code(500);
  return { ok: false, error: err.message || String(err) };
});

await app.listen({ port: PORT, host: '0.0.0.0' });
