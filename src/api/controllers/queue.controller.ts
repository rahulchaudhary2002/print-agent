import type { FastifyReply, FastifyRequest } from 'fastify';
import type { HealthService } from '../../pipeline/index.js';
import type { JobService, QueueWorker } from '../../queue/index.js';
import { success } from '../responses/index.js';

/** Step 9 — GET /queue, GET /queue/status, POST /queue/pause|resume|clear. */
export class QueueController {
  constructor(
    private readonly jobService: JobService,
    private readonly healthService: HealthService,
    private readonly queueWorker: QueueWorker,
  ) {}

  getQueue = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success(this.jobService.list('queued')));
  };

  getQueueStatus = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { queue } = await this.healthService.snapshot();
    void reply.send(success({ ...queue, paused: this.queueWorker.isPaused }));
  };

  pause = (_request: FastifyRequest, reply: FastifyReply): void => {
    this.queueWorker.pause();
    void reply.send(success({ paused: true }, 'Queue paused'));
  };

  resume = (_request: FastifyRequest, reply: FastifyReply): void => {
    this.queueWorker.resume();
    void reply.send(success({ paused: false }, 'Queue resumed'));
  };

  clear = (_request: FastifyRequest, reply: FastifyReply): void => {
    const cancelled = this.jobService.cancelAllQueued();
    void reply.send(success({ cancelled }, 'Queue cleared'));
  };
}
