import type { FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { ZodType } from 'zod';
import { ValidationError } from '../errors/index.js';

function toValidationError(result: { success: false; error: { issues: { message: string; path: PropertyKey[] }[] } }): ValidationError {
  const issues = result.error.issues.map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message));
  return new ValidationError(issues.join('; '), issues);
}

/** Fastify preHandler factory that validates and replaces `request.body` using a Zod schema. */
export function validateBody<T>(schema: ZodType<T>): preHandlerHookHandler {
  return async (request: FastifyRequest): Promise<void> => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      throw toValidationError(result);
    }
    request.body = result.data;
  };
}

/** Fastify preHandler factory that validates and replaces `request.query` using a Zod schema. */
export function validateQuery<T>(schema: ZodType<T>): preHandlerHookHandler {
  return async (request: FastifyRequest): Promise<void> => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      throw toValidationError(result);
    }
    request.query = result.data;
  };
}

/** Fastify preHandler factory that validates and replaces `request.params` using a Zod schema. */
export function validateParams<T>(schema: ZodType<T>): preHandlerHookHandler {
  return async (request: FastifyRequest): Promise<void> => {
    const result = schema.safeParse(request.params);
    if (!result.success) {
      throw toValidationError(result);
    }
    request.params = result.data;
  };
}
