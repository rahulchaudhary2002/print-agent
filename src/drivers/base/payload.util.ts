import type { PrintPayload } from '../../printer/interfaces/index.js';

/** Decodes a job payload to bytes: base64 for binary content, UTF-8 for everything else. */
export function decodePrintPayload(payload: PrintPayload): Buffer {
  return payload.type === 'base64' ? Buffer.from(payload.payload, 'base64') : Buffer.from(payload.payload, 'utf-8');
}
