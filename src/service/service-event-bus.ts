import { EventEmitter } from 'node:events';

/** Mirrors PipelineEventEmitter/CloudEventBus/PrinterEventBus's shape — service-lifecycle notifications. */
export enum ServiceEventType {
  StartupCompleted = 'service.startup.completed',
  StartupFailed = 'service.startup.failed',
  ShutdownStarted = 'service.shutdown.started',
  ShutdownCompleted = 'service.shutdown.completed',
  ConfigurationReloaded = 'service.configuration.reloaded',
  WorkerRestarted = 'service.worker.restarted',
  WorkerFailed = 'service.worker.failed',
  CrashDetected = 'service.crash.detected',
  UnhandledException = 'service.unhandled-exception',
  UnhandledRejection = 'service.unhandled-rejection',
  ResourceThresholdExceeded = 'service.resource-threshold-exceeded',
}

export interface ServiceEventPayload {
  timestamp: string;
  message?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export class ServiceEventBus extends EventEmitter {
  emitEvent(type: ServiceEventType, payload: ServiceEventPayload): void {
    this.emit(type, payload);
    this.emit('event', type, payload);
  }
}
