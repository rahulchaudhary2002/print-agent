import type { PrinterCapability } from '../../interfaces/printer-capability.enum.js';
import type { PrinterConnection } from '../../printer.types.js';

export type DiscoveryTransport = 'usb' | 'network' | 'windows' | 'cups' | 'bluetooth';

/**
 * A single scanner's normalized finding, richer than the legacy `DiscoveredPrinter`
 * (`{ name, connection, driver }`) — carries the structured `connection` object needed to
 * actually call `PrinterService.create()`, plus whatever transport-specific metadata Steps 3-6 ask for.
 */
export interface DiscoveredPrinterCandidate {
  /** Stable dedup key for this physical/logical printer, independent of any DB id. */
  fingerprint: string;
  name: string;
  driver: string;
  transport: DiscoveryTransport;
  connection: PrinterConnection;

  // USB (Step 3)
  vendorId?: number | undefined;
  productId?: number | undefined;
  manufacturer?: string | undefined;
  model?: string | undefined;
  serialNumber?: string | undefined;
  usbPath?: string | undefined;

  // Network (Step 4)
  ip?: string | undefined;
  port?: number | undefined;
  responseTimeMs?: number | undefined;

  // Windows (Step 5)
  isDefault?: boolean | undefined;
  paperSizes?: string[] | undefined;

  // CUPS (Step 6)
  uri?: string | undefined;
  queueInfo?: string | undefined;

  status?: string | undefined;
  capabilitiesHint?: PrinterCapability[] | undefined;
  discoveredAt: string;
}

/** A candidate merged with its cache/registration state, as returned by `GET /discovery`. */
export interface DiscoveryResultEntry extends DiscoveredPrinterCandidate {
  lastSeenAt: string;
  alreadyRegistered: boolean;
  existingPrinterId: string | undefined;
}

/** Diff produced each time `DiscoveryManager` runs a scan and merges it against the previous cache. */
export interface DiscoveryDiff {
  added: DiscoveryResultEntry[];
  removed: DiscoveryResultEntry[];
  unchanged: DiscoveryResultEntry[];
  all: DiscoveryResultEntry[];
  scannedAt: string;
}
