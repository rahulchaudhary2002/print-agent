import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PrinterCapability } from '../../printer/interfaces/index.js';
import { PrinterStatusValue } from '../../printer/interfaces/printer-status.enum.js';
import type { DiscoveredPrinter, DriverActionResult, PrintPayload } from '../../printer/interfaces/printer-driver.interface.js';
import type { PrinterConnection } from '../../printer/printer.types.js';
import { BasePrinterDriver, decodePrintPayload, requireString } from '../base/index.js';
import { getWindowsPrinters, printPdfOnWindows } from './pdf-to-printer.util.js';
import { scanWindowsPrinters } from './windows-printer-scanner.util.js';

const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MS = 10_000;

/**
 * Prints via the Windows spooler. PDFs go through `pdf-to-printer` (SumatraPDF under the hood);
 * raw bytes (ESC/POS, ZPL, etc.) go through the `copy /b` spooler trick, since the spooler has
 * no generic "send these bytes" API without a vendor SDK. Windows-only — no-ops with a clear
 * error on every other platform so the interface stays uniform.
 */
export class WindowsPrinterDriver extends BasePrinterDriver {
  readonly driverName = 'windows';
  readonly capabilities = [
    PrinterCapability.Network,
    PrinterCapability.Usb,
    PrinterCapability.Pdf,
    PrinterCapability.Images,
    PrinterCapability.RawBytes,
  ];

  private printerName = '';

  override async initialize(connection: PrinterConnection): Promise<void> {
    await super.initialize(connection);
    this.printerName = requireString(connection, 'printerName', this.driverName);
  }

  override async discover(): Promise<DiscoveredPrinter[]> {
    return scanWindowsPrinters();
  }

  override async connect(): Promise<void> {
    this.assertWindows();
    this.logger.debug('Windows spooler has no persistent connection; verifying printer exists', {
      driver: this.driverName,
      printerName: this.printerName,
    });
    const printers = await getWindowsPrinters();
    if (!printers.some((printer) => printer.name === this.printerName)) {
      throw new Error(`Windows printer "${this.printerName}" was not found`);
    }
    this.recordConnected();
  }

  override async disconnect(): Promise<void> {
    this.recordDisconnected();
  }

  override async print(payload: PrintPayload): Promise<DriverActionResult> {
    const startedAt = Date.now();
    try {
      this.assertWindows();
      const buffer = decodePrintPayload(payload);

      if (payload.type === 'pdf') {
        await printPdfOnWindows(payload.payload, { printer: this.printerName });
      } else {
        await this.printRawBytes(buffer);
      }

      this.touchActivity();
      this.recordPrintSuccess(buffer.length, Date.now() - startedAt);
      this.logger.info('Sent print job to Windows spooler', {
        driver: this.driverName,
        printerName: this.printerName,
        bytes: buffer.length,
      });
      return { success: true, message: `Sent to Windows printer ${this.printerName}` };
    } catch (error) {
      this.recordFailure(error);
      const message = error instanceof Error ? error.message : 'Unknown Windows print error';
      this.logger.error('Windows print failed', { driver: this.driverName, error: message });
      return { success: false, message };
    }
  }

  override async getStatus(): Promise<PrinterStatusValue> {
    if (process.platform !== 'win32') {
      return PrinterStatusValue.Unknown;
    }
    try {
      const printers = await getWindowsPrinters();
      return printers.some((printer) => printer.name === this.printerName)
        ? PrinterStatusValue.Online
        : PrinterStatusValue.Offline;
    } catch (error) {
      this.logger.warn('Failed to query Windows printer list', { driver: this.driverName, error });
      return PrinterStatusValue.Unknown;
    }
  }

  private async printRawBytes(buffer: Buffer): Promise<void> {
    const tempFilePath = join(tmpdir(), `print-agent-${randomUUID()}.raw`);
    await fs.writeFile(tempFilePath, buffer);
    try {
      await execFileAsync('cmd', ['/c', 'copy', '/b', tempFilePath, `\\\\.\\${this.printerName}`], {
        timeout: COMMAND_TIMEOUT_MS,
      });
    } finally {
      await fs.unlink(tempFilePath).catch(() => {});
    }
  }

  private assertWindows(): void {
    if (process.platform !== 'win32') {
      throw new Error(`Driver "${this.driverName}" only works on Windows (current platform: ${process.platform})`);
    }
  }
}
