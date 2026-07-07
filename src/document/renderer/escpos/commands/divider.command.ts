import type { ResolvedStyle } from '../../../interfaces/index.js';
import { FontFamily } from '../../../interfaces/index.js';
import type { DividerElement } from '../../../elements/index.js';
import type { EscPosRenderContext } from '../utils/render-context.js';
import { applyStyleCommands, writeTextLine } from './text.command.js';

/**
 * A divider is `character` repeated `length` times, clamped to whatever the active paper
 * profile can actually fit — this is the "automatic paper width" adaptation: the same
 * document renders a full-width rule on 58mm, 72mm, or 80mm paper without the caller
 * needing to know which one it'll print on.
 */
export function renderDividerElement(element: DividerElement, style: ResolvedStyle, context: EscPosRenderContext): void {
  applyStyleCommands(context, style);

  const font = style.font === FontFamily.B ? FontFamily.B : FontFamily.A;
  const availableColumns = context.fontManager.columnsFor(font, style.characterSize) - style.margins.left - style.margins.right;
  const length = Math.min(element.length, Math.max(1, availableColumns));

  writeTextLine(context, element.character.repeat(length));
}
