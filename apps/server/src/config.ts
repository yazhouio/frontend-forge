import path from 'path';
import os from 'os';

export const PORT = Number(process.env.PORT || 3000);
export const CONFIG_PATH = process.env.CONFIG_PATH || path.resolve(process.cwd(), 'config.json');
export const CACHE_DIR = process.env.CACHE_DIR || path.resolve(process.cwd(), '.cache');
export const CACHE_MAX_ITEMS = Number(process.env.CACHE_MAX_ITEMS || 200);
export const CONCURRENCY = Number(process.env.CONCURRENCY || Math.max(1, Math.floor(os.cpus().length / 2)));
export const BUILD_TIMEOUT_MS = Number(process.env.BUILD_TIMEOUT_MS || 30_000);
export const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 1_048_576);
export const CHILD_MAX_OLD_SPACE_MB = Number(process.env.CHILD_MAX_OLD_SPACE_MB || 512);

export const DEFAULT_EXTERNALS = [
  'react',
  'react-dom',
  'react-router-dom',
  'react-query',
  'styled-components',
  '@ks-console/shared',
  '@kubed/charts',
  '@kubed/code-editor',
  '@kubed/components',
  '@kubed/hooks',
  '@kubed/icons',
  'posthog-js',
  'wujie-react'
];
