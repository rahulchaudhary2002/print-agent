import { z } from 'zod';

export const jobStatusSchema = z.enum(['pending', 'queued', 'rendering', 'printing', 'completed', 'failed', 'cancelled']);

export const createJobSchema = z.object({
  printerId: z.string().min(1).optional(),
  type: z.string().min(1),
  payload: z.string().min(1),
  priority: z.number().int().optional(),
});

export const jobIdParamsSchema = z.object({ id: z.string().min(1) });

export const jobSortFieldSchema = z.enum(['createdAt', 'priority', 'status']);
export const sortOrderSchema = z.enum(['asc', 'desc']);

/** GET /jobs — Step 4: pagination + filtering + sorting, all via query string. */
export const listJobsQuerySchema = z.object({
  status: jobStatusSchema.optional(),
  printerId: z.string().min(1).optional(),
  applicationId: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  createdFrom: z.iso.datetime({ offset: true }).optional(),
  createdTo: z.iso.datetime({ offset: true }).optional(),
  sortBy: jobSortFieldSchema.optional(),
  sortOrder: sortOrderSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(500).default(50),
});

/** GET /jobs/history — same shape minus `status`, since history always means the terminal states. */
export const jobHistoryQuerySchema = listJobsQuerySchema.omit({ status: true });

export type CreateJobBody = z.infer<typeof createJobSchema>;
export type JobIdParams = z.infer<typeof jobIdParamsSchema>;
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
export type JobHistoryQuery = z.infer<typeof jobHistoryQuerySchema>;
