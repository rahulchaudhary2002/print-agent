import { CharacterSize, FontFamily, TextAlignment, type ResolvedStyle } from '../interfaces/style.types.js';

/** The style every element ultimately falls back to when nothing overrides a given field. */
export const DEFAULT_STYLE: ResolvedStyle = {
  align: TextAlignment.Left,
  font: FontFamily.A,
  bold: false,
  underline: false,
  inverse: false,
  characterSize: CharacterSize.Normal,
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  lineHeight: 1,
  letterSpacing: 0,
};
