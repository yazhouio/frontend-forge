import type { FastifyReply } from 'fastify';
import { ForgeError, type ForgeCore } from '@frontend-forge/forge-core';
import type { ExtensionManifest } from '../types.js';
import type { K8sConfig } from '../runtimeConfig.js';
import { joinUrl, postJson } from '../k8sClient.js';

export async function createJsBundleFromManifest(args: {
  forge: ForgeCore;
  k8s: K8sConfig;
  token: string;
  manifest: ExtensionManifest;
  name: string;
  extensionName: string;
  namespace: string | null;
  cluster: string | null;
  reply: FastifyReply;
}) {
  const { forge, k8s, token, manifest, name, extensionName, namespace, cluster, reply } = args;
  const files = await forge.buildProject(manifest, { build: true });
  const row: Record<string, string> = {};
  for (const f of files) {
    if (!f || typeof f !== 'object') continue;
    if (typeof f.path !== 'string' || typeof f.content !== 'string') continue;
    row[f.path] = Buffer.from(f.content, 'utf8').toString('base64');
  }
  if (!row['index.js']) {
    throw new ForgeError('build output is missing index.js', 500);
  }

  reply.log.info(
    {
      name,
      extensionName,
      namespace,
      cluster,
      k8sServer: k8s.server,
      outputFiles: Object.keys(row),
    },
    'K8s JSBundle create requested'
  );

  const manifestJson = JSON.stringify(manifest);
  if (manifestJson.length > 200_000) {
    throw new ForgeError('manifest is too large to store in annotations', 400);
  }

  const annotations: Record<string, string> = {
    'frontend-forge.io/manifest': manifestJson,
  };
  if (namespace) {
    annotations['meta.helm.sh/release-namespace'] = namespace;
  }

  const jsBundle = {
    apiVersion: 'extensions.kubesphere.io/v1alpha1',
    kind: 'JSBundle',
    metadata: {
      name,
      labels: {
        'kubesphere.io/extension-ref': extensionName,
      },
      annotations,
    },
    spec: { row },
    status: {
      state: 'Available',
    },
  };

  let path = '/apis/extensions.kubesphere.io/v1alpha1/jsbundles';
  if (cluster) {
    path = `/clusters/${cluster}${path}`;
  }
  const url = joinUrl(k8s.server, path);
  const result = await postJson(url, { token: token.trim(), body: jsBundle });
  reply.log.info(
    { name, extensionName, namespace, cluster, status: result.status },
    'K8s JSBundle create completed'
  );
  return { ok: true, name, extensionName, namespace, cluster, result: result.body };
}
