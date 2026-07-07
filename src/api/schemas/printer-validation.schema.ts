import { z } from 'zod';

/** POST /printers/:id/validate — every field optional; unset fields fall back to the printer's current stored values. */
export const validatePrinterBodySchema = z
  .object({
    driver: z.string().min(1).optional(),
    connection: z.record(z.string(), z.unknown()).optional(),
    paperWidth: z.union([z.string(), z.number()]).optional(),
    profileId: z.string().min(1).optional(),
  })
  .optional();

export type ValidatePrinterBody = z.infer<typeof validatePrinterBodySchema>;
