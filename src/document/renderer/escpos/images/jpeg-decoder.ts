import { decode } from 'jpeg-js';
import type { DecodedImage } from './image-types.js';

export function decodeJpeg(buffer: Buffer): DecodedImage {
  const decoded = decode(buffer, { useTArray: false, formatAsRGBA: true });
  return { width: decoded.width, height: decoded.height, data: decoded.data };
}
