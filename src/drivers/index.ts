import type { LoggerService } from '../services/index.js';
import { DriverRegistry } from './base/index.js';
import { CupsPrinterDriver } from './cups/index.js';
import { EscPosNetworkDriver, EscPosUsbDriver } from './escpos/index.js';
import { PdfPrinterDriver } from './pdf/index.js';
import { RawPrinterDriver } from './raw/index.js';
import { WindowsPrinterDriver } from './windows/index.js';

/**
 * Registers every built-in driver with the registry. Third-party plugins register
 * the same way via `registry.register(name, factory)` — no code here needs to change.
 */
export function registerBuiltInDrivers(registry: DriverRegistry, logger: LoggerService): void {
  registry.register('escpos-usb', () => new EscPosUsbDriver(logger));
  registry.register('network', () => new EscPosNetworkDriver(logger));
  registry.register('windows', () => new WindowsPrinterDriver(logger));
  registry.register('cups', () => new CupsPrinterDriver(logger));
  registry.register('pdf', () => new PdfPrinterDriver(logger));
  registry.register('raw', () => new RawPrinterDriver(logger));
}

export * from './base/index.js';
export * from './escpos/index.js';
export * from './windows/index.js';
export * from './cups/index.js';
export * from './pdf/index.js';
export * from './raw/index.js';
