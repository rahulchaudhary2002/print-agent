import { deserializeDocument } from '../../document/index.js';
import { PipelineEventType, type PipelineEventEmitter, type PipelineEventPayload } from '../../events/index.js';
import type { MetricsService } from '../../pipeline/index.js';
import type { JobService } from '../../queue/index.js';
import type { LoggerService } from '../../services/index.js';
import { AppError } from '../../utils/index.js';
import type { AuthStore } from '../auth/index.js';
import { CloudEventType, type CloudEventBus } from '../events/index.js';
import type { HeartbeatService } from '../heartbeat/index.js';
import {
  CloudProtocolError,
  MessageType,
  PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  authPayloadSchema,
  configUpdatePayloadSchema,
  createMessage,
  errorPayloadSchema,
  isProtocolVersionSupported,
  jobCancelPayloadSchema,
  jobRetryPayloadSchema,
  printJobPayloadSchema,
  versionPayloadSchema,
  type CloudMessage,
} from '../protocol/index.js';
import type { ReconnectPolicy } from '../reconnect/index.js';
import type { MachineIdentityService, RegistrationService } from '../registration/index.js';
import type { OfflineSyncService } from '../sync/index.js';
import type { ConnectionDiagnosticsSnapshot, WebSocketClient } from '../websocket/index.js';
import type { ZodType } from 'zod';
import { resolveCloudConnectorConfig, type CloudConnectorConfig, type ResolvedCloudConnectorConfig } from './cloud-connector-config.js';
import { CloudConfigStore, type CloudRuntimeSettings } from './cloud-runtime-settings.js';
import { AgentPresence, PresenceTracker } from './presence.js';
import { SlidingWindowRateLimiter } from './rate-limiter.js';

export interface CloudStatus {
  connected: boolean;
  presence: AgentPresence;
  machineId: string | null;
  protocolVersion: string;
  bufferedMessages: number;
}

export interface CloudDiagnosticsSnapshot {
  connection: ConnectionDiagnosticsSnapshot;
  missedHeartbeats: number;
  bufferedMessages: number;
}

/**
 * The single assembler for the whole cloud module (Step 16: everything below it talks through
 * CloudEventBus/PipelineEventEmitter, not to each other directly). Owns the incoming-command
 * handlers (PRINT_JOB/JOB_CANCEL/JOB_RETRY/CONFIG_UPDATE) and the outgoing job-lifecycle relay.
 * Knows the document engine only through `deserializeDocument` (plain data in, plain data out)
 * and the queue only through JobService's public API — never a renderer or driver directly.
 */
export class CloudConnector {
  private readonly config: ResolvedCloudConnectorConfig;
  private readonly rateLimiter: SlidingWindowRateLimiter;
  private readonly presenceTracker: PresenceTracker;
  private readonly cloudConfigStore: CloudConfigStore;
  private connecting = false;

  constructor(
    config: CloudConnectorConfig,
    private readonly machineIdentityService: MachineIdentityService,
    private readonly registrationService: RegistrationService,
    private readonly authStore: AuthStore,
    private readonly webSocketClient: WebSocketClient,
    private readonly reconnectPolicy: ReconnectPolicy,
    private readonly heartbeatService: HeartbeatService,
    private readonly offlineSyncService: OfflineSyncService,
    private readonly jobService: JobService,
    private readonly metricsService: MetricsService,
    private readonly pipelineEvents: PipelineEventEmitter,
    private readonly events: CloudEventBus,
    private readonly logger: LoggerService,
    cloudConfigFilePath: string,
  ) {
    this.config = resolveCloudConnectorConfig(config);
    this.rateLimiter = new SlidingWindowRateLimiter(this.config.maxIncomingCommandsPerMinute, 60_000);
    this.presenceTracker = new PresenceTracker(events);
    this.cloudConfigStore = new CloudConfigStore(cloudConfigFilePath);

    this.webSocketClient.onMessage((message) => this.handleMessage(message));
    this.wireConnectionEvents();
    this.wirePipelineEventRelay();
  }

  async initialize(): Promise<void> {
    await this.machineIdentityService.load();
    await this.authStore.load();
    await this.cloudConfigStore.load();
  }

  async register(): Promise<void> {
    const response = await this.registrationService.register();
    await this.cloudConfigStore.merge({ heartbeatIntervalMs: response.heartbeatIntervalMs });
  }

  async unregister(): Promise<void> {
    this.disconnect();
    await this.registrationService.unregister();
  }

