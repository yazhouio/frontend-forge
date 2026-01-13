import fs from 'fs';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import type { StaticMountConfig } from './runtimeConfig.js';

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export async function registerStaticMounts(app: FastifyInstance, mounts: StaticMountConfig[]): Promise<void> {
  for (const mount of mounts) {
    if (!isDirectory(mount.root)) {
      app.log.warn({ root: mount.root, prefix: mount.prefix }, 'Static root is missing or not a directory; skipping');
      continue;
    }

    const cacheControl = mount.cacheControl;

    await app.register(fastifyStatic, {
      root: mount.root,
      prefix: mount.prefix,
      decorateReply: false,
      index: mount.index,
      setHeaders: cacheControl ? (res) => res.setHeader('Cache-Control', cacheControl) : undefined,
    });

    app.log.info({ root: mount.root, prefix: mount.prefix }, 'Static files mounted');
  }
}
