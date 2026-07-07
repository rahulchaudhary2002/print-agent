import { z } from 'zod';

export const paperWidthSchema = z.enum(['58mm', '72mm', '80mm']);
export const loggingLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

/** PUT /config — every field optional; only the ones present get changed (Step 5). */
export const updateConfigSchema = z.object({
  defaultPrinterId: z.string().min(1).nullable().optional(),
  paperWidth: paperWidthSchema.optional(),
  autoCut: z.boolean().optional(),
  loggingLevel: loggingLevelSchema.optional(),
  queueSize: z.number().int().positive().optional(),
  retryCount: z.number().int().positive().optional(),
  renderTimeoutMs: z.number().int().positive().optional(),
  printTimeoutMs: z.number().int().positive().optional(),
  allowRemote: z.boolean().optional(),
  requireApiKey: z.boolean().optional(),
  corsOrigins: z.array(z.string().min(1)).optional(),
  rateLimitMax: z.number().int().positive().optional(),
  rateLimitWindowMs: z.number().int().positive().optional(),
  discoveryIntervalMs: z.number().int().positive().optional(),
});

export type UpdateConfigBody = z.infer<typeof updateConfigSchema>;
