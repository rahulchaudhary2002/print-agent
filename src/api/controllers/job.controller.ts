import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrintJobEventRepository } from '../../database/repositories/index.js';
import type { JobService } from '../../queue/index.js';
import type { FindJobsOptions, PaginatedResult, PrintJob } from '../../queue/print-job.types.js';
import type { PaginationMeta } from '../schemas/common.schema.js';
import type { CreateJobBody, JobHistoryQuery, JobIdParams, ListJobsQuery } from '../schemas/index.js';
import { success } from '../responses/index.js';

const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'] as const;

function toPaginatedResponse(result: PaginatedResult<PrintJob>) {
  const meta: PaginationMeta = {
    page: Math.floor(result.offset / result.limit) + 1,
    pageSize: result.limit,
    total: result.total,
    totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
  };
  return { items: result.items, pagination: meta };
}

function toFindOptions(query: ListJobsQuery | JobHistoryQuery, overrides: Partial<FindJobsOptions> = {}): FindJobsOptions {
  return {
    printerId: query.printerId,
    applicationId: query.applicationId,
    type: query.type,
    createdFrom: query.createdFrom,
    createdTo: query.createdTo,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    ...overrides,
  };
}

/** Thin HTTP adapters over JobService — no business logic lives here. */
export class JobController {
  constructor(
    private readonly jobService: JobService,
    private readonly printJobEventRepository: PrintJobEventRepository,
  ) {}

  create = (request: FastifyRequest<{ Body: CreateJobBody }>, reply: FastifyReply): void => {
    void reply.status(201).send(success(this.jobService.create(request.body), 'Job created'));
  };

  list = (request: FastifyRequest<{ Querystring: ListJobsQuery }>, reply: FastifyReply): void => {
    const query = request.query;
    const result = this.jobService.listPaginated(toFindOptions(query, { status: query.status }));
    void reply.send(success(toPaginatedResponse(result)));
  };

  listPending = (request: FastifyRequest<{ Querystring: JobHistoryQuery }>, reply: FastifyReply): void => {
    const result = this.jobService.listPaginated(toFindOptions(request.query, { status: 'pending' }));
    void reply.send(success(toPaginatedResponse(result)));
  };

  listFailed = (request: FastifyRequest<{ Querystring: JobHistoryQuery }>, reply: FastifyReply): void => {
    const result = this.jobService.listPaginated(toFindOptions(request.query, { status: 'failed' }));
    void reply.send(success(toPaginatedResponse(result)));
  };

  /** No single `status` column value means "terminal", so fetch each terminal status and merge. */
  listHistory = (request: FastifyRequest<{ Querystring: JobHistoryQuery }>, reply: FastifyReply): void => {
    const query = request.query;
    const perStatus = TERMINAL_STATUSES.map((status) => this.jobService.listPaginated(toFindOptions(query, { status })));
    const items = perStatus
      .flatMap((page) => page.items)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, query.pageSize);
    const total = perStatus.reduce((sum, page) => sum + page.total, 0);
    const meta: PaginationMeta = {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
    void reply.send(success({ items, pagination: meta }));
  };

  getById = (request: FastifyRequest<{ Params: JobIdParams }>, reply: FastifyReply): void => {
    void reply.send(success(this.jobService.getById(request.params.id)));
  };

  getEvents = (request: FastifyRequest<{ Params: JobIdParams }>, reply: FastifyReply): void => {
    this.jobService.getById(request.params.id); // 404s if the job doesn't exist
    void reply.send(success(this.printJobEventRepository.findByJobId(request.params.id)));
  };

  delete = (request: FastifyRequest<{ Params: JobIdParams }>, reply: FastifyReply): void => {
    this.jobService.delete(request.params.id);
    void reply.status(204).send();
  };

  retry = (request: FastifyRequest<{ Params: JobIdParams }>, reply: FastifyReply): void => {
    void reply.send(success(this.jobService.retry(request.params.id), 'Job re-queued'));
  };

  cancel = (request: FastifyRequest<{ Params: JobIdParams }>, reply: FastifyReply): void => {
    void reply.send(success(this.jobService.cancel(request.params.id), 'Job cancelled'));
  };

  clearCompleted = (_request: FastifyRequest, reply: FastifyReply): void => {
    void reply.send(success({ deleted: this.jobService.clearCompleted() }, 'Completed jobs cleared'));
  };
}
