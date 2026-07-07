import { z } from 'zod';

export const printerProfileIdParamsSchema = z.object({ id: z.string().min(1) });

export const createPrinterProfileSchema = z.object({
  name: z.string().min(1),
  model: z.string().min(1).nullable().optional(),
  paperWidth: z.string().min(1),
  defaultRenderer: z.string().min(1),
  supportedDrivers: z.array(z.string().min(1)),
  encoding: z.string().min(1),
  capabilities: z.array(z.string().min(1)).optional(),
  imageSupport: z.boolean().optional(),
  qrSupport: z.boolean().optional(),
  barcodeSupport: z.boolean().optional(),
  cashDrawerSupport: z.boolean().optional(),
  cutSupport: z.boolean().optional(),
});

export const updatePrinterProfileSchema = createPrinterProfileSchema.partial();

/** POST /printers/:id/profile — links a (built-in or custom) profile to a registered printer. */
export const assignPrinterProfileSchema = z.object({
  profileId: z.string().min(1),
});

export type PrinterProfileIdParams = z.infer<typeof printerProfileIdParamsSchema>;
export type CreatePrinterProfileBody = z.infer<typeof createPrinterProfileSchema>;
export type UpdatePrinterProfileBody = z.infer<typeof updatePrinterProfileSchema>;
export type AssignPrinterProfileBody = z.infer<typeof assignPrinterProfileSchema>;
