import { z } from 'zod';

export const idParamsSchema = z.object({ id: z.string().min(1) });
export type IdParams = z.infer<typeof idParamsSchema>;

/** Shared `?page=&pageSize=` query parameters — Fastify query strings arrive as strings, hence `coerce`. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(500).default(50),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
