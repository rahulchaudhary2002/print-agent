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
import { scanCupsPrinters } from './cups-printer-scanner.util.js';

const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MS = 10_000;

/** Prints via the CUPS command-line tools (`lp`/`lpstat`) — Linux/macOS only. */
export class CupsPrinterDriver extends BasePrinterDriver {
  readonly driverName = 'cups';
  readonly capabilities = [PrinterCapability.Network, PrinterCapability.Pdf, PrinterCapability.Images, PrinterCapability.RawBytes];

  private printerName = '';

  override async initialize(connection: PrinterConnection): Promise<void> {
    await super.initialize(connection);
    this.printerName = requireString(connection, 'printerName', this.driverName);
  }

  override async discover(): Promise<DiscoveredPrinter[]> {
    return scanCupsPrinters();
  }

  override async connect(): Promise<void> {
    this.assertNotWindows();
    await execFileAsync('lpstat', ['-r'], { timeout: COMMAND_TIMEOUT_MS });
    this.recordConnected();
  }

  override async disconnect(): Promise<void> {
    this.recordDisconnected();
  }

  override async print(payload: PrintPayload): Promise<DriverActionResult> {
    const startedAt = Date.now();
    let tempFilePath: string | null = null;
    try {
      this.assertNotWindows();
      const buffer = decodePrintPayload(payload);
      tempFilePath = join(tmpdir(), `print-agent-${randomUUID()}`);
      await fs.writeFile(tempFilePath, buffer);

      const args =
        payload.type === 'pdf'
          ? ['-d', this.printerName, tempFilePath]
          : ['-d', this.printerName, '-o', 'raw', tempFilePath];
      await execFileAsync('lp', args, { timeout: COMMAND_TIMEOUT_MS });

      this.touchActivity();
      this.recordPrintSuccess(buffer.length, Date.now() - startedAt);
      this.logger.info('Sent print job to CUPS', { driver: this.driverName, printerName: this.printerName, bytes: buffer.length });
      return { success: true, message: `Sent to CUPS printer ${this.printerName}` };
    } catch (error) {
      this.recordFailure(error);
      const message = error instanceof Error ? error.message : 'Unknown CUPS print error';
      this.logger.error('CUPS print failed', { driver: this.driverName, error: message });
      return { success: false, message };
    } finally {
      if (tempFilePath) {
        await fs.unlink(tempFilePath).catch(() => {});
      }
    }
  }

  override async getStatus(): Promise<PrinterStatusValue> {
    if (process.platform === 'win32') {
      return PrinterStatusValue.Unknown;
    }
    try {
      const { stdout } = await execFileAsync('lpstat', ['-p', this.printerName], { timeout: COMMAND_TIMEOUT_MS });
      const line = stdout.toLowerCase();
      if (line.includes('now printing')) {
        return PrinterStatusValue.Busy;
      }
      if (line.includes('disabled')) {
        return PrinterStatusValue.Offline;
      }
      if (line.includes('idle')) {
        return PrinterStatusValue.Online;
      }
      return PrinterStatusValue.Unknown;
    } catch (error) {
      this.logger.warn('Failed to query CUPS printer status', { driver: this.driverName, error });
      return PrinterStatusValue.Unknown;
    }
  }

  private assertNotWindows(): void {
    if (process.platform === 'win32') {
      throw new Error(`Driver "${this.driverName}" does not run on Windows`);
    }
  }
}
