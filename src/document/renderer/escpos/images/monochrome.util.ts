import type { DecodedImage } from './image-types.js';

export interface MonochromeBitmap {
  width: number;
  height: number;
  widthBytes: number;
  /** Packed 1 bit per pixel, row-major, MSB first. `1` = print a dot (black). */
  bits: Buffer;
}

export function resizeNearestNeighbor(image: DecodedImage, targetWidth: number, targetHeight: number): DecodedImage {
  if (targetWidth === image.width && targetHeight === image.height) {
    return image;
  }
  const data = Buffer.alloc(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor((y * image.height) / targetHeight));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor((x * image.width) / targetWidth));
      const sourceIndex = (sourceY * image.width + sourceX) * 4;
      const destIndex = (y * targetWidth + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        data[destIndex + channel] = image.data[sourceIndex + channel] ?? 0;
      }
    }
  }
  return { width: targetWidth, height: targetHeight, data };
}

/** Luminance per pixel, alpha-composited onto a white background (0 = black, 255 = white). */
function toGrayscale(image: DecodedImage): Float32Array {
  const gray = new Float32Array(image.width * image.height);
  for (let i = 0; i < gray.length; i += 1) {
    const offset = i * 4;
    const red = image.data[offset] ?? 0;
    const green = image.data[offset + 1] ?? 0;
    const blue = image.data[offset + 2] ?? 0;
    const alpha = (image.data[offset + 3] ?? 255) / 255;
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
    gray[i] = luminance * alpha + 255 * (1 - alpha);
  }
  return gray;
}

function setDot(bits: Buffer, widthBytes: number, x: number, y: number): void {
  const byteIndex = y * widthBytes + (x >> 3);
  const bitMask = 0x80 >> (x & 7);
  bits[byteIndex] = (bits[byteIndex] ?? 0) | bitMask;
}

/**
 * Converts to 1-bit-per-pixel. With dithering, Floyd-Steinberg error diffusion trades exact
 * per-pixel accuracy for much better perceived gradients on a 1-bit thermal head; without it,
 * every pixel is a hard threshold cut (faster, blockier on photos, fine for line art/logos).
 */
export function toMonochromeBitmap(image: DecodedImage, threshold: number, dithering: boolean): MonochromeBitmap {
  const { width, height } = image;
  const widthBytes = Math.ceil(width / 8);
  const bits = Buffer.alloc(widthBytes * height, 0);
  const gray = toGrayscale(image);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const oldValue = gray[index] ?? 255;
      const isBlack = oldValue < threshold;
      if (isBlack) {
        setDot(bits, widthBytes, x, y);
      }

      if (dithering) {
        const error = oldValue - (isBlack ? 0 : 255);
        if (x + 1 < width) {
          gray[index + 1] = (gray[index + 1] ?? 255) + (error * 7) / 16;
        }
        if (y + 1 < height) {
          if (x - 1 >= 0) {
            gray[index - 1 + width] = (gray[index - 1 + width] ?? 255) + (error * 3) / 16;
          }
          gray[index + width] = (gray[index + width] ?? 255) + (error * 5) / 16;
          if (x + 1 < width) {
            gray[index + 1 + width] = (gray[index + 1 + width] ?? 255) + (error * 1) / 16;
          }
        }
      }
    }
  }

  return { width, height, widthBytes, bits };
}
