import type { PrinterStatusValue } from '../printer/interfaces/index.js';

export interface PrintResult {
  success: boolean;
  jobId: string;
  durationMs: number;
  bytesPrinted: number;
  renderer: string | null;
  driver: string | null;
  warnings: string[];
  errors: string[];
  printerStatus: PrinterStatusValue | null;
  /** Only meaningful when `success` is false — whether QueueWorker should retry this job. */
  recoverable: boolean;
}

/**
 * Thrown for failures the pipeline itself can definitively classify (missing printer,
 * unsupported driver/renderer, invalid document). Driver/network failures surfacing as plain
 * `Error`s go through `classifyRecoverable()` instead — see error-classifier.util.ts.
 */
export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly recoverable: boolean,
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}
