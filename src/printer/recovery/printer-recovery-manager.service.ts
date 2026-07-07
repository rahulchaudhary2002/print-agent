import type { PrinterRepository } from '../../database/repositories/index.js';
import type { LoggerService } from '../../services/index.js';
import type { DiscoveryScheduler } from '../discovery/index.js';
import { PrinterEventBus, PrinterEventType, type PrinterEventPayload } from '../events/index.js';
import type { PrinterHealthMonitor } from '../health/index.js';
import type { PrinterManager } from '../manager/index.js';
import type { RecoveryResult } from './recovery.types.js';

/**
 * Automatic + on-demand recovery (Step 12) — restarts a printer's driver connection, and if
 * that alone doesn't bring it back online (e.g. a network printer's IP changed), triggers a
 * fresh discovery scan before checking again. Listens for `PrinterOffline` so a dropped USB/network
 * printer is retried without an operator having to notice and call the API. An in-flight `Set`
 * guarantees at most one recovery attempt runs per printer at a time.
 */
export class PrinterRecoveryManager {
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly printerManager: PrinterManager,
    private readonly printerRepository: PrinterRepository,
    private readonly healthMonitor: PrinterHealthMonitor,
    private readonly discoveryScheduler: DiscoveryScheduler,
    private readonly eventBus: PrinterEventBus,
    private readonly logger: LoggerService,
  ) {
    this.eventBus.on(PrinterEventType.PrinterOffline, (payload: PrinterEventPayload) => {
      if (payload.printerId) {
        this.recover(payload.printerId).catch((error: unknown) => this.logger.error('Automatic recovery failed', { printerId: payload.printerId, error }));
      }
    });
  }

  isRecovering(printerId: string): boolean {
    return this.inFlight.has(printerId);
  }

  async recover(printerId: string): Promise<RecoveryResult> {
    if (this.inFlight.has(printerId)) {
      this.logger.debug('Recovery already in progress, ignoring duplicate request', { printerId });
      return { success: false, message: 'Recovery already in progress for this printer', status: 'unknown' };
    }

    const printer = this.printerRepository.findById(printerId);
    if (!printer) {
      return { success: false, message: `Printer ${printerId} not found`, status: 'unknown' };
    }

    this.inFlight.add(printerId);
    this.eventBus.emitEvent(PrinterEventType.RecoveryStarted, { printerId, timestamp: new Date().toISOString() });
    this.logger.info('Printer recovery started', { printerId });

    try {
      await this.printerManager.reinitializeDriver(printerId);
      let status: string = await this.printerManager.getStatus(printerId);

      if (status !== 'online') {
        this.logger.info('Driver restart did not bring printer online, retrying discovery', { printerId, status });
        await this.discoveryScheduler.runManualScan();
        status = await this.printerManager.getStatus(printerId);
      }

      const success = status === 'online';
      if (success) {
        this.healthMonitor.recordRecovery(printerId);
      }

      const result: RecoveryResult = {
        success,
        status,
        message: success ? `Printer ${printer.name} recovered (status: ${status})` : `Recovery attempt finished — printer is still ${status}`,
      };
      this.eventBus.emitEvent(PrinterEventType.RecoveryCompleted, {
        printerId,
        timestamp: new Date().toISOString(),
        message: result.message,
        metadata: { success },
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown recovery error';
      this.eventBus.emitEvent(PrinterEventType.RecoveryCompleted, {
        printerId,
        timestamp: new Date().toISOString(),
        message,
        metadata: { success: false },
      });
      return { success: false, message, status: 'unknown' };
    } finally {
      this.inFlight.delete(printerId);
    }
  }
}
