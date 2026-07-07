import { FontFamily } from '../../../interfaces/index.js';
import { CodePage } from '../encoders/code-pages.js';
import type { PaperWidthPreset } from './paper-profile.js';

export interface EscPosRendererOptions {
  paperWidth?: PaperWidthPreset | number | undefined;
  codePage?: CodePage | undefined;
  autoCut?: boolean | undefined;
  autoFeedLines?: number | undefined;
  defaultFont?: FontFamily | undefined;
  qrDefaultSize?: number | undefined;
  /** 0-255 luminance threshold for monochrome image conversion. */
  imageThreshold?: number | undefined;
  imageDithering?: boolean | undefined;
  /** Line spacing in dots (1/180"); omit to use the printer's built-in default spacing. */
  lineSpacingDots?: number | undefined;
}

export type ResolvedEscPosRendererOptions = {
  [K in keyof EscPosRendererOptions]-?: NonNullable<EscPosRendererOptions[K]>;
};

export const DEFAULT_RENDERER_OPTIONS: ResolvedEscPosRendererOptions = {
  paperWidth: '80mm',
  codePage: CodePage.Cp437,
  autoCut: true,
  autoFeedLines: 3,
  defaultFont: FontFamily.A,
  qrDefaultSize: 4,
  imageThreshold: 128,
  imageDithering: true,
  lineSpacingDots: 30,
};

export function resolveRendererOptions(options: EscPosRendererOptions = {}): ResolvedEscPosRendererOptions {
  return {
    paperWidth: options.paperWidth ?? DEFAULT_RENDERER_OPTIONS.paperWidth,
    codePage: options.codePage ?? DEFAULT_RENDERER_OPTIONS.codePage,
    autoCut: options.autoCut ?? DEFAULT_RENDERER_OPTIONS.autoCut,
    autoFeedLines: options.autoFeedLines ?? DEFAULT_RENDERER_OPTIONS.autoFeedLines,
    defaultFont: options.defaultFont ?? DEFAULT_RENDERER_OPTIONS.defaultFont,
    qrDefaultSize: options.qrDefaultSize ?? DEFAULT_RENDERER_OPTIONS.qrDefaultSize,
    imageThreshold: options.imageThreshold ?? DEFAULT_RENDERER_OPTIONS.imageThreshold,
    imageDithering: options.imageDithering ?? DEFAULT_RENDERER_OPTIONS.imageDithering,
    lineSpacingDots: options.lineSpacingDots ?? DEFAULT_RENDERER_OPTIONS.lineSpacingDots,
  };
}