  connect(): void {
    if (this.connecting) {
      return;
    }
    if (!this.authStore.current) {
      throw new AppError('Cannot connect: no cloud credentials — register first', 400);
    }
    this.connecting = true;
    this.reconnectPolicy.reset();
    this.webSocketClient.connect();
  }

  disconnect(): void {
    this.connecting = false;
    this.heartbeatService.stop();
    this.webSocketClient.disconnect();
    this.presenceTracker.set(AgentPresence.Offline);
  }

  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  getStatus(): CloudStatus {
    let machineId: string | null = null;
    try {
      machineId = this.machineIdentityService.get().machineUuid;
    } catch {
      machineId = null;
    }
    return {
      connected: this.webSocketClient.isConnected,
      presence: this.presenceTracker.current,
      machineId,
      protocolVersion: PROTOCOL_VERSION,
      bufferedMessages: this.offlineSyncService.bufferedCount,
    };
  }

  getDiagnostics(): CloudDiagnosticsSnapshot {
    return {
      connection: this.webSocketClient.diagnostics.snapshot(),
      missedHeartbeats: this.heartbeatService.missedHeartbeatCount,
      bufferedMessages: this.offlineSyncService.bufferedCount,
    };
  }

  getConfig(): { serverUrl: string; allowInsecure: boolean } & CloudRuntimeSettings {
    return {
      serverUrl: this.config.serverUrl,
      allowInsecure: this.config.allowInsecure,
      ...this.cloudConfigStore.current,
    };
  }

  private wireConnectionEvents(): void {
    this.events.on(CloudEventType.ConnectionOpened, () => {
      this.sendVersionHandshake();
      this.authenticate();
      this.presenceTracker.set(AgentPresence.Online);
      const heartbeatIntervalMs = this.cloudConfigStore.current.heartbeatIntervalMs ?? this.config.heartbeatIntervalMs;
      this.heartbeatService.start(heartbeatIntervalMs);
    });
    this.events.on(CloudEventType.ConnectionClosed, () => {
      this.heartbeatService.stop();
      this.presenceTracker.set(AgentPresence.Offline);
    });
  }

  private sendVersionHandshake(): void {
    this.webSocketClient.send(
      createMessage(MessageType.Version, { protocolVersion: PROTOCOL_VERSION, supportedVersions: SUPPORTED_PROTOCOL_VERSIONS }),
    );
  }

  private authenticate(): void {
    const credentials = this.authStore.current;
    if (!credentials) {
      return;
    }
    this.webSocketClient.send(createMessage(MessageType.Auth, { agentToken: credentials.agentToken }));
  }

  /** Step 10 — relays pipeline job-lifecycle events outward. Only ever sees plain event payloads. */
  private wirePipelineEventRelay(): void {
    const relay = (pipelineType: PipelineEventType, cloudType: MessageType): void => {
      this.pipelineEvents.on(pipelineType, (payload: PipelineEventPayload) => {
        this.offlineSyncService.enqueue(createMessage(cloudType, { jobId: payload.jobId, ...payload.metadata }));

        if (cloudType === MessageType.JobStarted) {
          this.presenceTracker.set(AgentPresence.Printing);
        }
        if ([MessageType.JobCompleted, MessageType.JobFailed, MessageType.JobCancelled].includes(cloudType)) {
          this.presenceTracker.set(this.webSocketClient.isConnected ? AgentPresence.Online : AgentPresence.Offline);
          this.offlineSyncService.enqueue(createMessage(MessageType.Metrics, this.metricsService.snapshot()));
        }
      });
    };

    relay(PipelineEventType.JobQueued, MessageType.JobAccepted);
    relay(PipelineEventType.JobStarted, MessageType.JobStarted);
    relay(PipelineEventType.RenderingStarted, MessageType.RenderingStarted);
    relay(PipelineEventType.PrintingStarted, MessageType.PrintingStarted);
    relay(PipelineEventType.JobCompleted, MessageType.JobCompleted);
    relay(PipelineEventType.JobFailed, MessageType.JobFailed);
    relay(PipelineEventType.JobCancelled, MessageType.JobCancelled);
  }

