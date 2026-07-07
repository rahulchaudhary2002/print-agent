import type { FastifyInstance } from 'fastify';
import type { JobController } from '../controllers/index.js';
import {
  createJobSchema,
  jobHistoryQuerySchema,
  jobIdParamsSchema,
  listJobsQuerySchema,
  toOpenApiSchema,
  validateBody,
  validateParams,
  validateQuery,
} from '../schemas/index.js';

export function registerJobRoutes(app: FastifyInstance, controller: JobController): void {
  app.post(
    '/jobs',
    {
      preHandler: validateBody(createJobSchema),
      schema: { tags: ['Jobs'], summary: 'Submit a print job', body: toOpenApiSchema(createJobSchema) },
    },
    controller.create,
  );
  app.get(
    '/jobs',
    { preHandler: validateQuery(listJobsQuerySchema), schema: { tags: ['Jobs'], summary: 'List jobs (paginated, filterable, sortable)' } },
    controller.list,
  );
  app.get(
    '/jobs/pending',
    { preHandler: validateQuery(jobHistoryQuerySchema), schema: { tags: ['Jobs'], summary: 'List pending jobs' } },
    controller.listPending,
  );
  app.get(
    '/jobs/failed',
    { preHandler: validateQuery(jobHistoryQuerySchema), schema: { tags: ['Jobs'], summary: 'List failed jobs' } },
    controller.listFailed,
  );
  app.get(
    '/jobs/history',
    { preHandler: validateQuery(jobHistoryQuerySchema), schema: { tags: ['Jobs'], summary: 'List completed/failed/cancelled jobs' } },
    controller.listHistory,
  );
  app.delete('/jobs/completed', { schema: { tags: ['Jobs'], summary: 'Delete all completed jobs' } }, controller.clearCompleted);
  app.get(
    '/jobs/:id',
    { preHandler: validateParams(jobIdParamsSchema), schema: { tags: ['Jobs'], summary: 'Get a job by id' } },
    controller.getById,
  );
  app.get(
    '/jobs/:id/events',
    { preHandler: validateParams(jobIdParamsSchema), schema: { tags: ['Jobs'], summary: 'Get a job\'s lifecycle event history' } },
    controller.getEvents,
  );
  app.delete(
    '/jobs/:id',
    { preHandler: validateParams(jobIdParamsSchema), schema: { tags: ['Jobs'], summary: 'Delete a job' } },
    controller.delete,
  );
  app.post(
    '/jobs/:id/retry',
    { preHandler: validateParams(jobIdParamsSchema), schema: { tags: ['Jobs'], summary: 'Re-queue a failed job' } },
    controller.retry,
  );
  app.post(
    '/jobs/:id/cancel',
    { preHandler: validateParams(jobIdParamsSchema), schema: { tags: ['Jobs'], summary: 'Cancel a pending/queued job' } },
    controller.cancel,
  );
}
