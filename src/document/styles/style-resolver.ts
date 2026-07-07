import type { ElementStyle, ResolvedStyle } from '../interfaces/style.types.js';
import { DEFAULT_STYLE } from './default-style.js';

/**
 * Layers style overrides — document, then section, then element, then any further ad-hoc
 * layer — onto DEFAULT_STYLE. Later layers win per-field; `margins` merges per-side rather
 * than replacing wholesale, so a document-wide left margin survives an element that only sets top.
 */
export function resolveStyle(...layers: Array<ElementStyle | undefined>): ResolvedStyle {
  let resolved: ResolvedStyle = { ...DEFAULT_STYLE, margins: { ...DEFAULT_STYLE.margins } };

  for (const layer of layers) {
    if (!layer) {
      continue;
    }
    resolved = {
      align: layer.align ?? resolved.align,
      font: layer.font ?? resolved.font,
      bold: layer.bold ?? resolved.bold,
      underline: layer.underline ?? resolved.underline,
      inverse: layer.inverse ?? resolved.inverse,
      characterSize: layer.characterSize ?? resolved.characterSize,
      margins: {
        top: layer.margins?.top ?? resolved.margins.top,
        bottom: layer.margins?.bottom ?? resolved.margins.bottom,
        left: layer.margins?.left ?? resolved.margins.left,
        right: layer.margins?.right ?? resolved.margins.right,
      },
      lineHeight: layer.lineHeight ?? resolved.lineHeight,
      letterSpacing: layer.letterSpacing ?? resolved.letterSpacing,
    };
  }

  return resolved;
}
