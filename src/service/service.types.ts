export type ServiceStatusState = 'starting' | 'running' | 'stopping' | 'stopped' | 'recovering' | 'error';

export type WorkerRunState = 'running' | 'stopped' | 'error';

export interface WorkerStatus {
  name: string;
  status: WorkerRunState;
  restartCount: number;
  lastRestartAt: string | null;
  lastError: string | null;
}

/** One named lifecycle stage the watchdog/ServiceManager can start, stop, and query. */
export interface ManagedWorker {
  name: string;
  start: () => void | Promise<void>;
  stop: () => void | Promise<void>;
  isRunning: () => boolean;
}

export interface StartupStageReport {
  stage: string;
  durationMs: number;
  success: boolean;
  error?: string | undefined;
}

export interface StartupReport {
  stages: StartupStageReport[];
  totalDurationMs: number;
  startedAt: string;
  completedAt: string;
}

export interface ShutdownStageReport {
  stage: string;
  durationMs: number;
  success: boolean;
  error?: string | undefined;
}

export interface ShutdownReport {
  signal: string;
  stages: ShutdownStageReport[];
  totalDurationMs: number;
}

export interface ServiceStatusSnapshot {
  status: ServiceStatusState;
  pid: number;
  version: string;
  startedAt: string;
  appUptimeSeconds: number;
  serviceUptimeSeconds: number;
  recoveredFromCrash: boolean;
}

/** Per-worker toggles for Step 14 — which failures the watchdog is allowed to self-heal automatically. */
export interface RecoveryPolicies {
  workerRestart: boolean;
  driverReconnect: boolean;
  queueRecovery: boolean;
  discoveryRestart: boolean;
  healthMonitorRestart: boolean;
}

export const DEFAULT_RECOVERY_POLICIES: RecoveryPolicies = {
  workerRestart: true,
  driverReconnect: true,
  queueRecovery: true,
  discoveryRestart: true,
  healthMonitorRestart: true,
};
