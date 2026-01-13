import fs from 'fs';
import path from 'path';

export type StaticMountConfig = {
  root: string;
  prefix: string;
  index?: string[] | false;
  cacheControl?: string;
};

export type K8sConfig = {
  server: string;
  tokenCookieName?: string;
};

export type ServerConfig = {
  static: StaticMountConfig[];
  k8s?: K8sConfig;
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

function normalizeK8sServer(server: string): string {
  const trimmed = server.trim();
  if (trimmed.length === 0) {
    throw new Error('k8s.server must be a non-empty string');
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeK8sConfig(value: unknown): K8sConfig {
  if (typeof value === 'string') {
    return { server: normalizeK8sServer(value) };
  }
  if (!value || typeof value !== 'object') {
    throw new Error('k8s must be a string or object');
  }

  const obj = value as Record<string, unknown>;
  const serverRaw = obj.server ?? obj.url ?? obj.apiServer;
  const server = normalizeK8sServer(toNonEmptyString(serverRaw, 'k8s.server'));

  const tokenCookieNameRaw = obj.tokenCookieName ?? obj.cookieTokenName;
  const tokenCookieName =
    tokenCookieNameRaw == null ? undefined : toNonEmptyString(tokenCookieNameRaw, 'k8s.tokenCookieName');

  return { server, tokenCookieName };
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
  const k8sValue = (json as Record<string, unknown>).k8s;
  if (staticValue == null || staticValue === false) {
    const k8s = k8sValue == null || k8sValue === false ? undefined : normalizeK8sConfig(k8sValue);
    return { static: [], k8s };
  }

  const items = Array.isArray(staticValue) ? staticValue : [staticValue];
  const mounts = items.map((item, i) => asStaticMount(item, baseDir, i));
  const k8s = k8sValue == null || k8sValue === false ? undefined : normalizeK8sConfig(k8sValue);
  return { static: mounts, k8s };
}
