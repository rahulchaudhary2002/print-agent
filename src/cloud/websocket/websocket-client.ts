import WebSocket from 'ws';
import { CloudEventType, type CloudEventBus } from '../events/index.js';
import {
  MessageType,
  ackPayloadSchema,
  createMessage,
  messageEnvelopeSchema,
  ReplayGuard,
  type CloudMessage,
} from '../protocol/index.js';
import type { ReconnectPolicy } from '../reconnect/index.js';
import type { LoggerService } from '../../services/index.js';
import { AppError } from '../../utils/index.js';
import { ConnectionDiagnostics } from './connection-diagnostics.js';

export interface WebSocketClientOptions {
  url: string;
  /** Called fresh on every connection attempt — always reflects the current (possibly just-refreshed) token. */
  getToken: () => string | null;
  /** Dev/test only — allows `ws://`. Production URLs must be `wss://`. */
  allowInsecure?: boolean | undefined;
}

export type CloudMessageHandler = (message: CloudMessage) => void;

/**
 * The persistent connection (Step 5): connects with the current agent token, reconnects with
 * backoff on any drop, replies to server PINGs, resolves latency from ACK round-trips, and
 * validates + replay-guards every inbound frame before handing it to registered handlers.
 * Knows nothing about print jobs, documents, or drivers — CloudConnector interprets payloads.
 */
export class WebSocketClient {
  readonly diagnostics = new ConnectionDiagnostics();

  private socket: WebSocket | null = null;
  private manuallyDisconnected = true;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly replayGuard = new ReplayGuard();
  private readonly pendingAcks = new Map<string, number>();
  private readonly handlers: CloudMessageHandler[] = [];

  constructor(
    private readonly options: WebSocketClientOptions,
    private readonly reconnectPolicy: ReconnectPolicy,
    private readonly events: CloudEventBus,
    private readonly logger: LoggerService,
  ) {
    if (!options.allowInsecure && !options.url.startsWith('wss://')) {
      throw new AppError('Cloud WebSocket URL must use wss:// (set allowInsecure for local development)', 400);
    }
  }

  connect(): void {
    this.manuallyDisconnected = false;
    this.clearReconnectTimer();
    this.openSocket();
  }

  disconnect(): void {
    this.manuallyDisconnected = true;
    this.clearReconnectTimer();
    this.socket?.close(1000, 'Client disconnect');
  }

  get isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  send<TPayload>(message: CloudMessage<TPayload>): boolean {
    if (!this.isConnected || !this.socket) {
      return false;
    }
    this.socket.send(JSON.stringify(message));
    this.pendingAcks.set(message.id, Date.now());
    this.diagnostics.recordPacketSent();
    this.events.emitEvent(CloudEventType.MessageSent, {
      timestamp: new Date().toISOString(),
      metadata: { type: message.type, id: message.id },
    });
    return true;
  }

  onMessage(handler: CloudMessageHandler): void {
    this.handlers.push(handler);
  }

  private openSocket(): void {
    this.events.emitEvent(CloudEventType.ConnectionOpening, { timestamp: new Date().toISOString() });
    const token = this.options.getToken();
    const socket = new WebSocket(this.options.url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    socket.on('open', () => {
      this.reconnectPolicy.reset();
      this.diagnostics.recordConnected();
      this.events.emitEvent(CloudEventType.ConnectionOpened, { timestamp: new Date().toISOString() });
      this.logger.info('Cloud WebSocket connected');
    });

    socket.on('message', (data) => {
      this.diagnostics.recordPacketReceived();
      this.handleRawMessage(data.toString());
    });

    socket.on('close', (code, reason) => {
      this.diagnostics.recordDisconnected();
      this.socket = null;
      this.events.emitEvent(CloudEventType.ConnectionClosed, {
        timestamp: new Date().toISOString(),
        metadata: { code, reason: reason.toString() },
      });
      this.logger.warn('Cloud WebSocket closed', { code, reason: reason.toString() });
      if (!this.manuallyDisconnected) {
        this.scheduleReconnect();
      }
    });

    socket.on('error', (error) => {
      this.events.emitEvent(CloudEventType.ConnectionError, { timestamp: new Date().toISOString(), message: error.message });
      this.logger.warn('Cloud WebSocket error', { error: error.message });
    });

    this.socket = socket;
  }

  private scheduleReconnect(): void {
    this.diagnostics.recordReconnectAttempt();
    const delayMs = this.reconnectPolicy.nextDelayMs();
    this.logger.info('Scheduling cloud reconnect', { delayMs, attempt: this.reconnectPolicy.attemptCount });
    this.reconnectTimer = setTimeout(() => this.openSocket(), delayMs);
    this.reconnectTimer.unref();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private handleRawMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn('Rejected cloud message: not valid JSON');
      return;
    }

    const envelope = messageEnvelopeSchema.safeParse(parsed);
    if (!envelope.success) {
      this.logger.warn('Rejected cloud message: invalid envelope or unknown type');
      return;
    }
    const message = envelope.data as CloudMessage;

    if (!this.replayGuard.accept(message.id, message.timestamp)) {
      this.logger.warn('Rejected cloud message: replay or clock skew detected', { id: message.id });
      return;
    }

    this.events.emitEvent(CloudEventType.MessageReceived, {
      timestamp: new Date().toISOString(),
      metadata: { type: message.type, id: message.id },
    });

    if (message.type === MessageType.Ping) {
      this.send(createMessage(MessageType.Pong, {}));
      return;
    }
    if (message.type === MessageType.Ack) {
      this.resolveLatency(message);
      return;
    }

    for (const handler of this.handlers) {
      handler(message);
    }
  }

  private resolveLatency(message: CloudMessage): void {
    const ack = ackPayloadSchema.safeParse(message.payload);
    if (!ack.success) {
      return;
    }
    const sentAt = this.pendingAcks.get(ack.data.messageId);
    if (sentAt === undefined) {
      return;
    }
    this.pendingAcks.delete(ack.data.messageId);
    this.diagnostics.recordLatency(Date.now() - sentAt);
  }
}
