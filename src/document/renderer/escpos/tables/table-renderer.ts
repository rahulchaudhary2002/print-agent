import { FontFamily, type ResolvedStyle } from '../../../interfaces/index.js';
import type { TableElement } from '../../../elements/index.js';
import { resolveStyle } from '../../../styles/index.js';
import { applyStyleCommands, writeTextLine } from '../commands/text.command.js';
import type { EscPosRenderContext } from '../utils/render-context.js';
import { layoutColumns, layoutRow } from './table-layout.js';

export function renderTableElement(element: TableElement, style: ResolvedStyle, context: EscPosRenderContext): void {
  const font = style.font === FontFamily.B ? FontFamily.B : FontFamily.A;
  const availableColumns = context.fontManager.columnsFor(font, style.characterSize) - style.margins.left - style.margins.right;
  const laidOutColumns = layoutColumns(element.columns, availableColumns);

  applyStyleCommands(context, style);
  if (element.columns.some((column) => column.header !== undefined)) {
    const headerCells = element.columns.map((column) => column.header ?? '');
    for (const line of layoutRow(headerCells, laidOutColumns)) {
      writeTextLine(context, line);
    }
  }

  for (const row of element.rows) {
    const rowStyle = resolveStyle(style, row.style);
    applyStyleCommands(context, rowStyle);
    for (const line of layoutRow(row.cells, laidOutColumns)) {
      writeTextLine(context, line);
    }
  }
}
