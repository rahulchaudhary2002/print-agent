import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApplicationService } from '../../applications/index.js';
import type { ApplicationIdParams, RegisterApplicationBody } from '../schemas/index.js';
import { success } from '../responses/index.js';

/** Step 15 — local application registration; no cloud round-trip involved. */
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  register = (request: FastifyRequest<{ Body: RegisterApplicationBody }>, reply: FastifyReply): void => {
    const created = this.applicationService.register(request.body);
    void reply.status(201).send(success(created, 'Application registered — store the apiSecret now, it will not be shown again'));
  };

  list = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success(this.applicationService.list()));
  };

  getById = (request: FastifyRequest<{ Params: ApplicationIdParams }>, reply: FastifyReply): void => {
    void reply.send(success(this.applicationService.getById(request.params.id)));
  };

  enable = (request: FastifyRequest<{ Params: ApplicationIdParams }>, reply: FastifyReply): void => {
    void reply.send(success(this.applicationService.enable(request.params.id), 'Application enabled'));
  };

  disable = (request: FastifyRequest<{ Params: ApplicationIdParams }>, reply: FastifyReply): void => {
    void reply.send(success(this.applicationService.disable(request.params.id), 'Application disabled'));
  };

  delete = (request: FastifyRequest<{ Params: ApplicationIdParams }>, reply: FastifyReply): void => {
    this.applicationService.delete(request.params.id);
    void reply.status(204).send();
  };
}
