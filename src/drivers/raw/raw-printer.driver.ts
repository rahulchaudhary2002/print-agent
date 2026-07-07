import { constants as fsConstants, promises as fs } from 'node:fs';
import { PrinterCapability } from '../../printer/interfaces/index.js';
import { PrinterStatusValue } from '../../printer/interfaces/printer-status.enum.js';
import type { DriverActionResult, PrintPayload } from '../../printer/interfaces/printer-driver.interface.js';
import type { PrinterConnection } from '../../printer/printer.types.js';
import { BasePrinterDriver, decodePrintPayload, readNumber, readString, TcpConnection } from '../base/index.js';

const DEFAULT_PORT = 9100;
const DEFAULT_CONNECT_TIMEOUT_MS = 5000;

/**
 * Sends a buffer directly to a printer with no protocol awareness — useful for Zebra
 * ZPL, ESC/POS, or any device that just wants raw bytes. Supports two transports:
 * a raw device file (e.g. `/dev/usb/lp0`) or a bare TCP socket.
 */
export class RawPrinterDriver extends BasePrinterDriver {
  readonly driverName = 'raw';
  readonly capabilities = [PrinterCapability.RawBytes];

  private devicePath: string | null = null;
  private host: string | null = null;
  private port = DEFAULT_PORT;
  private connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS;
  private socket: TcpConnection | null = null;

  override async initialize(connection: PrinterConnection): Promise<void> {
    await super.initialize(connection);
    this.devicePath = readString(connection, 'devicePath') ?? null;
    this.host = readString(connection, 'ip') ?? null;
    this.port = readNumber(connection, 'port') ?? DEFAULT_PORT;
    this.connectTimeoutMs = readNumber(connection, 'connectTimeoutMs') ?? DEFAULT_CONNECT_TIMEOUT_MS;

    if (!this.devicePath && !this.host) {
      throw new Error(`Driver "${this.driverName}" requires connection.devicePath or connection.ip`);
    }
  }

  override async connect(): Promise<void> {
    if (this.devicePath) {
      this.logger.info('Verifying raw device path is writable', { driver: this.driverName, devicePath: this.devicePath });
      await fs.access(this.devicePath, fsConstants.W_OK);
      this.recordConnected();
      this.touchActivity();
      return;
    }

    if (this.socket?.isOpen) {
      return;
    }
    const host = this.host;
    if (!host) {
      throw new Error('Raw printer has no host or devicePath configured');
    }
    this.logger.info('Connecting to raw network printer', { driver: this.driverName, host, port: this.port });
    const socket = new TcpConnection({
      host,
      port: this.port,
      connectTimeoutMs: this.connectTimeoutMs,
      idleTimeoutMs: this.idleTimeoutMs,
    });
    await socket.open(
      () => void socket.close(),
      () => {
        this.socket = null;
      },
    );
    this.socket = socket;
    this.recordConnected();
    this.touchActivity();
  }

  override async disconnect(): Promise<void> {
    this.clearIdleTimer();
    if (this.socket) {
      await this.socket.close();
      this.socket = null;
    }
    this.recordDisconnected();
  }

  override async print(payload: PrintPayload): Promise<DriverActionResult> {
    const startedAt = Date.now();
    try {
      const buffer = decodePrintPayload(payload);

      if (this.devicePath) {
        await this.connect();
        await fs.appendFile(this.devicePath, buffer);
      } else {
        if (!this.socket?.isOpen) {
          const isReconnect = this.socket !== null;
          await this.connect();
          if (isReconnect) {
            this.recordReconnect();
          }
        }
        const socket = this.socket;
        if (!socket) {
          throw new Error('Raw printer is not connected');
        }
        await socket.write(buffer);
      }

      this.touchActivity();
      this.recordPrintSuccess(buffer.length, Date.now() - startedAt);
      this.logger.info('Raw bytes sent', { driver: this.driverName, bytes: buffer.length });
      return { success: true, message: `Sent ${buffer.length} raw bytes` };
    } catch (error) {
      this.recordFailure(error);
      const message = error instanceof Error ? error.message : 'Unknown raw print error';
      this.logger.error('Raw print failed', { driver: this.driverName, error: message });
      return { success: false, message };
    }
  }

  override async getStatus(): Promise<PrinterStatusValue> {
    try {
      if (this.devicePath) {
        await fs.access(this.devicePath, fsConstants.W_OK);
        return PrinterStatusValue.Online;
      }
      return this.socket?.isOpen ? PrinterStatusValue.Online : PrinterStatusValue.Offline;
    } catch {
      return PrinterStatusValue.Offline;
    }
  }
}
