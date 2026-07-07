import type { DiscoveredPrinter } from '../../printer/interfaces/index.js';
import { getWindowsPrinters } from './pdf-to-printer.util.js';

/** Lists installed Windows printers via the OS spooler. Returns `[]` on any non-Windows platform. */
export async function scanWindowsPrinters(): Promise<DiscoveredPrinter[]> {
  if (process.platform !== 'win32') {
    return [];
  }
  const printers = await getWindowsPrinters();
  return printers.map((printer) => ({ name: printer.name, connection: 'Windows', driver: 'windows' }));
}
