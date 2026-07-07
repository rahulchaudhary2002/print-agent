import type { PrinterCapability } from '../interfaces/printer-capability.enum.js';

export interface PrinterCapabilitySnapshot {
  printerId: string;
  paperWidth: string | number | null;
  autoCut: boolean;
  cashDrawer: boolean;
  qrCode: boolean;
  barcode: boolean;
  imagePrinting: boolean;
  colorSupport: boolean;
  /** Not implemented by any current driver — reserved for future hardware support. */
  duplex: boolean;
  rawCapabilities: PrinterCapability[];
  source: 'driver' | 'driver+profile';
}
