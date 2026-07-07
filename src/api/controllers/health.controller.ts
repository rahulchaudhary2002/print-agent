import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ConfigService } from '../../config/index.js';
import type { HealthService } from '../../pipeline/index.js';
import { success } from '../responses/index.js';

/** Serves basic liveness/identity info plus the rich health snapshot (Step 7). */
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly healthService: HealthService,
  ) {}

  getRoot = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success({ name: 'Print Agent', version: this.configService.get('version') }));
  };

  getStatus = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success({ status: 'running' }));
  };

  getVersion = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success({ version: this.configService.get('version') }));
  };

  getHealth = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const snapshot = await this.healthService.snapshot();
    const statusCode = snapshot.status === 'unhealthy' ? 503 : 200;
    void reply.status(statusCode).send(success(snapshot, `Agent is ${snapshot.status}`));
  };
}
