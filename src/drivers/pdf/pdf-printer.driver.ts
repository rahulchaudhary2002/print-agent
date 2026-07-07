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
import { BasePrinterDriver, readString } from '../base/index.js';
import { scanCupsPrinters } from '../cups/cups-printer-scanner.util.js';
import { printPdfOnWindows } from '../windows/pdf-to-printer.util.js';
import { scanWindowsPrinters } from '../windows/windows-printer-scanner.util.js';
import { buildMinimalTestPdf } from './minimal-pdf.util.js';

const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MS = 10_000;

/**
 * Prints an existing PDF file to a target printer (or the OS default). `payload.payload`
 * is treated as a filesystem path to a PDF — this driver never generates receipt content,
 * only delivers files that already exist.
 */
export class PdfPrinterDriver extends BasePrinterDriver {
  readonly driverName = 'pdf';
  readonly capabilities = [PrinterCapability.Pdf];

  private printerName: string | null = null;

  override async initialize(connection: PrinterConnection): Promise<void> {
    await super.initialize(connection);
    this.printerName = readString(connection, 'printerName') ?? null;
  }

  override async discover(): Promise<DiscoveredPrinter[]> {
    const printers = process.platform === 'win32' ? await scanWindowsPrinters() : await scanCupsPrinters();
    return printers.map((printer) => ({ ...printer, driver: this.driverName }));
  }

  override async connect(): Promise<void> {
    this.logger.debug('PDF driver has no persistent connection', { driver: this.driverName });
    this.recordConnected();
  }

  override async disconnect(): Promise<void> {
    this.recordDisconnected();
  }

  /** Builds a minimal PDF containing the test-print text and sends it through the real print path. */
  override async testPrint(): Promise<DriverActionResult> {
    this.logger.info('Test print requested', { driver: this.driverName });
    const pdfBuffer = buildMinimalTestPdf(this.buildTestPrintContent().split('\n'));
    const tempPath = join(tmpdir(), `print-agent-${randomUUID()}.pdf`);
    await fs.writeFile(tempPath, pdfBuffer);
    try {
      return await this.print({ type: 'pdf', payload: tempPath });
    } finally {
      await fs.unlink(tempPath).catch(() => {});
    }
  }

  override async print(payload: PrintPayload): Promise<DriverActionResult> {
    const startedAt = Date.now();
    try {
      const stats = await fs.stat(payload.payload);

      if (process.platform === 'win32') {
        await printPdfOnWindows(payload.payload, this.printerName ? { printer: this.printerName } : undefined);
      } else {
        const args = this.printerName ? ['-d', this.printerName, payload.payload] : [payload.payload];
        await execFileAsync('lp', args, { timeout: COMMAND_TIMEOUT_MS });
      }

      this.touchActivity();
      this.recordPrintSuccess(stats.size, Date.now() - startedAt);
      this.logger.info('PDF sent to printer', { driver: this.driverName, printerName: this.printerName, bytes: stats.size });
      return { success: true, message: `Printed ${payload.payload}` };
    } catch (error) {
      this.recordFailure(error);
      const message = error instanceof Error ? error.message : 'Unknown PDF print error';
      this.logger.error('PDF print failed', { driver: this.driverName, error: message });
      return { success: false, message };
    }
  }

  override async getStatus(): Promise<PrinterStatusValue> {
    if (!this.printerName) {
      return PrinterStatusValue.Unknown;
    }
    try {
      const printers = process.platform === 'win32' ? await scanWindowsPrinters() : await scanCupsPrinters();
      return printers.some((printer) => printer.name === this.printerName)
        ? PrinterStatusValue.Online
        : PrinterStatusValue.Offline;
    } catch {
      return PrinterStatusValue.Unknown;
    }
  }
}
