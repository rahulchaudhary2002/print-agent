import { rasterImageCommand } from '../constants/index.js';
import type { MonochromeBitmap } from './monochrome.util.js';

/** Wraps the packed bitmap in the GS v 0 raster command — no reprocessing, just byte assembly. */
export function buildRasterCommand(bitmap: MonochromeBitmap): number[] {
  return rasterImageCommand(bitmap.widthBytes, bitmap.height, bitmap.bits);
}
