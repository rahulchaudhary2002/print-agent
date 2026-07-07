import { DocumentValidationError } from '../../../interfaces/index.js';
import type { DecodedImage } from './image-types.js';

/**
 * Hand-rolled decoder for the common case: uncompressed 24-bit or 32-bit BMP (BITMAPINFOHEADER).
 * BMP is simple enough as an uncompressed format that a dependency isn't worth it — this
 * intentionally doesn't handle RLE compression, paletted BMPs, or the older/newer DIB header
 * variants, and says so clearly rather than silently producing garbage.
 */
export function decodeBmp(buffer: Buffer): DecodedImage {
  if (buffer.length < 54 || buffer.toString('ascii', 0, 2) !== 'BM') {
    throw new DocumentValidationError('Not a valid BMP file (missing "BM" signature)');
  }

  const pixelDataOffset = buffer.readUInt32LE(10);
  const dibHeaderSize = buffer.readUInt32LE(14);
  if (dibHeaderSize < 40) {
    throw new DocumentValidationError(`Unsupported BMP DIB header size: ${dibHeaderSize} (expected BITMAPINFOHEADER, >=40)`);
  }

  const width = buffer.readInt32LE(18);
  const rawHeight = buffer.readInt32LE(22);
  const bitsPerPixel = buffer.readUInt16LE(28);
  const compression = buffer.readUInt32LE(30);

  if (compression !== 0) {
    throw new DocumentValidationError(`Unsupported BMP compression method: ${compression} (only uncompressed BI_RGB is supported)`);
  }
  if (bitsPerPixel !== 24 && bitsPerPixel !== 32) {
    throw new DocumentValidationError(`Unsupported BMP bit depth: ${bitsPerPixel} (only 24-bit and 32-bit are supported)`);
  }

  const height = Math.abs(rawHeight);
  const topDown = rawHeight < 0;
  const bytesPerPixel = bitsPerPixel / 8;
  const rowSize = Math.ceil((width * bitsPerPixel) / 32) * 4; // BMP rows are padded to 4-byte boundaries

  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceRow = topDown ? y : height - 1 - y;
    const rowStart = pixelDataOffset + sourceRow * rowSize;
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = rowStart + x * bytesPerPixel;
      const destIndex = (y * width + x) * 4;
      const blue = buffer[sourceIndex] ?? 0;
      const green = buffer[sourceIndex + 1] ?? 0;
      const red = buffer[sourceIndex + 2] ?? 0;
      const alpha = bytesPerPixel === 4 ? (buffer[sourceIndex + 3] ?? 255) : 255;
      data[destIndex] = red;
      data[destIndex + 1] = green;
      data[destIndex + 2] = blue;
      data[destIndex + 3] = alpha;
    }
  }

  return { width, height, data };
}
