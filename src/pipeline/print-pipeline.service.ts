import { randomUUID } from 'node:crypto';
import { deserializeDocument, type DocumentRenderer, type RendererFactoryFn, type RendererRegistry } from '../document/index.js';
import type { PrinterRepository, PrintJobEventRepository } from '../database/repositories/index.js';
import type { PrinterManager } from '../printer/manager/index.js';
import { PrinterStatusValue, type PrintPayload } from '../printer/interfaces/index.js';
import { DOCUMENT_JOB_TYPE, type PrintJob } from '../queue/print-job.types.js';
import type { LoggerService } from '../services/index.js';
import { PipelineEventType, type PipelineEventEmitter } from '../events/index.js';
import { classifyRecoverable } from './error-classifier.util.js';
import type { ResolvedPipelineConfig } from './pipeline-config.js';
import { PipelineError, type PrintResult } from './pipeline.types.js';
import { resolveRendererType } from './renderer-resolver.js';
import { withTimeout } from './timeout.util.js';

/**
 * The single place that knows about renderers, drivers (via PrinterManager), repositories, and
 * the queue's job shape all at once — everything else in the app only knows a slice of this.
 * Renders a document job, sends bytes (or a raw payload) to the driver, and reports what happened.
 * Never decides retry-vs-fail on its own; QueueWorker owns that using `PrintResult.errors` +
 * the thrown error's recoverability.
 */
export class PrintPipelineService {
  /** Renderer instances are reused across jobs (Step 15) — keyed by type + the config that shaped them. */
  private readonly rendererCache = new Map<string, DocumentRenderer>();

  constructor(
    private readonly printerRepository: PrinterRepository,
    private readonly printerManager: PrinterManager,
    private readonly rendererRegistry: RendererRegistry,
    private readonly printJobEventRepository: PrintJobEventRepository,
    private readonly events: PipelineEventEmitter,
    private readonly logger: LoggerService,
    private readonly config: ResolvedPipelineConfig,
  ) {}

  async execute(job: PrintJob): Promise<PrintResult> {
    const startedAt = Date.now();
    const warnings: string[] = [];
    let rendererType: string | null = null;
    let driverName: string | null = null;
    let bytesPrinted = 0;
    let printerStatus: PrinterStatusValue | null = null;

    try {
      // 1. Validate job
      if (!job.printerId) {
        throw new PipelineError('Print job has no printer assigned', false);
      }

      // 2. Load printer
      const printer = this.printerRepository.findById(job.printerId);
      if (!printer) {
        throw new PipelineError(`Printer ${job.printerId} not found`, false);
      }
      if (!printer.enabled) {
        throw new PipelineError(`Printer "${printer.name}" is disabled`, false);
      }
      driverName = printer.driver;

      let payload: PrintPayload;
      if (job.type === DOCUMENT_JOB_TYPE) {
        // 3. Select renderer (by capability, never by driver name)
        const capabilities = await this.printerManager.getCapabilities(printer.id);
        const resolvedRendererType = resolveRendererType(capabilities);
        if (!resolvedRendererType) {
          throw new PipelineError(
            `Printer "${printer.name}" (driver "${printer.driver}") has no renderer-compatible capability`,
            false,
          );
        }
        const rendererFactory = this.rendererRegistry.find(resolvedRendererType);
        if (!rendererFactory) {
          throw new PipelineError(`Renderer "${resolvedRendererType}" is not registered`, false);
        }
        rendererType = resolvedRendererType;

        // 4. Execute rendering
        this.emit(PipelineEventType.RenderingStarted, job.id, { renderer: rendererType });
        const renderStartedAt = Date.now();
        const document = deserializeDocument(job.payload);
        const renderer = this.getOrCreateRenderer(resolvedRendererType, rendererFactory, printer.connection);
        await renderer.initialize();
        const output = await withTimeout(
          renderer.render(document),
          this.config.renderTimeoutMs,
          `Rendering timed out after ${this.config.renderTimeoutMs}ms`,
        );
        if (!Buffer.isBuffer(output)) {
          throw new PipelineError(`Renderer "${resolvedRendererType}" did not return a Buffer`, false);
        }
        bytesPrinted = output.length;
        const renderDurationMs = Date.now() - renderStartedAt;
        this.emit(PipelineEventType.RenderingCompleted, job.id, {
          renderer: rendererType,
          bytes: bytesPrinted,
          durationMs: renderDurationMs,
        });
        payload = { type: 'base64', payload: output.toString('base64') };
      } else {
        // Legacy plain-text jobs bypass rendering entirely and go straight to the driver.
        payload = { type: job.type, payload: job.payload };
      }

      // 5. Select driver + 6. Execute printing (PrinterManager owns driver resolution/reuse)
      this.emit(PipelineEventType.PrintingStarted, job.id, { printerId: printer.id, driver: printer.driver });
      const printStartedAt = Date.now();
      const result = await withTimeout(
        this.printerManager.sendJob(printer.id, payload),
        this.config.printTimeoutMs,
        `Printing timed out after ${this.config.printTimeoutMs}ms`,
      );
      const printDurationMs = Date.now() - printStartedAt;
      printerStatus = await this.printerManager.getStatus(printer.id).catch(() => null);

      if (!result.success) {
        throw new PipelineError(result.message, classifyRecoverable(new Error(result.message)));
      }
      this.emit(PipelineEventType.PrintingCompleted, job.id, { durationMs: printDurationMs });

      return {
        success: true,
        jobId: job.id,
        durationMs: Date.now() - startedAt,
        bytesPrinted,
        renderer: rendererType,
        driver: driverName,
        warnings,
        errors: [],
        printerStatus,
        recoverable: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const recoverable = classifyRecoverable(error);
      this.logger.error('Pipeline execution failed', { jobId: job.id, error: message, recoverable });
      return {
        success: false,
        jobId: job.id,
        durationMs: Date.now() - startedAt,
        bytesPrinted,
        renderer: rendererType,
        driver: driverName,
        warnings,
        errors: [message],
        printerStatus,
        recoverable,
      };
    }
  }

  private emit(type: PipelineEventType, jobId: string, metadata: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    this.events.emitEvent(type, { jobId, timestamp, metadata });
    this.printJobEventRepository.create({
      id: randomUUID(),
      jobId,
      eventType: type,
      message: null,
      metadata,
      createdAt: timestamp,
    });
    this.logger.debug(type, { jobId, ...metadata });
  }

  private getOrCreateRenderer(
    rendererType: string,
    factory: RendererFactoryFn,
    connection: Record<string, unknown>,
  ): DocumentRenderer {
    const cacheKey = `${rendererType}:${JSON.stringify(connection)}`;
    const cached = this.rendererCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const renderer = factory(connection);
    this.rendererCache.set(cacheKey, renderer);
    return renderer;
  }
}
