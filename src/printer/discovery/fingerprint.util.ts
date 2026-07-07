import { readNumber, readString } from '../../drivers/base/index.js';
import type { PrinterConnection } from '../printer.types.js';

/**
 * Computes the same dedup key a discovery scanner would produce, from an already-registered
 * printer's stored `connection` blob — lets `DiscoveryManager` tell "this candidate is already
 * registered" apart from "this is new hardware", without needing a separate mapping table.
 */
export function fingerprintFromConnection(driver: string, connection: PrinterConnection): string | null {
  switch (driver) {
    case 'escpos-usb': {
      const vendorId = readNumber(connection, 'vendorId');
      const productId = readNumber(connection, 'productId');
      if (vendorId === undefined || productId === undefined) return null;
      return `usb:${vendorId.toString(16).padStart(4, '0')}:${productId.toString(16).padStart(4, '0')}`;
    }
    case 'network':
    case 'raw': {
      const ip = readString(connection, 'ip');
      const port = readNumber(connection, 'port') ?? 9100;
      if (!ip) return null;
      return `network:${ip}:${port}`;
    }
    case 'windows': {
      const printerName = readString(connection, 'printerName');
      return printerName ? `windows:${printerName}` : null;
    }
    case 'cups': {
      const printerName = readString(connection, 'printerName');
      return printerName ? `cups:${printerName}` : null;
    }
    default:
      return null;
  }
}
