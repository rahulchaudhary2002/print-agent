import { scanUsbPrinters } from '../../drivers/escpos/usb-scanner.util.js';
import { scanNetworkPrinters, type NetworkScanOptions } from '../../drivers/escpos/network-scanner.util.js';
import { scanWindowsPrinters } from '../../drivers/windows/windows-printer-scanner.util.js';
import { scanCupsPrinters } from '../../drivers/cups/cups-printer-scanner.util.js';
import type { LoggerService } from '../../services/index.js';
import type { DiscoveredPrinter } from '../interfaces/printer-driver.interface.js';

/**
 * Sweeps each transport for reachable printers. Returns candidates only — never
 * persists anything, so results must be explicitly added via the Printer API.
 */
export class DiscoveryService {
  constructor(private readonly logger: LoggerService) {}

  async discoverAll(networkOptions?: NetworkScanOptions): Promise<DiscoveredPrinter[]> {
    const results = await Promise.all([
      this.discoverUsb(),
      this.discoverNetwork(networkOptions),
      this.discoverWindows(),
      this.discoverCups(),
      this.discoverBluetooth(),
    ]);
    const discovered = results.flat();
    this.logger.info('Printer discovery completed', { count: discovered.length });
    return discovered;
  }

  private async discoverUsb(): Promise<DiscoveredPrinter[]> {
    this.logger.debug('Discovering USB printers');
    return scanUsbPrinters();
  }

  private async discoverNetwork(options?: NetworkScanOptions): Promise<DiscoveredPrinter[]> {
    this.logger.debug('Discovering network printers');
    return scanNetworkPrinters(options);
  }

  private async discoverWindows(): Promise<DiscoveredPrinter[]> {
    this.logger.debug('Discovering Windows printers');
    return scanWindowsPrinters();
  }

  private async discoverCups(): Promise<DiscoveredPrinter[]> {
    this.logger.debug('Discovering CUPS printers');
    return scanCupsPrinters();
  }

  private async discoverBluetooth(): Promise<DiscoveredPrinter[]> {
    this.logger.debug('Discovering Bluetooth printers (placeholder)');
    return [];
  }
}
