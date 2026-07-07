import type { PrinterStatusValue } from './interfaces/printer-status.enum.js';

export type PrinterStatus = `${PrinterStatusValue}`;

/**
 * Driver-specific connection details (e.g. { ip, port } for network printers,
 * { vendorId, productId } for USB). Kept open-ended so new drivers don't require schema changes.
 */
export type PrinterConnection = Record<string, unknown>;

export interface Printer {
  id: string;
  name: string;
  driver: string;
  connectionType: string;
  connection: PrinterConnection;
  status: PrinterStatus;
  isDefault: boolean;
  /** Disabled printers are never selected by the print pipeline, even if a job explicitly names them. */
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePrinterInput {
  name: string;
  driver: string;
  connectionType: string;
  connection: PrinterConnection;
  isDefault?: boolean | undefined;
  enabled?: boolean | undefined;
}

export interface UpdatePrinterInput {
  name?: string | undefined;
  driver?: string | undefined;
  connectionType?: string | undefined;
  connection?: PrinterConnection | undefined;
  status?: PrinterStatus | undefined;
  isDefault?: boolean | undefined;
  enabled?: boolean | undefined;
}
