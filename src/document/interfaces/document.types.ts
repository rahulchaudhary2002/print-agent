import type { DocumentElement } from './document-element.union.js';
import type { ElementStyle } from './style.types.js';

/** A group of elements sharing a style layer — e.g. a receipt's header vs. its line-item body. */
export interface Section {
  elements: DocumentElement[];
  style?: ElementStyle | undefined;
}

/**
 * The root, printer-independent model. A DocumentBuilder produces one; a renderer (not yet
 * implemented) is the only thing that should ever turn it into printer-specific bytes.
 */
export interface PrintDocument {
  sections: Section[];
  style?: ElementStyle | undefined;
  metadata?: Record<string, unknown> | undefined;
}
