import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DiscoveryManager, DiscoveryScheduler } from '../../printer/index.js';
import type { RunDiscoveryBody } from '../schemas/index.js';
import { success } from '../responses/index.js';

/** Thin HTTP adapter over DiscoveryManager/DiscoveryScheduler (Step 15) — GET reads the cache, POST triggers a real scan. */
export class DiscoveryManagerController {
  constructor(
    private readonly discoveryManager: DiscoveryManager,
    private readonly discoveryScheduler: DiscoveryScheduler,
  ) {}

  getDiscovery = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success(this.discoveryManager.getCached()));
  };

  runDiscovery = async (request: FastifyRequest<{ Body: RunDiscoveryBody }>, reply: FastifyReply): Promise<void> => {
    const diff = await this.discoveryScheduler.runManualScan(request.body);
    void reply.send(success(diff, `Discovery scan completed: ${diff.added.length} new, ${diff.removed.length} removed`));
  };
}
