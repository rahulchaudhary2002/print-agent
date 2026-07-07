import { z } from 'zod';

export const printerStatusSchema = z.enum(['online', 'offline', 'busy', 'unknown', 'error']);

export const createPrinterSchema = z.object({
  name: z.string().min(1),
  driver: z.string().min(1),
  connectionType: z.string().min(1),
  connection: z.record(z.string(), z.unknown()),
  isDefault: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export const updatePrinterSchema = z.object({
  name: z.string().min(1).optional(),
  driver: z.string().min(1).optional(),
  connectionType: z.string().min(1).optional(),
  connection: z.record(z.string(), z.unknown()).optional(),
  status: printerStatusSchema.optional(),
  isDefault: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export const printerIdParamsSchema = z.object({ id: z.string().min(1) });

export type CreatePrinterBody = z.infer<typeof createPrinterSchema>;
export type UpdatePrinterBody = z.infer<typeof updatePrinterSchema>;
export type PrinterIdParams = z.infer<typeof printerIdParamsSchema>;
