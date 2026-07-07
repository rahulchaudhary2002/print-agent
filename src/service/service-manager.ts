import type { AppConfig } from '../config/index.js';
import type { LoggerService } from '../services/index.js';
import type { ProcessInfo } from './process/index.js';
import { ServiceEventType, type ServiceEventBus } from './service-event-bus.js';
import type { ManagedWorker, RecoveryPolicies, ServiceStatusSnapshot, ServiceStatusState, StartupReport, WorkerStatus } from './service.types.js';
import type { ProcessWatchdog } from './watchdog/index.js';

export interface ServiceManagerCallbacks {
  /** Re-reads configuration and applies every hot-reloadable setting (Step 7). */
  reload: () => Promise<AppConfig>;
  /** Runs the full graceful shutdown flow and exits the process (Step 4) — never resolves normally. */
  shutdown: (signal: string) => Promise<void>;
}

/**
 * Central orchestrator (Step 2) for the service's own lifecycle — distinct from the print
 * pipeline it manages. Doesn't duplicate worker start/stop logic itself; every managed worker
 * (queue, discovery, health monitor, REST API) is registered once with `ProcessWatchdog`, and
 * `ServiceManager` delegates to it for both status reporting and restarts, so there's exactly
 * one place a worker's lifecycle is actually implemented.
 */
export class ServiceManager {
  private status: ServiceStatusState = 'starting';
  private serviceStartedAt: string | null = null;
  private startupReport: StartupReport | null = null;
  private recoveredFromCrash = false;
  private recoveryPolicies: RecoveryPolicies;

  constructor(
    private readonly logger: LoggerService,
    private readonly eventBus: ServiceEventBus,
    private readonly processInfo: ProcessInfo,
    private readonly watchdog: ProcessWatchdog,
    private readonly version: string,
    private readonly callbacks: ServiceManagerCallbacks,
    recoveryPolicies: RecoveryPolicies,
  ) {
    this.recoveryPolicies = recoveryPolicies;
    this.watchdog.setRecoveryPolicies(recoveryPolicies);
  }

  registerWorker(worker: ManagedWorker): void {
    this.watchdog.registerWorker(worker);
  }

  setRecoveryPolicies(policies: RecoveryPolicies): void {
    this.recoveryPolicies = policies;
    this.watchdog.setRecoveryPolicies(policies);
  }

  getRecoveryPolicies(): RecoveryPolicies {
    return this.recoveryPolicies;
  }

  markRecoveredFromCrash(): void {
    this.recoveredFromCrash = true;
  }

  setStartupReport(report: StartupReport): void {
    this.startupReport = report;
  }

  getStartupReport(): StartupReport | null {
    return this.startupReport;
  }

  /** Called once the REST API is listening and the agent is genuinely ready to serve traffic. */
  markRunning(): void {
    this.status = 'running';
    this.serviceStartedAt = new Date().toISOString();
    this.eventBus.emitEvent(ServiceEventType.StartupCompleted, { timestamp: this.serviceStartedAt });
  }

  markError(message: string): void {
    this.status = 'error';
    this.logger.error('Service entered error state', { message });
  }

  getStatus(): ServiceStatusSnapshot {
    const now = Date.now();
    const serviceUptimeSeconds = this.serviceStartedAt ? (now - new Date(this.serviceStartedAt).getTime()) / 1000 : 0;
    return {
      status: this.status,
      pid: this.processInfo.pid,
      version: this.version,
      startedAt: this.serviceStartedAt ?? new Date().toISOString(),
      appUptimeSeconds: this.processInfo.appUptimeSeconds,
      serviceUptimeSeconds,
      recoveredFromCrash: this.recoveredFromCrash,
    };
  }

  getWorkers(): WorkerStatus[] {
    return this.watchdog.getWorkerStatuses();
  }

  /** POST /service/restart — restarts every registered worker; the process itself keeps running. */
  async restart(): Promise<WorkerStatus[]> {
    this.status = 'recovering';
    this.logger.info('Service restart requested');
    for (const worker of this.watchdog.getWorkerStatuses()) {
      await this.watchdog.restartWorker(worker.name, 'manual restart');
    }
    this.status = 'running';
    return this.getWorkers();
  }

  /** POST /service/reload — hot-reload, no process restart. */
  async reload(): Promise<AppConfig> {
    this.logger.info('Configuration reload requested');
    const config = await this.callbacks.reload();
    this.eventBus.emitEvent(ServiceEventType.ConfigurationReloaded, { timestamp: new Date().toISOString() });
    return config;
  }

  /** Handles SIGINT/SIGTERM/SIGBREAK or a fatal in-process error — delegates the actual flow to `index.ts`. */
  async gracefulShutdown(signal: string): Promise<void> {
    if (this.status === 'stopping' || this.status === 'stopped') {
      return;
    }
    this.status = 'stopping';
    this.eventBus.emitEvent(ServiceEventType.ShutdownStarted, { timestamp: new Date().toISOString(), metadata: { signal } });
    await this.callbacks.shutdown(signal);
    this.status = 'stopped';
  }
}
