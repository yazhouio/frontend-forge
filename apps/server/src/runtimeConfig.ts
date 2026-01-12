import fs from 'fs';
import path from 'path';

export type StaticMountConfig = {
  root: string;
  prefix: string;
  index?: string[] | false;
  cacheControl?: string;
};

export type ServerConfig = {
  static: StaticMountConfig[];
};

function toNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return trimmed;
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (trimmed.length === 0) {
    throw new Error('static.prefix must be a non-empty string');
  }
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (withLeadingSlash === '/') return '/';
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function normalizeIndex(value: unknown): string[] | false | undefined {
  if (value === undefined) return undefined;
  if (value === false) return false;
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
    return value;
  }
  throw new Error('static.index must be a string, string[], or false');
}

function asStaticMount(item: unknown, baseDir: string, index: number): StaticMountConfig {
  if (!item || typeof item !== 'object') {
    throw new Error(`static[${index}] must be an object`);
  }
  const obj = item as Record<string, unknown>;

  const rootRaw = obj.root ?? obj.dir;
  const rootValue = toNonEmptyString(rootRaw, `static[${index}].root`);
  const root = path.isAbsolute(rootValue) ? rootValue : path.resolve(baseDir, rootValue);

  const prefixRaw = obj.prefix ?? '/';
  const prefix = normalizePrefix(toNonEmptyString(prefixRaw, `static[${index}].prefix`));

  const indexOpt = normalizeIndex(obj.index);

  const cacheControlRaw = obj.cacheControl;
  const cacheControl =
    cacheControlRaw === undefined ? undefined : toNonEmptyString(cacheControlRaw, `static[${index}].cacheControl`);

  return {
    root,
    prefix,
    index: indexOpt,
    cacheControl,
  };
}

export function loadServerConfig(configPath: string): ServerConfig {
  if (!fs.existsSync(configPath)) {
    return { static: [] };
  }

  let json: unknown;
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    json = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read config file: ${configPath} (${message})`);
  }

  if (!json || typeof json !== 'object') {
    throw new Error('config.json must be a JSON object');
  }

  const baseDir = path.dirname(configPath);
  const staticValue = (json as Record<string, unknown>).static;
  if (staticValue == null || staticValue === false) {
    return { static: [] };
  }

  const items = Array.isArray(staticValue) ? staticValue : [staticValue];
  const mounts = items.map((item, i) => asStaticMount(item, baseDir, i));
  return { static: mounts };
}
