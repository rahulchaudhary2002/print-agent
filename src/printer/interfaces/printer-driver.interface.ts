import type { PrinterConnection } from '../printer.types.js';
import type { PrinterCapability } from './printer-capability.enum.js';
import type { PrinterStatusValue } from './printer-status.enum.js';

/** `type: 'base64'` carries raw binary (base64-encoded); anything else is treated as UTF-8 text. */
export interface PrintPayload {
  type: string;
  payload: string;
}

export interface DriverActionResult {
  success: boolean;
  message: string;
}

export interface DiscoveredPrinter {
  name: string;
  connection: string;
  driver: string;
}

export interface DriverMetrics {
  jobsPrinted: number;
  failures: number;
  reconnectCount: number;
  bytesSent: number;
  averageDurationMs: number;
  lastUsedAt: string | null;
}

export interface DriverHealth {
  status: PrinterStatusValue;
  healthScore: number;
  lastSuccessAt: string | null;
  lastError: string | null;
  connectionDurationMs: number | null;
}

/**
 * The contract every printer driver — built-in or third-party plugin — must implement.
 * PrinterManager and the rest of the app depend only on this interface, never on a concrete driver class.
 */
export interface PrinterDriver {
  readonly driverName: string;
  readonly capabilities: PrinterCapability[];

  initialize(connection: PrinterConnection): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  print(payload: PrintPayload): Promise<DriverActionResult>;
  getStatus(): Promise<PrinterStatusValue>;
  discover(): Promise<DiscoveredPrinter[]>;
  testPrint(): Promise<DriverActionResult>;
  supports(capability: PrinterCapability): boolean;
  getMetrics(): DriverMetrics;
  getHealth(): Promise<DriverHealth>;
}
