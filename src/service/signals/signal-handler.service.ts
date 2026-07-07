import type { LoggerService } from '../../services/index.js';

export type ShutdownSignal = 'SIGINT' | 'SIGTERM' | 'SIGBREAK';

const HANDLED_SIGNALS: ShutdownSignal[] = ['SIGINT', 'SIGTERM', 'SIGBREAK'];

/**
 * Registers OS signal handlers (Step 4) — SIGINT/SIGTERM on every platform, SIGBREAK for
 * Windows console close/Ctrl+Break. Node ignores `process.on('SIGBREAK', ...)` on non-Windows
 * platforms rather than erroring, so registering all three unconditionally is safe everywhere.
 * A second signal while already shutting down is logged and ignored — shutdown is not restarted
 * or interrupted by an impatient second Ctrl+C.
 */
export class SignalHandler {
  private shuttingDown = false;

  constructor(
    private readonly logger: LoggerService,
    private readonly onShutdown: (signal: ShutdownSignal) => void,
  ) {}

  register(): void {
    for (const signal of HANDLED_SIGNALS) {
      process.on(signal, () => this.handle(signal));
    }
  }

  private handle(signal: ShutdownSignal): void {
    if (this.shuttingDown) {
      this.logger.warn('Shutdown already in progress, ignoring additional signal', { signal });
      return;
    }
    this.shuttingDown = true;
    this.logger.info(`Received ${signal}`);
    this.onShutdown(signal);
  }
}
