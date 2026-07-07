import { createRequire } from 'node:module';

export interface WindowsPrinterInfo {
  deviceId: string;
  name: string;
  paperSizes: string[];
}

export interface WindowsPrintOptions {
  printer?: string;
}

interface PdfToPrinterModule {
  getPrinters(): Promise<WindowsPrinterInfo[]>;
  print(pdf: string, options?: WindowsPrintOptions): Promise<void>;
}

/**
 * `pdf-to-printer`'s shipped .d.ts declares named ESM exports, but its actual runtime bundle
 * is CJS-only — Node's static ESM/CJS interop can't detect named bindings from the bundle, so
 * `import { getPrinters } from 'pdf-to-printer'` fails at runtime despite type-checking cleanly.
 * `createRequire` sidesteps that by loading the real `module.exports` object directly.
 */
const pdfToPrinter = createRequire(import.meta.url)('pdf-to-printer') as PdfToPrinterModule;

export const getWindowsPrinters = pdfToPrinter.getPrinters;
export const printPdfOnWindows = pdfToPrinter.print;
