import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import type { LoggerService } from '../../services/index.js';
import { AppError } from '../../utils/index.js';
import { failure } from '../responses/index.js';
import { ValidationError } from './api-errors.js';

/** Fastify's global error handler (Step 11/19) — every uncaught error becomes the standard envelope. */
export function createErrorHandler(logger: LoggerService) {
  return function errorHandler(error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply): void {
    const statusCode = error instanceof AppError ? error.statusCode : (error.statusCode ?? 500);
    const issues = error instanceof ValidationError ? error.issues : [];

    logger.error(error.message, {
      requestId: request.id,
      url: request.url,
      method: request.method,
      statusCode,
      validation: issues.length > 0,
    });

    void reply.status(statusCode).send(failure(error.message || 'Internal Server Error', issues));
  };
}

/** Fastify's 404 handler, in the same envelope shape as every other response. */
export function createNotFoundHandler(logger: LoggerService) {
  return function notFoundHandler(request: FastifyRequest, reply: FastifyReply): void {
    const message = `Route ${request.method} ${request.url} not found`;
    logger.warn(message, { requestId: request.id });
    void reply.status(404).send(failure(message));
  };
}
