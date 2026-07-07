import net from 'node:net';

export interface TcpConnectionOptions {
  host: string;
  port: number;
  connectTimeoutMs?: number;
  /** Node's socket timeout covers both read and write inactivity — there's no separate read/write timeout at the TCP layer. */
  idleTimeoutMs?: number;
}

/**
 * Thin wrapper around a single TCP socket: connect-once, write, and inactivity/close teardown.
 * Carries no logging or business logic — drivers own that; this just owns the socket.
 */
export class TcpConnection {
  private socket: net.Socket | null = null;

  constructor(private readonly options: TcpConnectionOptions) {}

  get isOpen(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }

  async open(onIdle: () => void, onClose: () => void): Promise<void> {
    if (this.isOpen) {
      return;
    }
    const { host, port, connectTimeoutMs = 5000, idleTimeoutMs = 60_000 } = this.options;

    await new Promise<void>((resolve, reject) => {
      const socket = new net.Socket();
      const onConnectError = (error: Error): void => {
        socket.destroy();
        reject(new Error(`Failed to connect to ${host}:${port}: ${error.message}`));
      };
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Connection to ${host}:${port} timed out after ${connectTimeoutMs}ms`));
      }, connectTimeoutMs);

      socket.once('error', onConnectError);
      socket.connect(port, host, () => {
        clearTimeout(timer);
        socket.removeListener('error', onConnectError);
        socket.setTimeout(idleTimeoutMs);
        socket.on('timeout', onIdle);
        socket.on('close', onClose);
        socket.on('error', () => {
          /* 'close' fires right after and drives cleanup; this only prevents an unhandled 'error' crash. */
        });
        this.socket = socket;
        resolve();
      });
    });
  }

  async write(buffer: Buffer): Promise<void> {
    const socket = this.socket;
    if (!socket) {
      throw new Error('Socket is not connected');
    }
    await new Promise<void>((resolve, reject) => {
      socket.write(buffer, (error) => (error ? reject(error) : resolve()));
    });
  }

  async close(): Promise<void> {
    const socket = this.socket;
    if (!socket) {
      return;
    }
    this.socket = null;
    await new Promise<void>((resolve) => socket.end(() => resolve()));
  }
}
