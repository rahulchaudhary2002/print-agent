import type { ZodType } from 'zod';
import { z } from 'zod';

/** Converts a Zod schema into an OpenAPI-3-flavoured JSON Schema, used only for Swagger docs. */
export function toOpenApiSchema(schema: ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input' }) as Record<string, unknown>;
}
