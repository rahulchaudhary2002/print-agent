import type { PrinterHealthRepository, PrinterRepository } from '../../database/repositories/index.js';
import type { LoggerService } from '../../services/index.js';
import type { PrinterCacheService } from '../cache/index.js';
import { PrinterEventBus, PrinterEventType } from '../events/index.js';
import type { PrinterManager } from '../manager/index.js';
import type { PersistedPrinterHealth, PrinterHealthStatus } from './printer-health.types.js';

const DEFAULT_POLL_INTERVAL_MS = 30_000;

function defaultHealth(printerId: string): PersistedPrinterHealth {
  return {
    printerId,
    status: 'unknown',
    lastSeenAt: null,
    lastSuccessAt: null,
    lastError: null,
    failureCount: 0,
    recoveryCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Continuously polls every registered printer's live status through `PrinterManager` (Step 11),
 * persists the result so it survives restarts, and publishes `PrinterOnline`/`PrinterOffline`/
 * `HealthChanged` events on transitions — `PrinterRecoveryManager` listens for the offline
 * transition rather than polling anything itself.
 */
export class PrinterHealthMonitor {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly printerRepository: PrinterRepository,
    private readonly printerManager: PrinterManager,
    private readonly healthRepository: PrinterHealthRepository,
    private readonly cache: PrinterCacheService,
    private readonly eventBus: PrinterEventBus,
    private readonly logger: LoggerService,
    private pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.pollAll().catch((error: unknown) => this.logger.error('Printer health poll cycle failed', { error }));
    }, this.pollIntervalMs);
    this.timer.unref();
    this.logger.info('Printer health monitor started', { pollIntervalMs: this.pollIntervalMs });
  }

  /** Service watchdog (Step 8) / GET /service/workers. */
  get isRunning(): boolean {
    return this.timer !== null;
  }

  /** Config hot-reload (Step 7). */
  setPollIntervalMs(pollIntervalMs: number): void {
    this.pollIntervalMs = pollIntervalMs;
    if (this.timer) {
      this.stop();
      this.start();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async pollAll(): Promise<void> {
    const printers = this.printerRepository.findAll().filter((printer) => printer.enabled);
    await Promise.all(printers.map((printer) => this.pollOne(printer.id)));
  }

  async pollOne(printerId: string): Promise<PersistedPrinterHealth> {
    const previous = this.healthRepository.findByPrinterId(printerId) ?? defaultHealth(printerId);
    const now = new Date().toISOString();
    let next: PersistedPrinterHealth;

    try {
      const driverHealth = await this.printerManager.getHealth(printerId);
      const status = driverHealth.status as PrinterHealthStatus;
      next = {
        printerId,
        status,
        lastSeenAt: status === 'online' || status === 'busy' ? now : previous.lastSeenAt,
        lastSuccessAt: driverHealth.lastSuccessAt ?? previous.lastSuccessAt,
        lastError: status === 'online' ? null : (driverHealth.lastError ?? previous.lastError),
        failureCount: status === 'online' ? 0 : previous.failureCount + 1,
        recoveryCount: previous.recoveryCount,
        updatedAt: now,
      };
    } catch (error) {
      next = {
        ...previous,
        status: 'unknown',
        lastError: error instanceof Error ? error.message : String(error),
        failureCount: previous.failureCount + 1,
        updatedAt: now,
      };
    }

    this.healthRepository.upsert(next);
    this.cache.setHealth(printerId, next);

    if (previous.status !== next.status) {
      this.eventBus.emitEvent(PrinterEventType.HealthChanged, {
        printerId,
        timestamp: now,
        metadata: { from: previous.status, to: next.status },
      });
      if (next.status === 'online') {
        this.eventBus.emitEvent(PrinterEventType.PrinterOnline, { printerId, timestamp: now });
      } else if (next.status === 'offline' || next.status === 'error') {
        this.eventBus.emitEvent(PrinterEventType.PrinterOffline, { printerId, timestamp: now, message: next.lastError ?? undefined });
      }
    }

    return next;
  }

  getSnapshot(printerId: string): PersistedPrinterHealth {
    return this.cache.getHealth(printerId) ?? this.healthRepository.findByPrinterId(printerId) ?? defaultHealth(printerId);
  }

  getAllSnapshots(): PersistedPrinterHealth[] {
    return this.printerRepository.findAll().map((printer) => this.getSnapshot(printer.id));
  }

  /** Bumped by `PrinterRecoveryManager` after a successful recovery attempt. */
  recordRecovery(printerId: string): void {
    const current = this.healthRepository.findByPrinterId(printerId) ?? defaultHealth(printerId);
    const updated: PersistedPrinterHealth = { ...current, recoveryCount: current.recoveryCount + 1, updatedAt: new Date().toISOString() };
    this.healthRepository.upsert(updated);
    this.cache.setHealth(printerId, updated);
  }
}
