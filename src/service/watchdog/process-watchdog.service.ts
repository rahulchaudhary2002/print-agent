import type { LoggerService } from '../../services/index.js';
import { ServiceEventType, type ServiceEventBus } from '../service-event-bus.js';
import { DEFAULT_RECOVERY_POLICIES, type ManagedWorker, type RecoveryPolicies, type WorkerStatus } from '../service.types.js';

export interface WatchdogOptions {
  checkIntervalMs?: number | undefined;
  maxMemoryMb?: number | undefined;
  maxCpuPercent?: number | undefined;
}

const DEFAULT_CHECK_INTERVAL_MS = 30_000;

/**
 * Step 6 — resource monitoring, unhandled-error capture, and worker self-healing (Step 14),
 * all in one place since they share the same tick loop and event bus. Uncaught exceptions and
 * unhandled rejections are logged and reported, then handed to `onFatal` rather than swallowed:
 * per Node's own guidance, a process that hit an uncaught exception is in an unknown state and
 * should exit — `onFatal` is expected to run a bounded graceful shutdown and exit, letting the
 * OS service manager (systemd/Scheduled Task/launchd) restart a clean process. That restart is
 * the actual "worker restart" for anything the watchdog itself can't safely fix in-process.
 * "Safe" in-process restarts are limited to workers that report themselves stopped while the
 * process as a whole is healthy (e.g. a scheduler's timer got cleared unexpectedly).
 */
export class ProcessWatchdog {
  private timer: NodeJS.Timeout | null = null;
  private lastCpuUsage = process.cpuUsage();
  private lastCheckAt = Date.now();
  private readonly workers: ManagedWorker[] = [];
  private readonly restartCounts = new Map<string, number>();
  private readonly lastRestartAt = new Map<string, string>();
  private readonly lastWorkerError = new Map<string, string>();
  private recoveryPolicies: RecoveryPolicies = DEFAULT_RECOVERY_POLICIES;

  constructor(
    private readonly logger: LoggerService,
    private readonly eventBus: ServiceEventBus,
    private readonly onFatal: (kind: 'exception' | 'rejection', error: unknown) => void,
    private readonly options: WatchdogOptions = {},
  ) {}

  registerWorker(worker: ManagedWorker): void {
    this.workers.push(worker);
    this.restartCounts.set(worker.name, 0);
  }

  setRecoveryPolicies(policies: RecoveryPolicies): void {
    this.recoveryPolicies = policies;
  }

  start(): void {
    process.on('uncaughtException', this.handleUncaughtException);
    process.on('unhandledRejection', this.handleUnhandledRejection);
    this.timer = setInterval(() => this.tick(), this.options.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS);
    this.timer.unref();
    this.logger.info('Process watchdog started', { checkIntervalMs: this.options.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS });
  }

  stop(): void {
    process.off('uncaughtException', this.handleUncaughtException);
    process.off('unhandledRejection', this.handleUnhandledRejection);
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getWorkerStatuses(): WorkerStatus[] {
    return this.workers.map((worker) => ({
      name: worker.name,
      status: worker.isRunning() ? 'running' : this.lastWorkerError.has(worker.name) ? 'error' : 'stopped',
      restartCount: this.restartCounts.get(worker.name) ?? 0,
      lastRestartAt: this.lastRestartAt.get(worker.name) ?? null,
      lastError: this.lastWorkerError.get(worker.name) ?? null,
    }));
  }

  async restartWorker(name: string, reason: string): Promise<boolean> {
    const worker = this.workers.find((candidate) => candidate.name === name);
    if (!worker) {
      return false;
    }
    await this.doRestart(worker, reason);
    return true;
  }

  private tick(): void {
    this.checkResources();
    if (this.recoveryPolicies.workerRestart) {
      this.checkWorkers();
    }
  }

  private checkResources(): void {
    const memory = process.memoryUsage();
    const usedMb = Math.round(memory.rss / (1024 * 1024));
    if (this.options.maxMemoryMb && usedMb > this.options.maxMemoryMb) {
      this.logger.warn('Memory usage above configured threshold', { usedMb, maxMemoryMb: this.options.maxMemoryMb });
      this.eventBus.emitEvent(ServiceEventType.ResourceThresholdExceeded, {
        timestamp: new Date().toISOString(),
        metadata: { resource: 'memory', usedMb },
      });
    }

    const cpuDelta = process.cpuUsage(this.lastCpuUsage);
    const elapsedMs = Math.max(1, Date.now() - this.lastCheckAt);
    const cpuPercent = Math.round(((cpuDelta.user + cpuDelta.system) / 1000 / elapsedMs) * 100);
    this.lastCpuUsage = process.cpuUsage();
    this.lastCheckAt = Date.now();

    if (this.options.maxCpuPercent && cpuPercent > this.options.maxCpuPercent) {
      this.logger.warn('CPU usage above configured threshold', { cpuPercent, maxCpuPercent: this.options.maxCpuPercent });
      this.eventBus.emitEvent(ServiceEventType.ResourceThresholdExceeded, {
        timestamp: new Date().toISOString(),
        metadata: { resource: 'cpu', cpuPercent },
      });
    }
  }

  private checkWorkers(): void {
    for (const worker of this.workers) {
      if (!worker.isRunning()) {
        this.doRestart(worker, 'detected stopped').catch((error: unknown) =>
          this.logger.error('Worker restart attempt threw unexpectedly', { worker: worker.name, error }),
        );
      }
    }
  }

  private async doRestart(worker: ManagedWorker, reason: string): Promise<void> {
    try {
      await worker.start();
      const restartCount = (this.restartCounts.get(worker.name) ?? 0) + 1;
      this.restartCounts.set(worker.name, restartCount);
      this.lastRestartAt.set(worker.name, new Date().toISOString());
      this.lastWorkerError.delete(worker.name);
      this.logger.warn('Worker restarted', { worker: worker.name, reason, restartCount });
      this.eventBus.emitEvent(ServiceEventType.WorkerRestarted, {
        timestamp: new Date().toISOString(),
        metadata: { worker: worker.name, reason },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastWorkerError.set(worker.name, message);
      this.logger.error('Worker restart failed', { worker: worker.name, error: message });
      this.eventBus.emitEvent(ServiceEventType.WorkerFailed, {
        timestamp: new Date().toISOString(),
        message,
        metadata: { worker: worker.name },
      });
    }
  }

  private handleUncaughtException = (error: Error): void => {
    this.logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    this.eventBus.emitEvent(ServiceEventType.UnhandledException, { timestamp: new Date().toISOString(), message: error.message });
    this.onFatal('exception', error);
  };

  private handleUnhandledRejection = (reason: unknown): void => {
    const message = reason instanceof Error ? reason.message : String(reason);
    this.logger.error('Unhandled promise rejection', { reason: message });
    this.eventBus.emitEvent(ServiceEventType.UnhandledRejection, { timestamp: new Date().toISOString(), message });
    this.onFatal('rejection', reason);
  };
}
