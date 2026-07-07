import type { LoggerService } from '../../services/index.js';
import { CloudEventType, type CloudEventBus } from '../events/index.js';
import type { CloudMessage } from '../protocol/index.js';
import type { WebSocketClient } from '../websocket/index.js';

const DEFAULT_MAX_BUFFER_SIZE = 1000;

/**
 * Step 11 — outgoing acknowledgements/events queue here instead of being lost when the cloud
 * link is down; a `ConnectionOpened` event (from the same CloudEventBus everything else uses,
 * per Step 16) triggers an automatic flush, oldest-first.
 */
export class OfflineSyncService {
  private readonly buffer: CloudMessage[] = [];

  constructor(
    private readonly webSocketClient: WebSocketClient,
    events: CloudEventBus,
    private readonly logger: LoggerService,
    private readonly maxBufferSize = DEFAULT_MAX_BUFFER_SIZE,
  ) {
    events.on(CloudEventType.ConnectionOpened, () => this.flush());
  }

  /** Sends immediately if connected; otherwise buffers for the next reconnect. */
  enqueue(message: CloudMessage): void {
    if (this.webSocketClient.isConnected && this.webSocketClient.send(message)) {
      return;
    }
    if (this.buffer.length >= this.maxBufferSize) {
      this.buffer.shift();
      this.logger.warn('Offline sync buffer full — dropped the oldest buffered message');
    }
    this.buffer.push(message);
  }

  flush(): void {
    if (this.buffer.length === 0) {
      return;
    }
    const pending = [...this.buffer];
    this.buffer.length = 0;
    this.logger.info('Flushing buffered cloud messages', { count: pending.length });

    for (let index = 0; index < pending.length; index += 1) {
      const message = pending[index];
      if (message && !this.webSocketClient.send(message)) {
        this.buffer.push(...pending.slice(index));
        this.logger.warn('Connection dropped mid-flush — remaining messages re-buffered', { remaining: this.buffer.length });
        return;
      }
    }
  }

  get bufferedCount(): number {
    return this.buffer.length;
  }
}
