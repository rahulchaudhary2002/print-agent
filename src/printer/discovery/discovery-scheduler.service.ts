import type { LoggerService } from '../../services/index.js';
import type { DiscoveryManager, DiscoveryRunOptions } from './discovery-manager.service.js';
import type { DiscoveryDiff } from './types/index.js';

export interface DiscoverySchedulerOptions {
  /** Run one scan as soon as `start()` is called. Defaults to `true`. */
  runOnStartup?: boolean | undefined;
  /** Periodic scan cadence; `0`/`undefined` disables the periodic timer. */
  intervalMs?: number | undefined;
  /** Minimum gap between two automatic (startup/periodic) scans — manual scans always run. */
  debounceMs?: number | undefined;
}

const DEFAULT_DEBOUNCE_MS = 5000;

/**
 * Schedules discovery scans (Step 7) — one at startup, one on a periodic interval, and on-demand
 * manual scans via the API. Overlapping calls reuse the same in-flight scan instead of racing
 * two hardware sweeps at once; automatic triggers are additionally debounced against each other.
 */
export class DiscoveryScheduler {
  private timer: NodeJS.Timeout | null = null;
  private lastAutoScanAt = 0;
  private scanInFlight: Promise<DiscoveryDiff> | null = null;
  private started = false;
  private intervalMs: number | undefined;

  constructor(
    private readonly discoveryManager: DiscoveryManager,
    private readonly logger: LoggerService,
    private readonly options: DiscoverySchedulerOptions = {},
  ) {
    this.intervalMs = options.intervalMs;
  }

  async start(): Promise<void> {
    this.started = true;
    if (this.options.runOnStartup ?? true) {
      await this.trigger('startup');
    }
    this.restartTimer();
  }

  stop(): void {
    this.started = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Service watchdog (Step 8) / GET /service/workers. */
  get isRunning(): boolean {
    return this.started;
  }

  /** Config hot-reload (Step 7) — replaces the periodic cadence without a full restart. */
  setIntervalMs(intervalMs: number | undefined): void {
    this.intervalMs = intervalMs;
    if (this.started) {
      this.restartTimer();
    }
  }

  private restartTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.intervalMs) {
      this.timer = setInterval(() => {
        this.trigger('periodic').catch((error: unknown) => this.logger.error('Periodic discovery scan failed', { error }));
      }, this.intervalMs);
      this.timer.unref();
      this.logger.info('Discovery scheduler timer (re)started', { intervalMs: this.intervalMs });
    }
  }

  async runManualScan(runOptions?: DiscoveryRunOptions): Promise<DiscoveryDiff> {
    return this.trigger('manual', runOptions);
  }

  private async trigger(reason: 'startup' | 'periodic' | 'manual', runOptions?: DiscoveryRunOptions): Promise<DiscoveryDiff> {
    if (this.scanInFlight) {
      this.logger.debug('Discovery scan already in flight, reusing it', { reason });
      return this.scanInFlight;
    }

    const debounceMs = this.options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    if (reason !== 'manual' && Date.now() - this.lastAutoScanAt < debounceMs) {
      this.logger.debug('Skipping automatic discovery scan, debounced', { reason });
      return { added: [], removed: [], unchanged: this.discoveryManager.getCached(), all: this.discoveryManager.getCached(), scannedAt: new Date().toISOString() };
    }

    this.scanInFlight = this.discoveryManager.runScan(runOptions).finally(() => {
      this.scanInFlight = null;
      this.lastAutoScanAt = Date.now();
    });
    return this.scanInFlight;
  }
}
