import type { FastifyInstance } from 'fastify';
import type { MetricsController } from '../controllers/index.js';

export function registerMetricsRoutes(app: FastifyInstance, controller: MetricsController): void {
  app.get(
    '/metrics',
    { schema: { tags: ['Metrics'], summary: 'Print counters, timings, bytes printed, driver usage' } },
    controller.getMetrics,
  );
}
