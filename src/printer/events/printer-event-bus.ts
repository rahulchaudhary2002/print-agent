import { EventEmitter } from 'node:events';

/**
 * Internal cross-module notifications for the printer discovery/health/recovery subsystem
 * (Step 16) — mirrors CloudEventBus/PipelineEventEmitter's shape. Applications may subscribe
 * to this in the future; for now it's consumed internally (health monitor, recovery manager).
 */
export enum PrinterEventType {
  PrinterDiscovered = 'printer.discovered',
  PrinterRemoved = 'printer.removed',
  PrinterOnline = 'printer.online',
  PrinterOffline = 'printer.offline',
  ConfigurationChanged = 'printer.configuration.changed',
  HealthChanged = 'printer.health.changed',
  RecoveryStarted = 'printer.recovery.started',
  RecoveryCompleted = 'printer.recovery.completed',
}

export interface PrinterEventPayload {
  printerId?: string | undefined;
  timestamp: string;
  message?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export class PrinterEventBus extends EventEmitter {
  emitEvent(type: PrinterEventType, payload: PrinterEventPayload): void {
    this.emit(type, payload);
    this.emit('event', type, payload);
  }
}
