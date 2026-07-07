import { z } from 'zod';

/** POST /applications — Step 15's example: `{ name, version, vendor }`. */
export const registerApplicationSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1).optional(),
  vendor: z.string().min(1).optional(),
  webhookUrl: z.url().optional(),
  allowedFeatures: z.array(z.string().min(1)).optional(),
});

export const applicationIdParamsSchema = z.object({ id: z.string().min(1) });

export type RegisterApplicationBody = z.infer<typeof registerApplicationSchema>;
export type ApplicationIdParams = z.infer<typeof applicationIdParamsSchema>;
