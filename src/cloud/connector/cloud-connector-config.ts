export interface CloudConnectorConfig {
  serverUrl?: string | undefined;
  /** Dev/test only — allows `ws://`/`http://localhost`. Production must use TLS. */
  allowInsecure?: boolean | undefined;
  /** Used until the server's own registration response specifies one. */
  heartbeatIntervalMs?: number | undefined;
  maxIncomingCommandsPerMinute?: number | undefined;
}

export type ResolvedCloudConnectorConfig = {
  [K in keyof CloudConnectorConfig]-?: NonNullable<CloudConnectorConfig[K]>;
};

export const DEFAULT_CLOUD_CONNECTOR_CONFIG: ResolvedCloudConnectorConfig = {
  serverUrl: '',
  allowInsecure: false,
  heartbeatIntervalMs: 30_000,
  maxIncomingCommandsPerMinute: 120,
};

export function resolveCloudConnectorConfig(config: CloudConnectorConfig = {}): ResolvedCloudConnectorConfig {
  return {
    serverUrl: config.serverUrl ?? DEFAULT_CLOUD_CONNECTOR_CONFIG.serverUrl,
    allowInsecure: config.allowInsecure ?? DEFAULT_CLOUD_CONNECTOR_CONFIG.allowInsecure,
    heartbeatIntervalMs: config.heartbeatIntervalMs ?? DEFAULT_CLOUD_CONNECTOR_CONFIG.heartbeatIntervalMs,
    maxIncomingCommandsPerMinute: config.maxIncomingCommandsPerMinute ?? DEFAULT_CLOUD_CONNECTOR_CONFIG.maxIncomingCommandsPerMinute,
  };
}
