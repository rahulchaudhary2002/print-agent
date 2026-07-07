import type { FastifyInstance } from 'fastify';
import type { HealthController } from '../controllers/index.js';

export function registerHealthRoutes(app: FastifyInstance, controller: HealthController): void {
  app.get('/', { schema: { tags: ['Health'], summary: 'Basic agent identity' } }, controller.getRoot);
  app.get('/status', { schema: { tags: ['Health'], summary: 'Liveness check' } }, controller.getStatus);
  app.get('/version', { schema: { tags: ['Health'], summary: 'Agent version' } }, controller.getVersion);
  app.get(
    '/health',
    { schema: { tags: ['Health'], summary: 'Full health snapshot (DB, queue, memory, CPU, disk, printers)' } },
    controller.getHealth,
  );
}
