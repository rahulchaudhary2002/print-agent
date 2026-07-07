/**
 * Centralized raw ESC/POS byte sequences (Epson TM-family command reference). Every other
 * file under escpos/ builds on these — nothing else in the renderer hard-codes a byte value.
 * Command builders that take a parameter are plain functions returning `number[]`; anything
 * fixed is a `readonly number[]` constant.
 */

// Control characters
export const LF = 0x0a;
export const CR = 0x0d;

// Initialize
export const INITIALIZE: readonly number[] = [0x1b, 0x40]; // ESC @

// Alignment — ESC a n
export function alignmentCommand(n: 0 | 1 | 2): number[] {
  return [0x1b, 0x61, n];
}

// Bold — ESC E n
export function boldCommand(enabled: boolean): number[] {
  return [0x1b, 0x45, enabled ? 1 : 0];
}

// Underline — ESC - n (0 = off, 1 = 1-dot, 2 = 2-dot)
export function underlineCommand(weight: 0 | 1 | 2): number[] {
  return [0x1b, 0x2d, weight];
}

// Inverse (white-on-black) — GS B n
export function inverseCommand(enabled: boolean): number[] {
  return [0x1d, 0x42, enabled ? 1 : 0];
}

// Font select — ESC M n (0 = Font A, 1 = Font B)
export function fontCommand(font: 0 | 1): number[] {
  return [0x1b, 0x4d, font];
}

// Character size — GS ! n (high nibble = width magnification-1, low nibble = height magnification-1)
export function characterSizeCommand(widthMagnification: number, heightMagnification: number): number[] {
  const n = ((widthMagnification - 1) << 4) | (heightMagnification - 1);
  return [0x1d, 0x21, n & 0xff];
}

// Line spacing — ESC 3 n (n/180 inch); ESC 2 resets to the printer's default spacing.
export function lineSpacingCommand(dots: number): number[] {
  return [0x1b, 0x33, dots & 0xff];
}
export const DEFAULT_LINE_SPACING: readonly number[] = [0x1b, 0x32]; // ESC 2

// Print and feed n lines — ESC d n
export function printAndFeedCommand(lines: number): number[] {
  return [0x1b, 0x64, lines & 0xff];
}

// Paper cut — GS V m (0 = full cut, 1 = partial cut)
export const FULL_CUT: readonly number[] = [0x1d, 0x56, 0x00];
export const PARTIAL_CUT: readonly number[] = [0x1d, 0x56, 0x01];

// Cash drawer kick — ESC p m t1 t2 (m: 0 = pin 2, 1 = pin 5; t1/t2 in 2ms units)
export function cashDrawerCommand(pin: 0 | 1, onMs: number, offMs: number): number[] {
  const toUnits = (ms: number): number => Math.min(255, Math.max(0, Math.round(ms / 2)));
  return [0x1b, 0x70, pin, toUnits(onMs), toUnits(offMs)];
}

// Character code table — ESC t n
export function codePageCommand(tableIndex: number): number[] {
  return [0x1b, 0x74, tableIndex & 0xff];
}

// ---- QR code (Epson 2D symbol "GS ( k") ------------------------------------------------

function gsK(cn: number, fn: number, params: number[]): number[] {
  const payload = [cn, fn, ...params];
  const length = payload.length;
  return [0x1d, 0x28, 0x6b, length & 0xff, (length >> 8) & 0xff, ...payload];
}

export function qrSelectModelCommand(model: 1 | 2): number[] {
  return gsK(49, 65, [model === 1 ? 49 : 50, 0]);
}

export function qrSetSizeCommand(moduleSize: number): number[] {
  return gsK(49, 67, [moduleSize]);
}

export function qrSetErrorCorrectionCommand(level: 48 | 49 | 50 | 51): number[] {
  return gsK(49, 69, [level]);
}

export function qrStoreDataCommand(data: Buffer): number[] {
  const cn = 49;
  const fn = 80;
  const m = 48;
  const length = data.length + 3; // cn + fn + m + data
  return [0x1d, 0x28, 0x6b, length & 0xff, (length >> 8) & 0xff, cn, fn, m, ...data];
}

export const QR_PRINT_COMMAND: readonly number[] = gsK(49, 81, [48]);

// ---- Barcode (GS k m n d1...dn) ---------------------------------------------------------

export const BARCODE_TYPE_CODE = {
  UPC_A: 65,
  UPC_E: 66,
  EAN13: 67,
  EAN8: 68,
  CODE39: 69,
  ITF: 70,
  CODABAR: 71,
  CODE128: 73,
} as const;

export function barcodeHeightCommand(dots: number): number[] {
  return [0x1d, 0x68, dots & 0xff];
}

export function barcodeWidthCommand(dotsPerModule: number): number[] {
  return [0x1d, 0x77, dotsPerModule & 0xff];
}

/** HRI (human readable interpretation) text position — 0 none, 1 above, 2 below, 3 both. */
export function barcodeHriPositionCommand(position: 0 | 1 | 2 | 3): number[] {
  return [0x1d, 0x48, position];
}

export function barcodeCommand(typeCode: number, data: Buffer): number[] {
  return [0x1d, 0x6b, typeCode, data.length, ...data];
}

// ---- Raster image (GS v 0) ---------------------------------------------------------------

export function rasterImageCommand(widthBytes: number, heightPixels: number, bitmap: Buffer): number[] {
  return [
    0x1d,
    0x76,
    0x30,
    0x00,
    widthBytes & 0xff,
    (widthBytes >> 8) & 0xff,
    heightPixels & 0xff,
    (heightPixels >> 8) & 0xff,
    ...bitmap,
  ];
}
