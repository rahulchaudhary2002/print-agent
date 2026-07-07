export type LoggingLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppConfig {
  port: number;
  autoStart: boolean;
  server: string;
  token: string;
  version: string;

  // Printing defaults (Local Management API — Step 5)
  defaultPrinterId: string | null;
  paperWidth: '58mm' | '72mm' | '80mm';
  autoCut: boolean;
  loggingLevel: LoggingLevel;
  queueSize: number;
  retryCount: number;
  renderTimeoutMs: number;
  printTimeoutMs: number;

  // Local API security (Step 14)
  allowRemote: boolean;
  requireApiKey: boolean;
  corsOrigins: string[];
  rateLimitMax: number;
  rateLimitWindowMs: number;

  // Service management (Service Management phase — Step 7 config reload)
  discoveryIntervalMs: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  port: 3210,
  autoStart: true,
  server: '',
  token: '',
  version: '1.0.0',

  defaultPrinterId: null,
  paperWidth: '80mm',
  autoCut: true,
  loggingLevel: 'info',
  queueSize: 500,
  retryCount: 3,
  renderTimeoutMs: 10_000,
  printTimeoutMs: 15_000,

  allowRemote: false,
  requireApiKey: false,
  corsOrigins: ['http://localhost', 'http://127.0.0.1'],
  rateLimitMax: 120,
  rateLimitWindowMs: 60_000,

  discoveryIntervalMs: 5 * 60_000,
};

/** Settings a client is actually allowed to change via PUT /config — everything else is read-only. */
export const MUTABLE_CONFIG_KEYS = [
  'defaultPrinterId',
  'paperWidth',
  'autoCut',
  'loggingLevel',
  'queueSize',
  'retryCount',
  'renderTimeoutMs',
  'printTimeoutMs',
  'allowRemote',
  'requireApiKey',
  'corsOrigins',
  'rateLimitMax',
  'rateLimitWindowMs',
  'discoveryIntervalMs',
] as const satisfies readonly (keyof AppConfig)[];

export type MutableConfigKey = (typeof MUTABLE_CONFIG_KEYS)[number];
export type MutableAppConfig = Pick<AppConfig, MutableConfigKey>;
