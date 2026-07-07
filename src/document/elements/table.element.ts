import type { BaseElement } from '../interfaces/base-element.interface.js';
import { ElementType } from '../interfaces/element-type.enum.js';
import { TextAlignment, type ElementStyle } from '../interfaces/style.types.js';
import { assertPositiveInteger } from '../interfaces/validation.util.js';
import { DocumentValidationError } from '../interfaces/document-error.js';

/** Maximum table width in characters — matches the widest common 80mm thermal head at 12cpi. */
export const MAX_TABLE_WIDTH = 64;

export interface TableColumn {
  header?: string | undefined;
  width: number;
  align?: TextAlignment | undefined;
  padding?: number | undefined;
  /** Wrap overflowing text onto additional lines. Mutually exclusive with `truncate` at render time. */
  wrap?: boolean | undefined;
  /** Cut overflowing text short (renderer decides truncation marker). */
  truncate?: boolean | undefined;
}

export interface TableRow {
  cells: string[];
  /** Row-level style override — layered under the table's own style. */
  style?: ElementStyle | undefined;
}

export interface TableElement extends BaseElement {
  type: ElementType.Table;
  columns: TableColumn[];
  rows: TableRow[];
}

export interface TableElementOptions {
  style?: ElementStyle | undefined;
}

function validateColumn(column: TableColumn, index: number): void {
  assertPositiveInteger(column.width, `Table column ${index} width`);
  if (column.padding !== undefined && column.padding < 0) {
    throw new DocumentValidationError(`Table column ${index} padding must not be negative`);
  }
}

function validateRow(row: TableRow, index: number, columnCount: number): void {
  if (row.cells.length !== columnCount) {
    throw new DocumentValidationError(
      `Table row ${index} has ${row.cells.length} cells but the table defines ${columnCount} columns`,
    );
  }
}

export function createTableElement(
  columns: TableColumn[],
  rows: TableRow[],
  options: TableElementOptions = {},
): TableElement {
  if (columns.length === 0) {
    throw new DocumentValidationError('Table must have at least one column');
  }
  columns.forEach(validateColumn);

  const totalWidth = columns.reduce((sum, column) => sum + column.width + (column.padding ?? 0), 0);
  if (totalWidth > MAX_TABLE_WIDTH) {
    throw new DocumentValidationError(
      `Table total width (${totalWidth}) exceeds the maximum supported width (${MAX_TABLE_WIDTH})`,
    );
  }

  rows.forEach((row, index) => validateRow(row, index, columns.length));

  return { type: ElementType.Table, columns, rows, style: options.style };
}
