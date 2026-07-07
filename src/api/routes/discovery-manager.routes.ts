import type { FastifyInstance } from 'fastify';
import type { DiscoveryManagerController } from '../controllers/index.js';
import { runDiscoveryBodySchema, validateBody } from '../schemas/index.js';

/** Step 15 — cached discovery results vs. an on-demand fresh scan. Distinct from the legacy `/printers/discover` sweep. */
export function registerDiscoveryManagerRoutes(app: FastifyInstance, controller: DiscoveryManagerController): void {
  app.get('/discovery', { schema: { tags: ['Discovery'], summary: 'Cached discovery results (added/removed/unchanged from the last scan)' } }, controller.getDiscovery);
  app.post(
    '/discovery/run',
    { preHandler: validateBody(runDiscoveryBodySchema), schema: { tags: ['Discovery'], summary: 'Run a fresh discovery scan now' } },
    controller.runDiscovery,
  );
}
