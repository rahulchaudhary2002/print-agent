/** Step 14 — exchanged during connection; the server rejects gracefully if incompatible. */
export const PROTOCOL_VERSION = '1.0';

export const SUPPORTED_PROTOCOL_VERSIONS: readonly string[] = ['1.0'];

export function isProtocolVersionSupported(version: string): boolean {
  return SUPPORTED_PROTOCOL_VERSIONS.includes(version);
}
