import { PrinterCapability } from '../../printer/interfaces/index.js';
import { PrinterStatusValue } from '../../printer/interfaces/printer-status.enum.js';
import type { DriverActionResult, PrintPayload } from '../../printer/interfaces/printer-driver.interface.js';
import type { PrinterConnection } from '../../printer/printer.types.js';
import { BasePrinterDriver, decodePrintPayload, readNumber, requireString, TcpConnection } from '../base/index.js';

const DEFAULT_PORT = 9100;
const DEFAULT_CONNECT_TIMEOUT_MS = 5000;

export class EscPosNetworkDriver extends BasePrinterDriver {
  readonly driverName = 'network';
  readonly capabilities = [
    PrinterCapability.Network,
    PrinterCapability.EscPos,
    PrinterCapability.RawBytes,
    PrinterCapability.CashDrawer,
    PrinterCapability.CutPaper,
  ];

  private host = '';
  private port = DEFAULT_PORT;
  private connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS;
  private socket: TcpConnection | null = null;

  override async initialize(connection: PrinterConnection): Promise<void> {
    await super.initialize(connection);
    this.host = requireString(connection, 'ip', this.driverName);
    this.port = readNumber(connection, 'port') ?? DEFAULT_PORT;
    this.connectTimeoutMs = readNumber(connection, 'connectTimeoutMs') ?? DEFAULT_CONNECT_TIMEOUT_MS;
  }

  override async connect(): Promise<void> {
    if (this.socket?.isOpen) {
      this.logger.debug('Reusing existing network connection', { driver: this.driverName, host: this.host, port: this.port });
      return;
    }
    this.logger.info('Connecting to network printer', { driver: this.driverName, host: this.host, port: this.port });

    const socket = new TcpConnection({
      host: this.host,
      port: this.port,
      connectTimeoutMs: this.connectTimeoutMs,
      idleTimeoutMs: this.idleTimeoutMs,
    });
    await socket.open(
      () => {
        this.logger.warn('Network socket idle timeout, closing', { driver: this.driverName, host: this.host });
        void socket.close();
      },
      () => {
        this.logger.warn('Network socket closed', { driver: this.driverName, host: this.host });
        this.socket = null;
      },
    );
    this.socket = socket;
    this.recordConnected();
    this.touchActivity();
    this.logger.info('Connected to network printer', { driver: this.driverName, host: this.host, port: this.port });
  }

  override async disconnect(): Promise<void> {
    this.clearIdleTimer();
    if (!this.socket) {
      return;
    }
    this.logger.info('Disconnecting from network printer', { driver: this.driverName, host: this.host, port: this.port });
    await this.socket.close();
    this.socket = null;
    this.recordDisconnected();
  }

  override async print(payload: PrintPayload): Promise<DriverActionResult> {
    const startedAt = Date.now();
    try {
      if (!this.socket?.isOpen) {
        const isReconnect = this.socket !== null;
        await this.connect();
        if (isReconnect) {
          this.recordReconnect();
        }
      }
      const socket = this.socket;
      if (!socket) {
        throw new Error('Network printer is not connected');
      }

      const buffer = decodePrintPayload(payload);
      await socket.write(buffer);
      this.touchActivity();
      this.recordPrintSuccess(buffer.length, Date.now() - startedAt);
      this.logger.info('Bytes sent to network printer', { driver: this.driverName, bytes: buffer.length });
      return { success: true, message: `Sent ${buffer.length} bytes to ${this.host}:${this.port}` };
    } catch (error) {
      this.recordFailure(error);
      const message = error instanceof Error ? error.message : 'Unknown network print error';
      this.logger.error('Network print failed', { driver: this.driverName, host: this.host, error: message });
      return { success: false, message };
    }
  }

  override async getStatus(): Promise<PrinterStatusValue> {
    return this.socket?.isOpen ? PrinterStatusValue.Online : PrinterStatusValue.Offline;
  }
}
