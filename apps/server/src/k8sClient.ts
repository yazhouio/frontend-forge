import { fetch } from 'undici';
import { ForgeError } from '@frontend-forge/forge-core';

export type K8sPostJsonResult = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

function ensureUrlBase(server: string): string {
  const trimmed = String(server || '').trim();
  if (trimmed.length === 0) {
    throw new ForgeError('k8s.server is required', 500);
  }
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

export function joinUrl(base: string, urlPath: string): string {
  const baseWithSlash = ensureUrlBase(base);
  const rel = String(urlPath || '').replace(/^\/+/, '');
  return new URL(rel, baseWithSlash).toString();
}

export function normalizeDns1123Label(value: string, field: string): string {
  const lower = String(value).toLowerCase();
  const replaced = lower.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  const trimmed = replaced.replace(/^-+/, '').replace(/-+$/, '').slice(0, 63);
  if (!trimmed) {
    throw new ForgeError(`${field} must be a valid DNS-1123 label`, 400);
  }
  return trimmed;
}

export async function requestJson(
  url: string,
  {
    token,
    method = 'GET',
    body,
    timeoutMs = 10_000,
    contentType,
  }: {
    token: string;
    method?: string;
    body?: unknown;
    timeoutMs?: number;
    contentType?: string;
  }
): Promise<K8sPostJsonResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
    const hasBody = body !== undefined;
    if (hasBody) {
      headers['Content-Type'] = contentType ?? 'application/json';
    }
    const res = await fetch(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text.length ? JSON.parse(text) : null;
    } catch {
      // ignore non-JSON response
    }

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      responseHeaders[k] = v;
    });

    if (!res.ok) {
      const details = typeof text === 'string' && text.length > 0 ? `: ${text}` : '';
      throw new ForgeError(`k8s request failed (${res.status})${details}`, res.status);
    }

    return { status: res.status, headers: responseHeaders, body: parsed };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ForgeError(`k8s request timeout after ${timeoutMs}ms`, 504);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new ForgeError(`k8s request error: ${message}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function postJson(
  url: string,
  {
    token,
    body,
    timeoutMs = 10_000,
  }: {
    token: string;
    body: unknown;
    timeoutMs?: number;
  }
): Promise<K8sPostJsonResult> {
  return requestJson(url, { token, method: 'POST', body, timeoutMs });
}
