import type { FastifyInstance } from 'fastify';
import type { ApplicationController } from '../controllers/index.js';
import { applicationIdParamsSchema, registerApplicationSchema, toOpenApiSchema, validateBody, validateParams } from '../schemas/index.js';

export function registerApplicationRoutes(app: FastifyInstance, controller: ApplicationController): void {
  app.post(
    '/applications',
    {
      preHandler: validateBody(registerApplicationSchema),
      schema: {
        tags: ['Applications'],
        summary: 'Register a local application; returns a one-time apiSecret',
        body: toOpenApiSchema(registerApplicationSchema),
      },
    },
    controller.register,
  );
  app.get('/applications', { schema: { tags: ['Applications'], summary: 'List registered applications' } }, controller.list);
  app.get(
    '/applications/:id',
    { preHandler: validateParams(applicationIdParamsSchema), schema: { tags: ['Applications'], summary: 'Get an application by id' } },
    controller.getById,
  );
  app.put(
    '/applications/:id/enable',
    { preHandler: validateParams(applicationIdParamsSchema), schema: { tags: ['Applications'], summary: 'Enable an application' } },
    controller.enable,
  );
  app.put(
    '/applications/:id/disable',
    { preHandler: validateParams(applicationIdParamsSchema), schema: { tags: ['Applications'], summary: 'Disable an application' } },
    controller.disable,
  );
  app.delete(
    '/applications/:id',
    { preHandler: validateParams(applicationIdParamsSchema), schema: { tags: ['Applications'], summary: 'Delete an application' } },
    controller.delete,
  );
}
