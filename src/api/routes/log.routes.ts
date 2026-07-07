import type { FastifyInstance } from 'fastify';
import type { LogController } from '../controllers/index.js';
import { latestLogsQuerySchema, listLogsQuerySchema, validateQuery } from '../schemas/index.js';

export function registerLogRoutes(app: FastifyInstance, controller: LogController): void {
  app.get(
    '/logs',
    { preHandler: validateQuery(listLogsQuerySchema), schema: { tags: ['Logs'], summary: 'Query logs by level/module/date' } },
    controller.list,
  );
  app.get(
    '/logs/latest',
    { preHandler: validateQuery(latestLogsQuerySchema), schema: { tags: ['Logs'], summary: 'Most recent N log entries' } },
    controller.latest,
  );
  app.get(
    '/logs/errors',
    { preHandler: validateQuery(listLogsQuerySchema), schema: { tags: ['Logs'], summary: 'Error-level log entries only' } },
    controller.errors,
  );
  app.delete('/logs', { schema: { tags: ['Logs'], summary: 'Truncate the log file' } }, controller.clear);
}
