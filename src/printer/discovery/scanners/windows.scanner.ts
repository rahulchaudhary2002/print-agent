import { createRequire } from 'node:module';
import type { DiscoveredPrinterCandidate } from '../types/index.js';

interface PdfToPrinterModule {
  getPrinters(): Promise<{ deviceId: string; name: string; paperSizes: string[] }[]>;
  getDefaultPrinter(): Promise<{ deviceId: string; name: string; paperSizes: string[] } | undefined>;
}

/** Same CJS-interop workaround as `drivers/windows/pdf-to-printer.util.ts` — read-only here, no duplication of print logic. */
const pdfToPrinter = createRequire(import.meta.url)('pdf-to-printer') as PdfToPrinterModule;

/**
 * Normalized Windows printer discovery (Step 5) — installed printers via the OS spooler,
 * which one is the default, and each printer's supported paper sizes. `[]` on non-Windows.
 */
export async function scanWindowsCandidates(): Promise<DiscoveredPrinterCandidate[]> {
  if (process.platform !== 'win32') {
    return [];
  }
  const [printers, defaultPrinter] = await Promise.all([pdfToPrinter.getPrinters(), pdfToPrinter.getDefaultPrinter().catch(() => undefined)]);
  const now = new Date().toISOString();

  return printers.map((printer) => ({
    fingerprint: `windows:${printer.name}`,
    name: printer.name,
    driver: 'windows',
    transport: 'windows' as const,
    connection: { printerName: printer.name },
    isDefault: defaultPrinter?.name === printer.name,
    paperSizes: printer.paperSizes,
    status: 'installed',
    discoveredAt: now,
  }));
}
