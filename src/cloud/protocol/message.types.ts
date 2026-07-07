import type { MessageType } from './message-type.enum.js';

/** Every message, in either direction, has this shape — Step 8. */
export interface CloudMessage<TPayload = unknown> {
  id: string;
  timestamp: string;
  type: MessageType;
  payload: TPayload;
}
