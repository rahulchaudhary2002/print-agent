import { randomUUID } from 'node:crypto';
import { serializeDocument, type PrintDocument } from '../document/index.js';
import type { PrinterRepository, PrintJobRepository } from '../database/repositories/index.js';
import { PipelineEventType, type PipelineEventEmitter } from '../events/index.js';
import { AppError } from '../utils/index.js';
import {
  DOCUMENT_JOB_TYPE,
  type CreateJobInput,
  type FindJobsOptions,
  type JobStatus,
  type PaginatedResult,
  type PrintJob,
} from './print-job.types.js';
import type { QueueService } from './queue.service.js';

const CANCELLABLE_STATUSES: readonly JobStatus[] = ['pending', 'queued'];

/** Orchestrates print job lifecycle: creation, cancellation, retry, and queries. */
export class JobService {
  private acceptingJobs = true;
  private maxQueueSize: number | undefined;

  constructor(
    private readonly printJobRepository: PrintJobRepository,
    private readonly printerRepository: PrinterRepository,
    private readonly queueService: QueueService,
    private readonly events?: PipelineEventEmitter,
  ) {}

  /** Called during graceful shutdown (Step 12) — new jobs are rejected with 503 once this is false. */
  setAcceptingJobs(accepting: boolean): void {
    this.acceptingJobs = accepting;
  }

  /** Config hot-reload (Step 7) — `AppConfig.queueSize`, enforced on the next `create()` call. */
  setMaxQueueSize(maxQueueSize: number | undefined): void {
    this.maxQueueSize = maxQueueSize;
  }

  create(input: CreateJobInput): PrintJob {
    if (!this.acceptingJobs) {
      throw new AppError('The print agent is shutting down and is not accepting new jobs', 503);
    }
    if (this.maxQueueSize !== undefined && this.queueService.size() >= this.maxQueueSize) {
      throw new AppError(`Queue is full (max ${this.maxQueueSize} jobs) — try again later`, 503);
    }
    if (input.printerId && !this.printerRepository.findById(input.printerId)) {
      throw new AppError(`Printer ${input.printerId} not found`, 404);
    }

    const now = new Date().toISOString();
    const job: PrintJob = {
      id: randomUUID(),
      printerId: input.printerId ?? null,
      applicationId: input.applicationId ?? null,
      type: input.type,
      payload: input.payload,
      status: 'pending',
      priority: input.priority ?? 0,
      retryCount: 0,
      error: null,
      createdAt: now,
      startedAt: null,
      finishedAt: null,
    };
    this.printJobRepository.create(job);

    return this.enqueue(job);
  }

  /** Stores a document as its serialized JSON payload rather than plain text — see DOCUMENT_JOB_TYPE. */
  createDocumentJob(
    document: PrintDocument,
    options: {
      printerId?: string | null | undefined;
      applicationId?: string | null | undefined;
      priority?: number | undefined;
    } = {},
  ): PrintJob {
    return this.create({
      printerId: options.printerId,
      applicationId: options.applicationId,
      priority: options.priority,
      type: DOCUMENT_JOB_TYPE,
      payload: serializeDocument(document),
    });
  }

  getById(id: string): PrintJob {
    const job = this.printJobRepository.findById(id);
    if (!job) {
      throw new AppError(`Print job ${id} not found`, 404);
    }
    return job;
  }

  list(status?: JobStatus): PrintJob[] {
    return this.printJobRepository.findAll(status);
  }

  /** The rich, paginated/filtered/sorted listing behind GET /jobs and its /pending, /failed, /history variants. */
  listPaginated(options: FindJobsOptions): PaginatedResult<PrintJob> {
    return this.printJobRepository.findPaginated(options);
  }

  cancel(id: string): PrintJob {
    const job = this.getById(id);
    if (!CANCELLABLE_STATUSES.includes(job.status)) {
      throw new AppError('Only pending or queued jobs can be cancelled', 409);
    }

    this.queueService.remove(id);
    const cancelled: PrintJob = { ...job, status: 'cancelled', finishedAt: new Date().toISOString() };
    this.printJobRepository.update(cancelled);
    this.emit(PipelineEventType.JobCancelled, cancelled.id);
    return cancelled;
  }

  retry(id: string): PrintJob {
    const job = this.getById(id);
    if (job.status !== 'failed') {
      throw new AppError('Only failed jobs can be retried', 409);
    }

    const reset: PrintJob = {
      ...job,
      status: 'pending',
      retryCount: 0,
      error: null,
      startedAt: null,
      finishedAt: null,
    };
    this.printJobRepository.update(reset);
    return this.enqueue(reset);
  }

  delete(id: string): void {
    this.getById(id);
    this.queueService.remove(id);
    this.printJobRepository.delete(id);
  }

  clearCompleted(): number {
    return this.printJobRepository.deleteByStatus('completed');
  }

  /** POST /queue/clear — empties the in-memory dispatch queue and marks the affected DB rows cancelled. */
  cancelAllQueued(): number {
    const queuedJobs = this.printJobRepository.findAll('queued');
    this.queueService.clear();
    const finishedAt = new Date().toISOString();
    for (const job of queuedJobs) {
      this.printJobRepository.update({ ...job, status: 'cancelled', finishedAt });
      this.emit(PipelineEventType.JobCancelled, job.id);
    }
    return queuedJobs.length;
  }

  /**
   * Crash recovery (Step 13): a restart loses the in-memory queue but not the database, so
   * every job that isn't in a terminal state gets put back — jobs caught mid-render/mid-print
   * are reset to `queued` first (we can't know how far they got), everything else just re-enqueues.
   */
  recoverPendingJobs(): void {
    const interrupted = [...this.printJobRepository.findAll('rendering'), ...this.printJobRepository.findAll('printing')];
    for (const job of interrupted) {
      const recovered: PrintJob = { ...job, status: 'queued', startedAt: null };
      this.printJobRepository.update(recovered);
      this.queueService.enqueue(recovered);
    }

    for (const job of this.printJobRepository.findAll('pending')) {
      this.enqueue(job, { skipEvent: true });
    }

    for (const job of this.printJobRepository.findAll('queued')) {
      this.queueService.enqueue(job);
    }
  }

  /** Marks a freshly-created/retried job `queued`, pushes it onto the in-memory queue, and reports it. */
  private enqueue(job: PrintJob, options: { skipEvent?: boolean } = {}): PrintJob {
    const queued: PrintJob = { ...job, status: 'queued' };
    this.printJobRepository.update(queued);
    this.queueService.enqueue(queued);
    if (!options.skipEvent) {
      this.emit(PipelineEventType.JobQueued, queued.id);
    }
    return queued;
  }

  private emit(type: PipelineEventType, jobId: string): void {
    this.events?.emitEvent(type, { jobId, timestamp: new Date().toISOString() });
  }
}
