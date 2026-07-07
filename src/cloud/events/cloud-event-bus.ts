import { EventEmitter } from 'node:events';

/**
 * Internal cross-module notifications for the cloud connector (Step 16) — WebSocketClient,
 * HeartbeatService, RegistrationService, and OfflineSyncService all publish/subscribe here
 * instead of holding direct references to each other.
 */
export enum CloudEventType {
  ConnectionOpening = 'connection.opening',
  ConnectionOpened = 'connection.opened',
  ConnectionClosed = 'connection.closed',
  ConnectionError = 'connection.error',
  Authenticated = 'auth.authenticated',
  AuthenticationFailed = 'auth.failed',
  TokenRefreshed = 'auth.token-refreshed',
  MessageReceived = 'message.received',
  MessageSent = 'message.sent',
  MessageRejected = 'message.rejected',
  RegistrationCompleted = 'registration.completed',
  RegistrationFailed = 'registration.failed',
  Unregistered = 'registration.removed',
  ConfigUpdated = 'config.updated',
  PresenceChanged = 'presence.changed',
  HeartbeatSent = 'heartbeat.sent',
  HeartbeatAcknowledged = 'heartbeat.acknowledged',
  HeartbeatMissed = 'heartbeat.missed',
}

export interface CloudEventPayload {
  timestamp: string;
  message?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export class CloudEventBus extends EventEmitter {
  emitEvent(type: CloudEventType, payload: CloudEventPayload): void {
    this.emit(type, payload);
    this.emit('event', type, payload);
  }
}
