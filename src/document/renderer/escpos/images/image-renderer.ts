import { readFile } from 'node:fs/promises';
import { ImageFormat, type ImageElement, type ImageSource } from '../../../elements/index.js';
import { DocumentValidationError, type ResolvedStyle } from '../../../interfaces/index.js';
import { alignmentCommand } from '../constants/index.js';
import type { EscPosRenderContext } from '../utils/render-context.js';
import { resolveAlignmentCode } from '../commands/style-mapping.util.js';
import { decodeBmp } from './bmp-decoder.js';
import type { DecodedImage } from './image-types.js';
import { decodeJpeg } from './jpeg-decoder.js';
import { resizeNearestNeighbor, toMonochromeBitmap } from './monochrome.util.js';
import { decodePng } from './png-decoder.js';
import { buildRasterCommand } from './raster.command.js';

function detectFormat(buffer: Buffer, path: string | undefined): ImageFormat {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return ImageFormat.Png;
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return ImageFormat.Jpeg;
  }
  if (buffer.length >= 2 && buffer.toString('ascii', 0, 2) === 'BM') {
    return ImageFormat.Bmp;
  }
  const extension = path?.split('.').pop()?.toLowerCase();
  if (extension === 'png') return ImageFormat.Png;
  if (extension === 'jpg' || extension === 'jpeg') return ImageFormat.Jpeg;
  if (extension === 'bmp') return ImageFormat.Bmp;
  throw new DocumentValidationError('Could not detect image format from its content or file extension');
}

function decodeByFormat(buffer: Buffer, format: ImageFormat): DecodedImage {
  switch (format) {
    case ImageFormat.Png:
      return decodePng(buffer);
    case ImageFormat.Jpeg:
      return decodeJpeg(buffer);
    case ImageFormat.Bmp:
      return decodeBmp(buffer);
  }
}

async function loadImageBuffer(source: ImageSource): Promise<Buffer> {
  if (source.kind === 'buffer') {
    return source.buffer;
  }
  if (source.kind === 'path') {
    return readFile(source.path);
  }
  // 'url' — explicitly future work per the document model (see ImageSource in elements/image.element.ts).
  throw new DocumentValidationError('Image URL sources are not supported yet');
}

export async function renderImageElement(element: ImageElement, style: ResolvedStyle, context: EscPosRenderContext): Promise<void> {
  const buffer = await loadImageBuffer(element.source);
  const format = element.format ?? detectFormat(buffer, element.source.kind === 'path' ? element.source.path : undefined);
  const decoded = decodeByFormat(buffer, format);

  const maxWidth = context.fontManager.dotsPerLine;
  const requestedWidth = element.width ?? decoded.width;
  const targetWidth = Math.min(requestedWidth, maxWidth);
  if (requestedWidth > maxWidth) {
    context.warn(`Image width ${requestedWidth}px exceeds the paper's ${maxWidth}px print area — scaled down to fit`);
  }
  const scale = targetWidth / decoded.width;
  const targetHeight = element.height ?? Math.max(1, Math.round(decoded.height * scale));

  const resized = resizeNearestNeighbor(decoded, targetWidth, targetHeight);
  const bitmap = toMonochromeBitmap(resized, context.options.imageThreshold, context.options.imageDithering);

  context.writer.write(alignmentCommand(resolveAlignmentCode(style.align)));
  context.writer.write(buildRasterCommand(bitmap));
}
