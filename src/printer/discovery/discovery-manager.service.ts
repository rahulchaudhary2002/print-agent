import type { PrinterRepository } from '../../database/repositories/index.js';
import type { LoggerService } from '../../services/index.js';
import type { PrinterCacheService } from '../cache/index.js';
import { PrinterEventBus, PrinterEventType } from '../events/index.js';
import { fingerprintFromConnection } from './fingerprint.util.js';
import { scanBluetoothCandidates, scanCupsCandidates, scanNetworkCandidates, scanUsbCandidates, scanWindowsCandidates } from './scanners/index.js';
import type { NetworkDiscoveryOptions } from './scanners/network.scanner.js';
import type { DiscoveredPrinterCandidate, DiscoveryDiff, DiscoveryResultEntry } from './types/index.js';

export interface DiscoveryRunOptions {
  network?: NetworkDiscoveryOptions | undefined;
}

/** Merges candidates that report the same fingerprint (e.g. found by more than one scanner). */
function mergeDuplicates(candidates: DiscoveredPrinterCandidate[]): DiscoveredPrinterCandidate[] {
  const byFingerprint = new Map<string, DiscoveredPrinterCandidate>();
  for (const candidate of candidates) {
    const existing = byFingerprint.get(candidate.fingerprint);
    byFingerprint.set(candidate.fingerprint, existing ? { ...candidate, ...existing } : candidate);
  }
  return [...byFingerprint.values()];
}

/**
 * Discovery Engine (Step 2) — fans out to every transport scanner, merges duplicate results,
 * diffs against the previous scan to detect newly connected/removed printers, and updates the
 * shared printer cache. Runs independently of printing: it never touches `PrinterManager` or
 * the print queue, only `PrinterRepository` (read-only, to flag already-registered candidates).
 */
export class DiscoveryManager {
  constructor(
    private readonly logger: LoggerService,
    private readonly printerRepository: PrinterRepository,
    private readonly cache: PrinterCacheService,
    private readonly eventBus: PrinterEventBus,
  ) {}

  /** Raw sweep — no cache read/write, no diffing. Used internally by `runScan` and exposed for callers that want a one-off scan. */
  async discoverAll(options: DiscoveryRunOptions = {}): Promise<DiscoveredPrinterCandidate[]> {
    const results = await Promise.all([
      scanUsbCandidates(),
      scanNetworkCandidates(options.network),
      scanWindowsCandidates(),
      scanCupsCandidates(),
      scanBluetoothCandidates(),
    ]);
    const merged = mergeDuplicates(results.flat());
    this.logger.info('Printer discovery scan completed', { candidates: merged.length });
    return merged;
  }

  /** Cached results only — never touches hardware (Step 17: never block print jobs / avoid continuous scanning). */
  getCached(): DiscoveryResultEntry[] {
    return this.cache.getDiscovery() ?? [];
  }

  /** Full scan + merge-with-registered-printers + diff-against-previous-cache + cache update + events. */
  async runScan(options: DiscoveryRunOptions = {}): Promise<DiscoveryDiff> {
    const candidates = await this.discoverAll(options);
    const registeredFingerprints = new Map<string, string>();
    for (const printer of this.printerRepository.findAll()) {
      const fingerprint = fingerprintFromConnection(printer.driver, printer.connection);
      if (fingerprint) {
        registeredFingerprints.set(fingerprint, printer.id);
      }
    }

    const now = new Date().toISOString();
    const previous = new Map(this.cache.getDiscovery()?.map((entry) => [entry.fingerprint, entry]) ?? []);
    const currentByFingerprint = new Map<string, DiscoveryResultEntry>();

    for (const candidate of candidates) {
      const existingEntry = previous.get(candidate.fingerprint);
      currentByFingerprint.set(candidate.fingerprint, {
        ...candidate,
        discoveredAt: existingEntry?.discoveredAt ?? candidate.discoveredAt,
        lastSeenAt: now,
        alreadyRegistered: registeredFingerprints.has(candidate.fingerprint),
        existingPrinterId: registeredFingerprints.get(candidate.fingerprint),
      });
    }

    const added: DiscoveryResultEntry[] = [];
    const unchanged: DiscoveryResultEntry[] = [];
    for (const entry of currentByFingerprint.values()) {
      if (previous.has(entry.fingerprint)) {
        unchanged.push(entry);
      } else {
        added.push(entry);
      }
    }
    const removed = [...previous.values()].filter((entry) => !currentByFingerprint.has(entry.fingerprint));

    const all = [...currentByFingerprint.values()];
    this.cache.setDiscovery(all);

    for (const entry of added) {
      this.eventBus.emitEvent(PrinterEventType.PrinterDiscovered, {
        timestamp: now,
        metadata: { fingerprint: entry.fingerprint, name: entry.name, transport: entry.transport },
      });
    }
    for (const entry of removed) {
      this.eventBus.emitEvent(PrinterEventType.PrinterRemoved, {
        timestamp: now,
        printerId: entry.existingPrinterId,
        metadata: { fingerprint: entry.fingerprint, name: entry.name, transport: entry.transport },
      });
    }

    this.logger.info('Printer discovery diff computed', { added: added.length, removed: removed.length, unchanged: unchanged.length });
    return { added, removed, unchanged, all, scannedAt: now };
  }
}
