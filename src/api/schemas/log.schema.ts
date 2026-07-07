import { z } from 'zod';

export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

/** GET /logs — Step 6: filter by date/level/module. */
export const listLogsQuerySchema = z.object({
  level: logLevelSchema.optional(),
  module: z.string().min(1).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
});

export const latestLogsQuerySchema = z.object({
  count: z.coerce.number().int().positive().max(1000).default(100),
});

export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>;
export type LatestLogsQuery = z.infer<typeof latestLogsQuerySchema>;
