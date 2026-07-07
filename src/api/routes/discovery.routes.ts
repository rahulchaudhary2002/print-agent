import type { FastifyInstance } from 'fastify';
import type { DiscoveryController } from '../controllers/index.js';

/** Step 3 asks for POST /printers/discover; GET is kept too for backwards compatibility. */
export function registerDiscoveryRoutes(app: FastifyInstance, controller: DiscoveryController): void {
  const schema = { tags: ['Printers'], summary: 'Discover locally attached/network printers' };
  app.get('/printers/discover', { schema }, controller.list);
  app.post('/printers/discover', { schema }, controller.list);
}
