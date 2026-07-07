import type { DocumentElement, PrintDocument } from '../interfaces/index.js';

/**
 * The contract every renderer (ESC/POS, PDF, HTML, image, ...) must implement to turn a
 * printer-independent PrintDocument into renderer-specific output. Not implemented yet —
 * this phase only defines the seam. `TOutput` lets each renderer declare its own result type
 * (a Buffer of ESC/POS bytes, a PDF file path, an HTML string, ...) without weakening this
 * interface to `unknown` for everyone.
 */
export interface DocumentRenderer<TOutput = unknown> {
  initialize(): Promise<void>;
  render(document: PrintDocument): Promise<TOutput>;
  supports(element: DocumentElement): boolean;
  destroy(): Promise<void>;
}
