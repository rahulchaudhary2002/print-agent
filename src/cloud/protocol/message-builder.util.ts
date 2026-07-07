import { randomUUID } from 'node:crypto';
import type { MessageType } from './message-type.enum.js';
import type { CloudMessage } from './message.types.js';

export function createMessage<TPayload>(type: MessageType, payload: TPayload): CloudMessage<TPayload> {
  return { id: randomUUID(), timestamp: new Date().toISOString(), type, payload };
}
