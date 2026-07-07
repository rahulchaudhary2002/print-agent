import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ConfigService } from '../../config/index.js';
import { ForbiddenError } from '../errors/index.js';

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * Step 14 — by default this API only answers requests from the machine it's running on.
 * `config.allowRemote` is an explicit, deliberate opt-out for anyone who wants a LAN-reachable agent.
 */
export function createLocalOnlyHook(configService: ConfigService) {
  return async function localOnlyHook(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (configService.get('allowRemote')) {
      return;
    }
    const remoteAddress = request.ip;
    if (!LOOPBACK_ADDRESSES.has(remoteAddress)) {
      throw new ForbiddenError('This API only accepts local requests. Enable "allowRemote" in /config to change this.');
    }
  };
}
