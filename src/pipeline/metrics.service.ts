import { PipelineEventType, type PipelineEventEmitter, type PipelineEventPayload } from '../events/index.js';

export interface MetricsSnapshot {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  averageRenderTimeMs: number;
  averagePrintTimeMs: number;
  averageQueueTimeMs: number;
  bytesPrinted: number;
  retries: number;
  /** Completed-job count per driver name (e.g. `{ network: 12, "escpos-usb": 3 }`) — Step 8. */
  driverUsage: Record<string, number>;
}

function readNumber(payload: PipelineEventPayload, key: string): number | undefined {
  const value = payload.metadata?.[key];
  return typeof value === 'number' ? value : undefined;
}

function readString(payload: PipelineEventPayload, key: string): string | undefined {
  const value = payload.metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

/** Passively aggregates counters by subscribing to PipelineEventEmitter — never called directly by the pipeline. */
export class MetricsService {
  private totalJobs = 0;
  private completedJobs = 0;
  private failedJobs = 0;
  private cancelledJobs = 0;
  private bytesPrinted = 0;
  private retries = 0;

  private renderTimeTotalMs = 0;
  private renderSamples = 0;
  private printTimeTotalMs = 0;
  private printSamples = 0;
  private queueTimeTotalMs = 0;
  private queueSamples = 0;
  private readonly driverUsage: Record<string, number> = {};

  constructor(events: PipelineEventEmitter) {
    events.on(PipelineEventType.JobQueued, () => {
      this.totalJobs += 1;
    });
    events.on(PipelineEventType.JobStarted, (payload: PipelineEventPayload) => {
      const queueTimeMs = readNumber(payload, 'queueTimeMs');
      if (queueTimeMs !== undefined) {
        this.queueTimeTotalMs += queueTimeMs;
        this.queueSamples += 1;
      }
    });
    events.on(PipelineEventType.RenderingCompleted, (payload: PipelineEventPayload) => {
      const durationMs = readNumber(payload, 'durationMs');
      if (durationMs !== undefined) {
        this.renderTimeTotalMs += durationMs;
        this.renderSamples += 1;
      }
    });
    events.on(PipelineEventType.PrintingCompleted, (payload: PipelineEventPayload) => {
      const durationMs = readNumber(payload, 'durationMs');
      if (durationMs !== undefined) {
        this.printTimeTotalMs += durationMs;
        this.printSamples += 1;
      }
    });
    events.on(PipelineEventType.JobCompleted, (payload: PipelineEventPayload) => {
      this.completedJobs += 1;
      const bytes = readNumber(payload, 'bytesPrinted');
      if (bytes !== undefined) {
        this.bytesPrinted += bytes;
      }
      const driver = readString(payload, 'driver');
      if (driver) {
        this.driverUsage[driver] = (this.driverUsage[driver] ?? 0) + 1;
      }
    });
    events.on(PipelineEventType.JobFailed, () => {
      this.failedJobs += 1;
    });
    events.on(PipelineEventType.JobCancelled, () => {
      this.cancelledJobs += 1;
    });
  }

  /** Retries are a QueueWorker decision, not a pipeline stage — recorded directly, not via an event. */
  recordRetry(): void {
    this.retries += 1;
  }

  snapshot(): MetricsSnapshot {
    const average = (total: number, samples: number): number => (samples > 0 ? Math.round(total / samples) : 0);
    return {
      totalJobs: this.totalJobs,
      completedJobs: this.completedJobs,
      failedJobs: this.failedJobs,
      cancelledJobs: this.cancelledJobs,
      averageRenderTimeMs: average(this.renderTimeTotalMs, this.renderSamples),
      averagePrintTimeMs: average(this.printTimeTotalMs, this.printSamples),
      averageQueueTimeMs: average(this.queueTimeTotalMs, this.queueSamples),
      bytesPrinted: this.bytesPrinted,
      retries: this.retries,
      driverUsage: { ...this.driverUsage },
    };
  }
}
