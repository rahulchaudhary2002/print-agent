import { UnsupportedDriverError, type PrinterDriver } from '../../printer/interfaces/index.js';
import type { LoggerService } from '../../services/index.js';
import type { DriverRegistry } from './driver-registry.js';

/** Resolves a driver identifier to a fresh PrinterDriver instance via the registry — no switch statements. */
export class DriverFactory {
  constructor(
    private readonly registry: DriverRegistry,
    private readonly logger: LoggerService,
  ) {}

  create(driverName: string): PrinterDriver {
    const factory = this.registry.find(driverName);
    if (!factory) {
      throw new UnsupportedDriverError(driverName);
    }
    this.logger.debug('Resolved driver', { driverName });
    return factory();
  }
}
