import { z } from 'zod';

export const networkDiscoveryOptionsSchema = z.object({
  hosts: z.array(z.string().min(1)).optional(),
  ports: z.array(z.number().int().positive()).optional(),
  timeoutMs: z.number().int().positive().optional(),
  concurrency: z.number().int().positive().optional(),
});

/** POST /discovery/run — body is entirely optional; omit it for a default subnet sweep. */
export const runDiscoveryBodySchema = z
  .object({
    network: networkDiscoveryOptionsSchema.optional(),
  })
  .optional();

export type RunDiscoveryBody = z.infer<typeof runDiscoveryBodySchema>;
