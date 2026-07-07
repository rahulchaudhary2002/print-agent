import { CodePage, mapCodePointToByte } from './code-pages.js';

const REPLACEMENT_BYTE = 0x3f; // '?'

/**
 * Converts a JS (UTF-16) string to the bytes a printer expects. `utf-8` is a passthrough —
 * correct only if the target printer has a UTF-8 mode; the single-byte code pages transliterate
 * per-character, substituting '?' for anything outside the table (logged by the caller, not here).
 */
export function encodeText(text: string, codePage: CodePage): { bytes: Buffer; unmappedCount: number } {
  if (codePage === CodePage.Utf8) {
    return { bytes: Buffer.from(text, 'utf-8'), unmappedCount: 0 };
  }

  let unmappedCount = 0;
  const bytes = Buffer.alloc(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const codePoint = text.codePointAt(i);
    const mapped = codePoint === undefined ? undefined : mapCodePointToByte(codePage, codePoint);
    if (mapped === undefined) {
      unmappedCount += 1;
    }
    bytes[i] = mapped ?? REPLACEMENT_BYTE;
  }
  return { bytes, unmappedCount };
}
