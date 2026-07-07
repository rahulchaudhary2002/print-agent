import type { FastifyInstance } from 'fastify';
import type { CloudController } from '../controllers/index.js';

export function registerCloudRoutes(app: FastifyInstance, controller: CloudController): void {
  app.get('/cloud/status', controller.getStatus);
  app.post('/cloud/connect', controller.connect);
  app.post('/cloud/disconnect', controller.disconnect);
  app.post('/cloud/register', controller.register);
  app.post('/cloud/reconnect', controller.reconnect);
  app.get('/cloud/diagnostics', controller.getDiagnostics);
  app.get('/cloud/config', controller.getConfig);
}