  private handleMessage(message: CloudMessage): void {
    switch (message.type) {
      case MessageType.Version:
        this.handleVersion(message);
        return;
      case MessageType.Auth:
        this.handleAuth(message);
        return;
      case MessageType.PrintJob:
        this.withRateLimit(message.id, () => this.handlePrintJob(message));
        return;
      case MessageType.JobCancel:
        this.withRateLimit(message.id, () => this.handleJobCancel(message));
        return;
      case MessageType.JobRetry:
        this.withRateLimit(message.id, () => this.handleJobRetry(message));
        return;
      case MessageType.ConfigUpdate:
        this.withRateLimit(message.id, () => void this.handleConfigUpdate(message));
        return;
      case MessageType.Error:
        this.handleError(message);
        return;
      default:
        this.logger.debug('Received cloud message with no agent-side handler', { type: message.type });
    }
  }

  private withRateLimit(messageId: string, action: () => void): void {
    if (!this.rateLimiter.tryAcquire()) {
      this.logger.warn('Incoming cloud command rate-limited', { messageId });
      this.ackError(messageId, new AppError('Rate limit exceeded', 429));
      return;
    }
    action();
  }

  private handleVersion(message: CloudMessage): void {
    const result = versionPayloadSchema.safeParse(message.payload);
    if (!result.success) {
      return;
    }
    if (!isProtocolVersionSupported(result.data.protocolVersion)) {
      this.logger.error('Cloud protocol version incompatible — disconnecting', {
        serverVersion: result.data.protocolVersion,
        supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
      });
      this.disconnect();
    }
  }

  private handleAuth(message: CloudMessage): void {
    const result = authPayloadSchema.safeParse(message.payload);
    if (!result.success || result.data.success === false) {
      this.webSocketClient.diagnostics.recordAuthenticationFailure();
      this.events.emitEvent(CloudEventType.AuthenticationFailed, { timestamp: new Date().toISOString() });
      this.presenceTracker.set(AgentPresence.Error);
      return;
    }
    this.events.emitEvent(CloudEventType.Authenticated, { timestamp: new Date().toISOString() });
  }

  /** Step 9 — validate, deserialize, save, queue, acknowledge. Printing only ever happens through the queue. */
  private handlePrintJob(message: CloudMessage): void {
    try {
      const payload = this.parseOrThrow(printJobPayloadSchema, message.payload, message.type);
      const document = deserializeDocument(JSON.stringify(payload.document));
      const job = this.jobService.createDocumentJob(document, { printerId: payload.printerId, priority: payload.priority });
      this.ack(message.id, true);
      this.offlineSyncService.enqueue(
        createMessage(MessageType.JobAccepted, { jobId: job.id, remoteJobId: payload.remoteJobId }),
      );
    } catch (error) {
      this.ackError(message.id, error);
    }
  }

  private handleJobCancel(message: CloudMessage): void {
    try {
      const payload = this.parseOrThrow(jobCancelPayloadSchema, message.payload, message.type);
      this.jobService.cancel(payload.jobId);
      this.ack(message.id, true);
    } catch (error) {
      this.ackError(message.id, error);
    }
  }

  private handleJobRetry(message: CloudMessage): void {
    try {
      const payload = this.parseOrThrow(jobRetryPayloadSchema, message.payload, message.type);
      this.jobService.retry(payload.jobId);
      this.ack(message.id, true);
    } catch (error) {
      this.ackError(message.id, error);
    }
  }

  private async handleConfigUpdate(message: CloudMessage): Promise<void> {
    try {
      const payload = this.parseOrThrow(configUpdatePayloadSchema, message.payload, message.type);
      await this.cloudConfigStore.merge(payload);
      this.events.emitEvent(CloudEventType.ConfigUpdated, { timestamp: new Date().toISOString(), metadata: { ...payload } });
      if (payload.heartbeatIntervalMs) {
        this.heartbeatService.start(payload.heartbeatIntervalMs);
      }
      this.ack(message.id, true);
    } catch (error) {
      this.ackError(message.id, error);
    }
  }

  private handleError(message: CloudMessage): void {
    const result = errorPayloadSchema.safeParse(message.payload);
    this.logger.error('Cloud server reported an error', { message: result.success ? result.data.message : 'unknown' });
  }

  private parseOrThrow<T>(schema: ZodType<T>, payload: unknown, type: MessageType): T {
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new CloudProtocolError(`Invalid payload for ${type}: ${result.error.issues.map((issue) => issue.message).join(', ')}`);
    }
    return result.data;
  }

  private ack(messageId: string, success: boolean): void {
    this.webSocketClient.send(createMessage(MessageType.Ack, { messageId, success }));
  }

  private ackError(messageId: string, error: unknown): void {
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.warn('Failed to process cloud command', { messageId, error: reason });
    this.webSocketClient.send(createMessage(MessageType.Ack, { messageId, success: false }));
  }
}
