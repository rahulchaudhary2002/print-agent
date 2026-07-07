import type { FastifyInstance } from 'fastify';
import type { QueueController } from '../controllers/index.js';

export function registerQueueRoutes(app: FastifyInstance, controller: QueueController): void {
  app.get('/queue', { schema: { tags: ['Queue'], summary: 'List queued jobs' } }, controller.getQueue);
  app.get('/queue/status', { schema: { tags: ['Queue'], summary: 'Queue length, oldest pending age, paused state' } }, controller.getQueueStatus);
  app.post('/queue/pause', { schema: { tags: ['Queue'], summary: 'Pause dispatching (jobs stay queued)' } }, controller.pause);
  app.post('/queue/resume', { schema: { tags: ['Queue'], summary: 'Resume dispatching' } }, controller.resume);
  app.post('/queue/clear', { schema: { tags: ['Queue'], summary: 'Cancel every currently queued job' } }, controller.clear);
}
