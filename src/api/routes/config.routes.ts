import type { FastifyInstance } from 'fastify';
import type { ConfigController } from '../controllers/index.js';
import { toOpenApiSchema, updateConfigSchema, validateBody } from '../schemas/index.js';

export function registerConfigRoutes(app: FastifyInstance, controller: ConfigController): void {
  app.get('/config', { schema: { tags: ['Config'], summary: 'Get current agent configuration' } }, controller.getConfig);
  app.put(
    '/config',
    {
      preHandler: validateBody(updateConfigSchema),
      schema: {
        tags: ['Config'],
        summary: 'Update mutable settings (default printer, paper width, auto cut, logging, timeouts, security)',
        body: toOpenApiSchema(updateConfigSchema),
      },
    },
    controller.updateConfig,
  );
  app.post('/config/reset', { schema: { tags: ['Config'], summary: 'Reset configuration to defaults' } }, controller.resetConfig);
}
