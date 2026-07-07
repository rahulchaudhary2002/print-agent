import type { FastifyReply, FastifyRequest } from 'fastify';
import type { MetricsService } from '../../pipeline/index.js';
import { success } from '../responses/index.js';

/** Step 8 — GET /metrics. */
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  getMetrics = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success(this.metricsService.snapshot()));
  };
}
