import type { LoggerService } from '../../services/index.js';
import type { PrinterCacheService } from '../cache/index.js';
import type { DiscoveryScheduler } from '../discovery/index.js';
import type { PrinterHealthMonitor } from '../health/index.js';

const CACHE_SWEEP_INTERVAL_MS = 60_000;

/**
 * Single lifecycle entry point for the "always-on" side of this system — starts/stops the
 * discovery scheduler and health monitor together, and periodically sweeps expired cache
 * entries (Step 13). Keeps `index.ts` from having to know the startup order of three services;
 * it only needs to construct and `.start()` this one.
 */
export class PrinterMonitor {
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly discoveryScheduler: DiscoveryScheduler,
    private readonly healthMonitor: PrinterHealthMonitor,
    private readonly cache: PrinterCacheService,
    private readonly logger: LoggerService,
  ) {}

  async start(): Promise<void> {
    await this.discoveryScheduler.start();
    this.healthMonitor.start();
    this.sweepTimer = setInterval(() => this.cache.sweep(), CACHE_SWEEP_INTERVAL_MS);
    this.sweepTimer.unref();
    this.logger.info('Printer monitor started (discovery scheduler + health monitor)');
  }

  stop(): void {
    this.discoveryScheduler.stop();
    this.healthMonitor.stop();
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }
}
