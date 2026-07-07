import type { FastifyInstance } from 'fastify';
import type { ServiceController } from '../controllers/index.js';

export function registerServiceRoutes(app: FastifyInstance, controller: ServiceController): void {
  app.get('/service/status', { schema: { tags: ['Service'], summary: 'Current service status, uptime, and PID' } }, controller.getStatus);
  app.post('/service/restart', { schema: { tags: ['Service'], summary: 'Restart every managed worker (queue, discovery, health, API)' } }, controller.restart);
  app.post('/service/reload', { schema: { tags: ['Service'], summary: 'Reload configuration from disk without restarting' } }, controller.reload);
  app.get('/service/workers', { schema: { tags: ['Service'], summary: 'Per-worker status and restart counts' } }, controller.getWorkers);
  app.get('/service/startup', { schema: { tags: ['Service'], summary: 'Startup stage timings from the last boot' } }, controller.getStartup);
  app.get('/service/uptime', { schema: { tags: ['Service'], summary: 'Application and service uptime' } }, controller.getUptime);
}
