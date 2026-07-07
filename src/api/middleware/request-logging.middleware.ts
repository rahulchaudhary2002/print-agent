import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { LoggerService } from '../../services/index.js';

/**
 * Step 11/19 — request ID propagation, per-request logging, and response timing, all in one
 * place. Fastify already generates `request.id`; this just (a) echoes it back as a response
 * header so callers can correlate, and (b) logs a single structured line per request/response.
 */
export function registerRequestLogging(app: FastifyInstance, logger: LoggerService): void {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('X-Request-Id', request.id);
    logger.info('Request received', { requestId: request.id, method: request.method, url: request.url });
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    logger.info('Request completed', {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
    });
  });
}
