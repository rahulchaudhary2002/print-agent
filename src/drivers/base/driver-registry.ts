import type { PrinterDriver } from '../../printer/interfaces/index.js';

export type DriverFactoryFn = () => PrinterDriver;

/**
 * Maps driver identifiers (e.g. "escpos-usb") to factory functions.
 * This is the extension point for future third-party driver plugins.
 */
export class DriverRegistry {
  private readonly factories = new Map<string, DriverFactoryFn>();

  register(driverName: string, factory: DriverFactoryFn): void {
    this.factories.set(driverName, factory);
  }

  unregister(driverName: string): void {
    this.factories.delete(driverName);
  }

  find(driverName: string): DriverFactoryFn | undefined {
    return this.factories.get(driverName);
  }

  list(): string[] {
    return [...this.factories.keys()];
  }
}
