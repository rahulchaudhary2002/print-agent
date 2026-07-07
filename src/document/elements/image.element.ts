import { existsSync } from 'node:fs';
import type { BaseElement } from '../interfaces/base-element.interface.js';
import { ElementType } from '../interfaces/element-type.enum.js';
import type { ElementStyle } from '../interfaces/style.types.js';
import { DocumentValidationError } from '../interfaces/document-error.js';

export enum ImageFormat {
  Png = 'png',
  Jpeg = 'jpeg',
  Bmp = 'bmp',
}

export type ImageSource =
  | { kind: 'path'; path: string }
  | { kind: 'buffer'; buffer: Buffer }
  | { kind: 'url'; url: string }; // future support — not validated or fetched yet

export interface ImageElement extends BaseElement {
  type: ElementType.Image;
  source: ImageSource;
  format?: ImageFormat | undefined;
  width?: number | undefined;
  height?: number | undefined;
}

export interface ImageElementOptions {
  format?: ImageFormat | undefined;
  width?: number | undefined;
  height?: number | undefined;
  style?: ElementStyle | undefined;
}

/** Checks only that the source plausibly exists — pixel data is never read or decoded here. */
function assertSourceExists(source: ImageSource): void {
  if (source.kind === 'path' && !existsSync(source.path)) {
    throw new DocumentValidationError(`Image file does not exist: ${source.path}`);
  }
  if (source.kind === 'buffer' && source.buffer.length === 0) {
    throw new DocumentValidationError('Image buffer must not be empty');
  }
  // 'url' sources can't be validated synchronously — deferred to a future renderer.
}

export function createImageElement(source: ImageSource, options: ImageElementOptions = {}): ImageElement {
  assertSourceExists(source);
  return {
    type: ElementType.Image,
    source,
    format: options.format,
    width: options.width,
    height: options.height,
    style: options.style,
  };
}
