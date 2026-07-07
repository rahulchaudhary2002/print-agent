import { EventEmitter } from 'node:events';

export enum PipelineEventType {
  JobQueued = 'job.queued',
  JobStarted = 'job.started',
  RenderingStarted = 'rendering.started',
  RenderingCompleted = 'rendering.completed',
  PrintingStarted = 'printing.started',
  PrintingCompleted = 'printing.completed',
  JobCompleted = 'job.completed',
  JobFailed = 'job.failed',
  JobCancelled = 'job.cancelled',
}

export interface PipelineEventPayload {
  jobId: string;
  timestamp: string;
  message?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * The connective tissue for the pipeline's cross-cutting concerns: MetricsService and the
 * durable event trail (print_job_events, behind GET /jobs/:id/events) both subscribe here
 * instead of PrintPipelineService/QueueWorker calling them directly.
 */
export class PipelineEventEmitter extends EventEmitter {
  emitEvent(type: PipelineEventType, payload: PipelineEventPayload): void {
    this.emit(type, payload);
    this.emit('event', type, payload);
  }
}
