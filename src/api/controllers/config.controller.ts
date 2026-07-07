import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ConfigService } from '../../config/index.js';
import type { UpdateConfigBody } from '../schemas/index.js';
import { success } from '../responses/index.js';

/** Step 5 — GET /config, PUT /config, POST /config/reset. */
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  getConfig = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success(this.configService.getAll()));
  };

  updateConfig = async (request: FastifyRequest<{ Body: UpdateConfigBody }>, reply: FastifyReply): Promise<void> => {
    const updated = await this.configService.update(request.body);
    void reply.send(success(updated, 'Configuration updated'));
  };

  resetConfig = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const reset = await this.configService.reset();
    void reply.send(success(reset, 'Configuration reset to defaults'));
  };
}
