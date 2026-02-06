import type { FastifyRequest } from 'fastify';
import { ForgeError } from '@frontend-forge/forge-core';
import type { K8sConfig } from '../runtimeConfig.js';

export function requireK8sConfig(k8s?: K8sConfig): K8sConfig {
  if (!k8s?.server) {
    throw new ForgeError('k8s config is required (config.json: k8s.server)', 500);
  }
  return k8s;
}

export function requireAuthToken(req: FastifyRequest, k8s: K8sConfig): string {
  const cookieName = k8s.tokenCookieName || 'token';
  const token = req.cookies?.[cookieName];
  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new ForgeError(`auth token is required (cookie: ${cookieName})`, 401);
  }
  return token.trim();
}
