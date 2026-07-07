export type PaperWidthPreset = '58mm' | '72mm' | '80mm';

export interface PaperProfile {
  widthMm: number;
  /** Total addressable print-head dots for this width — used to size raster images. */
  dotsPerLine: number;
  /** Character columns available at Font A (12 cpi) / Font B (15 cpi) normal size. */
  columnsFontA: number;
  columnsFontB: number;
}

/** Standard column counts for common Epson-compatible thermal printers at each width. */
const PAPER_PROFILES: Record<PaperWidthPreset, PaperProfile> = {
  '58mm': { widthMm: 58, dotsPerLine: 384, columnsFontA: 32, columnsFontB: 42 },
  '72mm': { widthMm: 72, dotsPerLine: 480, columnsFontA: 42, columnsFontB: 56 },
  '80mm': { widthMm: 80, dotsPerLine: 576, columnsFontA: 48, columnsFontB: 64 },
};

const REFERENCE_DOTS_PER_MM = PAPER_PROFILES['80mm'].dotsPerLine / PAPER_PROFILES['80mm'].widthMm;
const MM_PER_INCH = 25.4;

/** Derives a profile for a non-standard paper width from the 80mm printer's dot density. */
function createCustomPaperProfile(widthMm: number): PaperProfile {
  const dotsPerLine = Math.floor((widthMm * REFERENCE_DOTS_PER_MM) / 8) * 8; // byte-aligned for raster output
  const columnsFontA = Math.floor(widthMm / (MM_PER_INCH / 12));
  const columnsFontB = Math.floor(widthMm / (MM_PER_INCH / 15));
  return { widthMm, dotsPerLine, columnsFontA, columnsFontB };
}

export function resolvePaperProfile(width: PaperWidthPreset | number): PaperProfile {
  if (typeof width === 'number') {
    return createCustomPaperProfile(width);
  }
  return PAPER_PROFILES[width];
}
