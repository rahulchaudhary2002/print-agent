import { FontFamily, type ResolvedStyle } from '../../../interfaces/index.js';
import type { TextElement } from '../../../elements/index.js';
import {
  alignmentCommand,
  boldCommand,
  characterSizeCommand,
  CR,
  DEFAULT_LINE_SPACING,
  fontCommand,
  inverseCommand,
  lineSpacingCommand,
  LF,
  underlineCommand,
} from '../constants/index.js';
import { encodeText } from '../encoders/text-encoder.js';
import { FontManager } from '../fonts/font-manager.js';
import { wrapText } from '../utils/text-metrics.util.js';
import type { EscPosRenderContext } from '../utils/render-context.js';
import { resolveAlignmentCode } from './style-mapping.util.js';

/** Emits the style-setting commands (align/font/bold/underline/inverse/size/line spacing) for `style`. */
export function applyStyleCommands(context: EscPosRenderContext, style: ResolvedStyle): void {
  const { writer, options } = context;
  writer.write(alignmentCommand(resolveAlignmentCode(style.align)));
  writer.write(fontCommand(style.font === FontFamily.B ? 1 : 0));
  writer.write(boldCommand(style.bold));
  writer.write(underlineCommand(style.underline ? 1 : 0));
  writer.write(inverseCommand(style.inverse));
  writer.write(characterSizeCommand(FontManager.widthMagnification(style.characterSize), FontManager.heightMagnification(style.characterSize)));

  if (style.lineHeight !== 1) {
    writer.write(lineSpacingCommand(Math.round(options.lineSpacingDots * style.lineHeight)));
  } else {
    writer.write(DEFAULT_LINE_SPACING);
  }
}

/** Encodes one line of already-wrapped text and writes it with a trailing CR LF. */
export function writeTextLine(context: EscPosRenderContext, line: string): void {
  const { bytes, unmappedCount } = encodeText(line, context.fontManager.activeCodePage);
  if (unmappedCount > 0) {
    context.warn(`${unmappedCount} character(s) in "${line}" have no mapping in the active code page and were replaced with '?'`);
  }
  context.writer.write(bytes);
  context.writer.write([CR, LF]);
}

export function renderTextElement(element: TextElement, style: ResolvedStyle, context: EscPosRenderContext): void {
  applyStyleCommands(context, style);

  const font = style.font === FontFamily.B ? FontFamily.B : FontFamily.A;
  const totalColumns = context.fontManager.columnsFor(font, style.characterSize);
  const leftMargin = style.margins.left;
  const rightMargin = style.margins.right;
  const usableColumns = Math.max(1, totalColumns - leftMargin - rightMargin);
  const indent = ' '.repeat(leftMargin);

  for (let i = 0; i < style.margins.top; i += 1) {
    context.writer.write([LF]);
  }

  // `element.width`, when set, constrains the block to fewer columns than the paper allows.
  const wrapColumns = element.width !== undefined ? Math.min(element.width, usableColumns) : usableColumns;
  const lines = wrapText(element.content, wrapColumns, style.characterSize);
  for (const line of lines) {
    writeTextLine(context, leftMargin > 0 ? `${indent}${line}` : line);
  }

  for (let i = 0; i < style.margins.bottom; i += 1) {
    context.writer.write([LF]);
  }
}
