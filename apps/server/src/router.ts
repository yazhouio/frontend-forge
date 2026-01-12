import type { FastifyInstance } from 'fastify';
import type { ForgeCore } from '@frontend-forge/forge-core';
import type { BuildRequestBody, PageSchemaRequestBody, ProjectManifestRequestBody } from './types.js';
import { createController } from './controller.js';

export type RouterOptions = {
  forge: ForgeCore;
};

export default async function router(app: FastifyInstance, opts: RouterOptions) {
  const controller = createController(opts);

  app.get('/healthz', controller.healthz);

  app.post<{ Body: BuildRequestBody }>('/build', async (req, reply) => {
    return controller.build(req.body, reply);
  });

  app.post<{ Body: PageSchemaRequestBody }>('/page/code', async (req, reply) => {
    return controller.pageCode(req.body, reply);
  });

  app.post<{ Body: ProjectManifestRequestBody }>('/project/files', async (req, reply) => {
    return controller.projectFiles(req.body, reply);
  });

  app.post<{ Body: ProjectManifestRequestBody }>('/project/files.tar.gz', async (req, reply) => {
    return controller.projectFilesTarGz(req.body, reply);
  });

  app.post<{ Body: ProjectManifestRequestBody }>('/project/build', async (req, reply) => {
    return controller.projectBuild(req.body, reply);
  });

  app.post<{ Body: ProjectManifestRequestBody }>('/project/build.tar.gz', async (req, reply) => {
    return controller.projectBuildTarGz(req.body, reply);
  });
}
