import { TextAlignment } from '../../../interfaces/index.js';
import type { TableColumn } from '../../../elements/index.js';
import { truncateText, wrapText } from '../utils/text-metrics.util.js';

export interface LaidOutColumn {
  column: TableColumn;
  /** Column's actual content width after automatic scale-to-fit — may be less than `column.width`. */
  width: number;
}

/**
 * Scales every column down proportionally when the table's requested width exceeds what the
 * active paper/font combination can fit — "automatic column sizing" adapting to paper width.
 * Never scales up: a table narrower than the paper just leaves the remainder blank.
 */
export function layoutColumns(columns: TableColumn[], availableColumns: number): LaidOutColumn[] {
  const requestedTotal = columns.reduce((sum, column) => sum + column.width + (column.padding ?? 0), 0);
  if (requestedTotal <= availableColumns || requestedTotal === 0) {
    return columns.map((column) => ({ column, width: column.width }));
  }

  const scale = availableColumns / requestedTotal;
  const scaled = columns.map((column) => Math.max(1, Math.floor(column.width * scale)));
  return columns.map((column, index) => ({ column, width: scaled[index] ?? 1 }));
}

function padCell(text: string, width: number, align: TextAlignment): string {
  const clipped = text.length > width ? text.slice(0, width) : text;
  const gap = width - clipped.length;
  if (gap <= 0) {
    return clipped;
  }
  if (align === TextAlignment.Right) {
    return ' '.repeat(gap) + clipped;
  }
  if (align === TextAlignment.Center) {
    const left = Math.floor(gap / 2);
    return ' '.repeat(left) + clipped + ' '.repeat(gap - left);
  }
  return clipped + ' '.repeat(gap);
}

/** Wraps or truncates one cell's text to its laid-out width, per the column's own flags. */
function renderCellLines(text: string, laidOut: LaidOutColumn): string[] {
  if (laidOut.column.truncate) {
    return [truncateText(text, laidOut.width)];
  }
  if (laidOut.column.wrap === false) {
    return [text.slice(0, laidOut.width)];
  }
  return wrapText(text, laidOut.width);
}

/**
 * Expands one row into the physical text lines it prints — borderless, whitespace-separated
 * columns, one output line per wrapped line, columns that finish early left blank on later lines.
 */
export function layoutRow(cells: string[], laidOutColumns: LaidOutColumn[]): string[] {
  const perColumnLines = laidOutColumns.map((laidOut, index) => renderCellLines(cells[index] ?? '', laidOut));
  const lineCount = Math.max(1, ...perColumnLines.map((lines) => lines.length));

  const outputLines: string[] = [];
  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const segments = laidOutColumns.map((laidOut, columnIndex) => {
      const cellLines = perColumnLines[columnIndex] ?? [];
      const text = cellLines[lineIndex] ?? '';
      const padded = padCell(text, laidOut.width, laidOut.column.align ?? TextAlignment.Left);
      return padded + ' '.repeat(laidOut.column.padding ?? 0);
    });
    outputLines.push(segments.join('').trimEnd());
  }
  return outputLines;
}
