import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import pino, { type Logger as PinoLogger } from 'pino';

export type LogMeta = Record<string, unknown>;

/** Structured logger writing to both stdout and a rotating-free log file under logs/. */
export class LoggerService {
  private readonly pinoLogger: PinoLogger;
  readonly logFilePath: string;

  constructor(logsDir: string) {
    mkdirSync(logsDir, { recursive: true });
    this.logFilePath = join(logsDir, 'app.log');
    const logFilePath = this.logFilePath;

    this.pinoLogger = pino(
      { level: 'debug', timestamp: pino.stdTimeFunctions.isoTime },
      pino.multistream([
        { stream: process.stdout, level: 'debug' },
        { stream: pino.destination({ dest: logFilePath, mkdir: true }), level: 'debug' },
      ]),
    );
  }

  /** Exposes the underlying pino instance so Fastify can reuse it (via `loggerInstance`). */
  get raw(): PinoLogger {
    return this.pinoLogger;
  }

  info(message: string, meta?: LogMeta): void {
    this.pinoLogger.info(meta ?? {}, message);
  }

  warn(message: string, meta?: LogMeta): void {
    this.pinoLogger.warn(meta ?? {}, message);
  }

  error(message: string, meta?: LogMeta): void {
    this.pinoLogger.error(meta ?? {}, message);
  }

  debug(message: string, meta?: LogMeta): void {
    this.pinoLogger.debug(meta ?? {}, message);
  }

  /** Config hot-reload (Step 7) — pino's `.level` is a live setter, no restart needed. */
  setLevel(level: string): void {
    this.pinoLogger.level = level;
  }

  get level(): string {
    return this.pinoLogger.level;
  }

  /** Graceful shutdown (Step 4) — waits for buffered log lines to actually hit disk before exit. */
  flush(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof this.pinoLogger.flush === 'function') {
        this.pinoLogger.flush(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
