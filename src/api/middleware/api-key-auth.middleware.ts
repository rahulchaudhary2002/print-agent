import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApplicationService } from '../../applications/index.js';
import type { ConfigService } from '../../config/index.js';
import { UnauthorizedError } from '../errors/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set once the API-key preHandler succeeds — `null` when the request wasn't authenticated at all. */
    application?: { id: string; name: string } | null;
  }
}

/**
 * Step 14/15 — optional (off by default; `config.requireApiKey` opts in). When enabled, every
 * request must present `X-Api-Key`/`X-Api-Secret` headers matching a registered Application, so
 * job creation can attribute "which application created this" without trusting a client-supplied field.
 */
export function createApiKeyAuthHook(configService: ConfigService, applicationService: ApplicationService) {
  return async function apiKeyAuthHook(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!configService.get('requireApiKey')) {
      request.application = null;
      return;
    }

    const apiKey = request.headers['x-api-key'];
    const apiSecret = request.headers['x-api-secret'];
    if (typeof apiKey !== 'string' || typeof apiSecret !== 'string') {
      throw new UnauthorizedError('Missing X-Api-Key/X-Api-Secret headers');
    }

    const application = applicationService.verifyCredentials(apiKey, apiSecret);
    if (!application) {
      throw new UnauthorizedError('Invalid API credentials');
    }
    request.application = { id: application.id, name: application.name };
  };
}
