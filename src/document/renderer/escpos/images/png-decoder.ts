import { PNG } from 'pngjs';
import type { DecodedImage } from './image-types.js';

/** pngjs always normalizes output to RGBA regardless of the source PNG's color type/bit depth. */
export function decodePng(buffer: Buffer): DecodedImage {
  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height, data: png.data };
}
