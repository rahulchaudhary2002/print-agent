import type { PrintJobRepository } from '../database/repositories/index.js';
import { PipelineEventType, type PipelineEventEmitter } from '../events/index.js';
import type { MetricsService, PrintPipelineService, PrintResult } from '../pipeline/index.js';
import type { LoggerService } from '../services/index.js';
import { DOCUMENT_JOB_TYPE, type JobStatus, type PrintJob } from './print-job.types.js';
import type { QueueService } from './queue.service.js';

export interface QueueWorkerOptions {
  /** How long to wait before checking an empty queue again. */
  pollIntervalMs?: number;
  maxRetries?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Drains the in-memory queue one job at a time via PrintPipelineService, persisting every
 * lifecycle transition (queued -> rendering/printing -> completed/failed) and retrying only
 * failures the pipeline classified as recoverable, up to `maxRetries`. Knows nothing about
 * drivers, renderers, or printers directly — PrintPipelineService is its only collaborator
 * for actually getting a job printed.
 */
export class QueueWorker {
  private running = false;
  private paused = false;
  private inFlight: Promise<void> | null = null;
  private pollIntervalMs: number;
  private maxRetries: number;

  constructor(
    private readonly queueService: QueueService,
    private readonly printJobRepository: PrintJobRepository,
    private readonly pipelineService: PrintPipelineService,
    private readonly events: PipelineEventEmitter,
    private readonly metricsService: MetricsService,
    private readonly logger: LoggerService,
    options: QueueWorkerOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? 500;
    this.maxRetries = options.maxRetries ?? 3;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.logger.info('Queue worker started');
    void this.loop();
  }

  /** Stops the loop from picking up new jobs. Does not wait for an in-flight job — use `drain()` for that. */
  stop(): void {
    this.running = false;
  }

  /** Graceful shutdown (Step 12): stop, then wait for whatever job is currently mid-flight to finish. */
  async drain(): Promise<void> {
    this.running = false;
    if (this.inFlight) {
      await this.inFlight;
    }
  }

  /** POST /queue/pause — leaves jobs sitting in the queue untouched, just stops dispatching them. */
  pause(): void {
    this.paused = true;
    this.logger.info('Queue worker paused');
  }

  /** POST /queue/resume. */
  resume(): void {
    this.paused = false;
    this.logger.info('Queue worker resumed');
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Service watchdog (Step 8) reads this to report worker status without a separate "started" flag. */
  get isRunning(): boolean {
    return this.running;
  }

  /** Config hot-reload (Step 7) — applied on the next retry decision, no restart needed. */
  setMaxRetries(maxRetries: number): void {
    this.maxRetries = maxRetries;
  }

  /** Config hot-reload (Step 7) — applied on the next poll iteration. */
  setPollIntervalMs(pollIntervalMs: number): void {
    this.pollIntervalMs = pollIntervalMs;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      if (this.paused) {
        await delay(this.pollIntervalMs);
        continue;
      }
      const job = this.queueService.dequeue();
      if (!job) {
        await delay(this.pollIntervalMs);
        continue;
      }
      this.inFlight = this.processJob(job);
      await this.inFlight;
      this.inFlight = null;
    }
  }

  private async processJob(job: PrintJob): Promise<void> {
    const queueTimeMs = Date.now() - new Date(job.createdAt).getTime();
    this.events.emitEvent(PipelineEventType.JobStarted, {
      jobId: job.id,
      timestamp: new Date().toISOString(),
      metadata: { queueTimeMs },
    });

    const startingStatus: JobStatus = job.type === DOCUMENT_JOB_TYPE ? 'rendering' : 'printing';
    const startedJob: PrintJob = { ...job, status: startingStatus, startedAt: new Date().toISOString() };
    this.printJobRepository.update(startedJob);
    this.logger.info('Processing print job', { jobId: job.id, type: job.type, queueTimeMs });

    const result = await this.pipelineService.execute(startedJob);

    if (result.success) {
      this.completeJob(startedJob, result);
    } else {
      this.handleFailure(startedJob, result);
    }
  }

  private completeJob(job: PrintJob, result: PrintResult): void {
    const completedJob: PrintJob = { ...job, status: 'completed', finishedAt: new Date().toISOString() };
    this.printJobRepository.update(completedJob);
    this.events.emitEvent(PipelineEventType.JobCompleted, {
      jobId: job.id,
      timestamp: new Date().toISOString(),
      metadata: {
        durationMs: result.durationMs,
        bytesPrinted: result.bytesPrinted,
        renderer: result.renderer,
        driver: result.driver,
      },
    });
    this.logger.info('Print job completed', { jobId: job.id, durationMs: result.durationMs, bytes: result.bytesPrinted });
  }

  private handleFailure(job: PrintJob, result: PrintResult): void {
    const message = result.errors[0] ?? 'Unknown processing error';
    const retryCount = job.retryCount + 1;

    if (result.recoverable && retryCount < this.maxRetries) {
      const retriedJob: PrintJob = { ...job, status: 'queued', retryCount, error: message, startedAt: null };
      this.printJobRepository.update(retriedJob);
      this.metricsService.recordRetry();
      this.logger.warn('Print job failed, re-queuing', { jobId: job.id, retryCount, error: message });
      this.queueService.enqueue(retriedJob);
      return;
    }

    const failedJob: PrintJob = { ...job, status: 'failed', retryCount, error: message, finishedAt: new Date().toISOString() };
    this.printJobRepository.update(failedJob);
    this.events.emitEvent(PipelineEventType.JobFailed, {
      jobId: job.id,
      timestamp: new Date().toISOString(),
      metadata: { error: message, recoverable: result.recoverable, retryCount },
    });
    this.logger.error('Print job failed permanently', { jobId: job.id, retryCount, error: message, recoverable: result.recoverable });
  }
}
