import { findByIds, type Device, type OutEndpoint } from 'usb';
import { PrinterCapability } from '../../printer/interfaces/index.js';
import { PrinterStatusValue } from '../../printer/interfaces/printer-status.enum.js';
import type { DiscoveredPrinter, DriverActionResult, PrintPayload } from '../../printer/interfaces/printer-driver.interface.js';
import type { PrinterConnection } from '../../printer/printer.types.js';
import { BasePrinterDriver, decodePrintPayload, readNumber, requireNumber } from '../base/index.js';
import { scanUsbPrinters } from './usb-scanner.util.js';

const DEFAULT_USB_TIMEOUT_MS = 5000;

export class EscPosUsbDriver extends BasePrinterDriver {
  readonly driverName = 'escpos-usb';
  readonly capabilities = [
    PrinterCapability.Usb,
    PrinterCapability.EscPos,
    PrinterCapability.RawBytes,
    PrinterCapability.CashDrawer,
    PrinterCapability.CutPaper,
  ];

  private vendorId = 0;
  private productId = 0;
  private usbTimeoutMs = DEFAULT_USB_TIMEOUT_MS;
  private device: Device | null = null;
  private outEndpoint: OutEndpoint | null = null;

  override async initialize(connection: PrinterConnection): Promise<void> {
    await super.initialize(connection);
    this.vendorId = requireNumber(connection, 'vendorId', this.driverName);
    this.productId = requireNumber(connection, 'productId', this.driverName);
    this.usbTimeoutMs = readNumber(connection, 'usbTimeoutMs') ?? DEFAULT_USB_TIMEOUT_MS;
  }

  override async discover(): Promise<DiscoveredPrinter[]> {
    this.logger.debug('Scanning USB bus for printers', { driver: this.driverName });
    return scanUsbPrinters();
  }

  override async connect(): Promise<void> {
    if (this.device && this.outEndpoint) {
      this.logger.debug('Reusing existing USB connection', { driver: this.driverName });
      return;
    }
    this.logger.info('Connecting to USB printer', {
      driver: this.driverName,
      vendorId: this.vendorId,
      productId: this.productId,
    });

    const device = findByIds(this.vendorId, this.productId);
    if (!device) {
      throw new Error(
        `USB printer ${this.vendorId.toString(16)}:${this.productId.toString(16)} not found on the bus`,
      );
    }

    try {
      device.open();
      const usbInterface = device.interfaces?.[0];
      if (!usbInterface) {
        throw new Error('No USB interface available on this device');
      }
      usbInterface.claim();

      const outEndpoint = usbInterface.endpoints.find(
        (endpoint): endpoint is OutEndpoint => endpoint.direction === 'out',
      );
      if (!outEndpoint) {
        throw new Error('No OUT endpoint available on this USB printer');
      }
      outEndpoint.timeout = this.usbTimeoutMs;

      this.device = device;
      this.outEndpoint = outEndpoint;
    } catch (error) {
      device.close();
      throw error;
    }

    this.recordConnected();
    this.touchActivity();
    this.logger.info('Connected to USB printer', { driver: this.driverName });
  }

  override async disconnect(): Promise<void> {
    this.clearIdleTimer();
    if (!this.device) {
      return;
    }
    this.logger.info('Disconnecting USB printer', { driver: this.driverName });
    try {
      this.device.close();
    } catch (error) {
      this.logger.warn('Error while closing USB device', { driver: this.driverName, error });
    }
    this.device = null;
    this.outEndpoint = null;
    this.recordDisconnected();
  }

  override async print(payload: PrintPayload): Promise<DriverActionResult> {
    const startedAt = Date.now();
    try {
      if (!this.device || !this.outEndpoint) {
        const isReconnect = this.device !== null;
        await this.connect();
        if (isReconnect) {
          this.recordReconnect();
        }
      }
      const outEndpoint = this.outEndpoint;
      if (!outEndpoint) {
        throw new Error('USB printer is not connected');
      }

      const buffer = decodePrintPayload(payload);
      await outEndpoint.transferAsync(buffer);
      this.touchActivity();
      this.recordPrintSuccess(buffer.length, Date.now() - startedAt);
      this.logger.info('Bytes sent to USB printer', { driver: this.driverName, bytes: buffer.length });
      return { success: true, message: `Sent ${buffer.length} bytes over USB` };
    } catch (error) {
      this.recordFailure(error);
      const message = error instanceof Error ? error.message : 'Unknown USB print error';
      this.logger.error('USB print failed', { driver: this.driverName, error: message });
      return { success: false, message };
    }
  }

  override async getStatus(): Promise<PrinterStatusValue> {
    if (this.device && this.outEndpoint) {
      return PrinterStatusValue.Online;
    }
    const device = findByIds(this.vendorId, this.productId);
    return device ? PrinterStatusValue.Offline : PrinterStatusValue.Unknown;
  }
}
