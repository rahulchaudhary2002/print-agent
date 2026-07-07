import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DiscoveryService } from '../../printer/index.js';
import { success } from '../responses/index.js';

/** Thin HTTP adapter over DiscoveryService — no business logic lives here. */
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  list = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const printers = await this.discoveryService.discoverAll();
    void reply.send(success(printers));
  };
}
