import type { PrinterConnection } from '../../printer/printer.types.js';
import type {
  DiscoveredPrinter,
  DriverActionResult,
  DriverHealth,
  DriverMetrics,
  PrinterCapability,
  PrinterDriver,
  PrintPayload,
} from '../../printer/interfaces/index.js';
import { PrinterStatusValue } from '../../printer/interfaces/printer-status.enum.js';
import type { LoggerService } from '../../services/index.js';
import { readNumber } from './connection-config.util.js';

interface MutableMetrics {
  jobsPrinted: number;
  failures: number;
  reconnectCount: number;
  bytesSent: number;
  totalDurationMs: number;
  lastUsedAt: string | null;
}

const DEFAULT_IDLE_TIMEOUT_MS = 60_000;

/**
 * Shared skeleton for every driver: every action is logged, unimplemented hardware
 * operations reject clearly, and metrics/health/idle-connection bookkeeping is centralized
 * here so concrete drivers only implement the actual hardware I/O.
 */
export abstract class BasePrinterDriver implements PrinterDriver {
  abstract readonly driverName: string;
  abstract readonly capabilities: PrinterCapability[];

  protected connection: PrinterConnection | null = null;
  protected idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;

  private readonly metrics: MutableMetrics = {
    jobsPrinted: 0,
    failures: 0,
    reconnectCount: 0,
    bytesSent: 0,
    totalDurationMs: 0,
    lastUsedAt: null,
  };
  private lastSuccessAt: string | null = null;
  private lastError: string | null = null;
  private connectedAt: number | null = null;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor(protected readonly logger: LoggerService) {}

  async initialize(connection: PrinterConnection): Promise<void> {
    this.connection = connection;
    const idleTimeoutMs = readNumber(connection, 'idleTimeoutMs');
    if (idleTimeoutMs !== undefined) {
      this.idleTimeoutMs = idleTimeoutMs;
    }
    this.logger.info('Driver initialized', { driver: this.driverName, connection });
  }

  async connect(): Promise<void> {
    this.logger.debug('Driver connect requested', { driver: this.driverName });
    throw new Error('Not Implemented');
  }

  async disconnect(): Promise<void> {
    this.logger.debug('Driver disconnect requested', { driver: this.driverName });
    throw new Error('Not Implemented');
  }

  async print(_payload: PrintPayload): Promise<DriverActionResult> {
    this.logger.debug('Driver print requested', { driver: this.driverName });
    throw new Error('Not Implemented');
  }

  async getStatus(): Promise<PrinterStatusValue> {
    this.logger.debug('Driver status requested', { driver: this.driverName });
    throw new Error('Not Implemented');
  }

  async discover(): Promise<DiscoveredPrinter[]> {
    this.logger.debug('Driver discover requested', { driver: this.driverName });
    throw new Error('Not Implemented');
  }

  /** Sends a plain-text status block through the real `print()` path — no ESC/POS formatting. */
  async testPrint(): Promise<DriverActionResult> {
    this.logger.info('Test print requested', { driver: this.driverName });
    return this.print({ type: 'text', payload: this.buildTestPrintContent() });
  }

  supports(capability: PrinterCapability): boolean {
    return this.capabilities.includes(capability);
  }

  getMetrics(): DriverMetrics {
    const { jobsPrinted, failures, reconnectCount, bytesSent, totalDurationMs, lastUsedAt } = this.metrics;
    return {
      jobsPrinted,
      failures,
      reconnectCount,
      bytesSent,
      averageDurationMs: jobsPrinted > 0 ? Math.round(totalDurationMs / jobsPrinted) : 0,
      lastUsedAt,
    };
  }

  async getHealth(): Promise<DriverHealth> {
    let status: PrinterStatusValue;
    try {
      status = await this.getStatus();
    } catch {
      status = PrinterStatusValue.Unknown;
    }
    return {
      status,
      healthScore: this.computeHealthScore(status),
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      connectionDurationMs: this.connectedAt !== null ? Date.now() - this.connectedAt : null,
    };
  }

  protected buildTestPrintContent(): string {
    return [
      '--------------------------------',
      'Print Agent',
      'Test Print',
      `Driver: ${this.driverName}`,
      `Time: ${new Date().toISOString()}`,
      '--------------------------------',
    ].join('\n');
  }

  protected recordConnected(): void {
    this.connectedAt = Date.now();
  }

  protected recordDisconnected(): void {
    this.connectedAt = null;
  }

  protected recordReconnect(): void {
    this.metrics.reconnectCount += 1;
  }

  protected recordPrintSuccess(bytesSent: number, durationMs: number): void {
    this.metrics.jobsPrinted += 1;
    this.metrics.bytesSent += bytesSent;
    this.metrics.totalDurationMs += durationMs;
    this.metrics.lastUsedAt = new Date().toISOString();
    this.lastSuccessAt = this.metrics.lastUsedAt;
  }

  protected recordFailure(error: unknown): void {
    this.metrics.failures += 1;
    this.lastError = error instanceof Error ? error.message : String(error);
  }

  /** Resets the idle-disconnect timer. Call after every successful connect/print. */
  protected touchActivity(): void {
    this.clearIdleTimer();
    const timer = setTimeout(() => {
      this.logger.debug('Closing idle connection', { driver: this.driverName, idleTimeoutMs: this.idleTimeoutMs });
      this.disconnect().catch((error: unknown) => {
        this.logger.error('Failed to close idle connection', { driver: this.driverName, error });
      });
    }, this.idleTimeoutMs);
    timer.unref();
    this.idleTimer = timer;
  }

  protected clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private computeHealthScore(status: PrinterStatusValue): number {
    const totalAttempts = this.metrics.jobsPrinted + this.metrics.failures;
    const successRate = totalAttempts > 0 ? this.metrics.jobsPrinted / totalAttempts : 1;
    const statusPenalty =
      status === PrinterStatusValue.Online
        ? 0
        : status === PrinterStatusValue.Busy
          ? 10
          : status === PrinterStatusValue.Unknown
            ? 30
            : 50;
    return Math.max(0, Math.round(successRate * 100) - statusPenalty);
  }
}
