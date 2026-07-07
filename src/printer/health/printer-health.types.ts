export type PrinterHealthStatus = 'online' | 'offline' | 'busy' | 'unknown' | 'error';

/** Row shape persisted in `printer_health` — survives restarts. */
export interface PersistedPrinterHealth {
  printerId: string;
  status: PrinterHealthStatus;
  lastSeenAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  failureCount: number;
  recoveryCount: number;
  updatedAt: string;
}

/** Live view returned by the API — identical shape today, kept distinct so in-memory-only fields can be added later. */
export type PrinterHealthSnapshot = PersistedPrinterHealth;
