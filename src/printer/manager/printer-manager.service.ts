import type { DriverFactory } from '../../drivers/base/index.js';
import type { PrinterRepository } from '../../database/repositories/index.js';
import type { LoggerService } from '../../services/index.js';
import { AppError } from '../../utils/index.js';
import { DriverInitializationFailedError } from '../interfaces/driver.errors.js';
import type { PrinterCapability } from '../interfaces/printer-capability.enum.js';
import type {
  DriverActionResult,
  DriverHealth,
  DriverMetrics,
  PrinterDriver,
  PrintPayload,
} from '../interfaces/printer-driver.interface.js';
import type { PrinterStatusValue } from '../interfaces/printer-status.enum.js';
import type { Printer, PrinterConnection } from '../printer.types.js';

export interface PrinterDiagnostics {
  status: PrinterStatusValue;
  health: DriverHealth;
  metrics: DriverMetrics;
  driver: string;
  connection: PrinterConnection;
  capabilities: PrinterCapability[];
}

/**
 * Bridges persisted printer records to live driver instances. Knows only the
 * PrinterDriver interface and DriverFactory — never a concrete driver class.
 */
export class PrinterManager {
  private readonly driverInstances = new Map<string, PrinterDriver>();

  constructor(
    private readonly printerRepository: PrinterRepository,
    private readonly driverFactory: DriverFactory,
    private readonly logger: LoggerService,
  ) {}

  /** Initializes a driver for every persisted printer. A single bad printer never blocks startup. */
  async loadPrinters(): Promise<void> {
    const printers = this.printerRepository.findAll();
    for (const printer of printers) {
      try {
        await this.initializeDriver(printer);
      } catch (error) {
        this.logger.error('Failed to initialize printer driver', {
          printerId: printer.id,
          driver: printer.driver,
          error,
        });
      }
    }
    this.logger.info('Printers loaded', { total: printers.length, initialized: this.driverInstances.size });
  }

  async getStatus(printerId: string): Promise<PrinterStatusValue> {
    const driver = await this.resolveDriver(printerId);
    this.logger.debug('Querying printer status', { printerId });
    return driver.getStatus();
  }

  async getMetrics(printerId: string): Promise<DriverMetrics> {
    const driver = await this.resolveDriver(printerId);
    return driver.getMetrics();
  }

  async getHealth(printerId: string): Promise<DriverHealth> {
    const driver = await this.resolveDriver(printerId);
    return driver.getHealth();
  }

  /** The printer's driver's declared capabilities — lets callers (e.g. the print pipeline) pick a
   *  compatible renderer without ever holding a driver reference themselves. */
  async getCapabilities(printerId: string): Promise<PrinterCapability[]> {
    const driver = await this.resolveDriver(printerId);
    return driver.capabilities;
  }

  /** Combines live status, health, metrics, and static printer info for the diagnostics API. */
  async getDiagnostics(printerId: string): Promise<PrinterDiagnostics> {
    const printer = this.getPrinterOrThrow(printerId);
    const driver = await this.resolveDriver(printerId);
    const [status, health] = await Promise.all([driver.getStatus(), driver.getHealth()]);
    return {
      status,
      health,
      metrics: driver.getMetrics(),
      driver: printer.driver,
      connection: printer.connection,
      capabilities: driver.capabilities,
    };
  }

  async testPrint(printerId: string): Promise<DriverActionResult> {
    const driver = await this.resolveDriver(printerId);
    this.logger.info('Test print triggered', { printerId });
    return driver.testPrint();
  }

  /** Sends a job's payload to the printer's driver. */
  async sendJob(printerId: string, payload: PrintPayload): Promise<DriverActionResult> {
    const driver = await this.resolveDriver(printerId);
    this.logger.info('Sending job to driver', { printerId, type: payload.type });
    return driver.print(payload);
  }

  /**
   * Forces a printer's driver to be torn down and re-created from its current stored connection
   * (Step 12 — recovery). Used by `PrinterRecoveryManager` instead of duplicating driver
   * lifecycle logic; safe to call even if no instance is currently loaded.
   */
  async reinitializeDriver(printerId: string): Promise<PrinterDriver> {
    const existing = this.driverInstances.get(printerId);
    if (existing) {
      try {
        await existing.disconnect();
      } catch (error) {
        this.logger.debug('Ignoring disconnect error during driver reinitialization', { printerId, error });
      }
      this.driverInstances.delete(printerId);
    }
    const printer = this.getPrinterOrThrow(printerId);
    return this.initializeDriver(printer);
  }

  /** Graceful shutdown (Step 4) — disconnects every live driver instance; errors are logged, never thrown. */
  async disconnectAll(): Promise<void> {
    await Promise.all(
      [...this.driverInstances.entries()].map(async ([printerId, driver]) => {
        try {
          await driver.disconnect();
        } catch (error) {
          this.logger.debug('Ignoring disconnect error during shutdown', { printerId, error });
        }
      }),
    );
    this.driverInstances.clear();
  }

  private async resolveDriver(printerId: string): Promise<PrinterDriver> {
    const existing = this.driverInstances.get(printerId);
    if (existing) {
      return existing;
    }
    const printer = this.getPrinterOrThrow(printerId);
    return this.initializeDriver(printer);
  }

  private async initializeDriver(printer: Printer): Promise<PrinterDriver> {
    const driver = this.driverFactory.create(printer.driver);
    try {
      await driver.initialize(printer.connection);
    } catch (error) {
      throw new DriverInitializationFailedError(printer.driver, error);
    }
    this.driverInstances.set(printer.id, driver);
    this.logger.info('Driver initialized for printer', { printerId: printer.id, driver: printer.driver });
    return driver;
  }

  private getPrinterOrThrow(printerId: string): Printer {
    const printer = this.printerRepository.findById(printerId);
    if (!printer) {
      throw new AppError(`Printer ${printerId} not found`, 404);
    }
    return printer;
  }
}
