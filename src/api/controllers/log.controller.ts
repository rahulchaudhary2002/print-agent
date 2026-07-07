import type { FastifyReply, FastifyRequest } from 'fastify';
import type { LogQueryService } from '../../services/index.js';
import type { LatestLogsQuery, ListLogsQuery } from '../schemas/index.js';
import { success } from '../responses/index.js';

/** Step 6 — GET /logs, GET /logs/latest, GET /logs/errors, DELETE /logs. */
export class LogController {
  constructor(private readonly logQueryService: LogQueryService) {}

  list = async (request: FastifyRequest<{ Querystring: ListLogsQuery }>, reply: FastifyReply): Promise<void> => {
    const entries = await this.logQueryService.query(request.query);
    void reply.send(success(entries));
  };

  latest = async (request: FastifyRequest<{ Querystring: LatestLogsQuery }>, reply: FastifyReply): Promise<void> => {
    const entries = await this.logQueryService.latest(request.query.count);
    void reply.send(success(entries));
  };

  errors = async (request: FastifyRequest<{ Querystring: ListLogsQuery }>, reply: FastifyReply): Promise<void> => {
    const entries = await this.logQueryService.errors(request.query);
    void reply.send(success(entries));
  };

  clear = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await this.logQueryService.clear();
    void reply.send(success(null, 'Logs cleared'));
  };
}
