import type { Printer } from '../../printer/printer.types.js';
import type { DatabaseService } from '../database.service.js';

interface PrinterRow {
  id: string;
  name: string;
  driver: string;
  connection_type: string;
  connection: string;
  status: string;
  is_default: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

function mapRowToPrinter(row: PrinterRow): Printer {
  return {
    id: row.id,
    name: row.name,
    driver: row.driver,
    connectionType: row.connection_type,
    connection: JSON.parse(row.connection) as Printer['connection'],
    status: row.status as Printer['status'],
    isDefault: row.is_default === 1,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** All SQL for the `printers` table lives here — services never touch SQL directly. */
export class PrinterRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.getInstance();
  }

  create(printer: Printer): void {
    this.db
      .prepare(
        `INSERT INTO printers (id, name, driver, connection_type, connection, status, is_default, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        printer.id,
        printer.name,
        printer.driver,
        printer.connectionType,
        JSON.stringify(printer.connection),
        printer.status,
        printer.isDefault ? 1 : 0,
        printer.enabled ? 1 : 0,
        printer.createdAt,
        printer.updatedAt,
      );
  }

  update(printer: Printer): void {
    this.db
      .prepare(
        `UPDATE printers
         SET name = ?, driver = ?, connection_type = ?, connection = ?, status = ?, is_default = ?, enabled = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        printer.name,
        printer.driver,
        printer.connectionType,
        JSON.stringify(printer.connection),
        printer.status,
        printer.isDefault ? 1 : 0,
        printer.enabled ? 1 : 0,
        printer.updatedAt,
        printer.id,
      );
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM printers WHERE id = ?').run(id);
  }

  findById(id: string): Printer | undefined {
    const row = this.db.prepare('SELECT * FROM printers WHERE id = ?').get(id) as PrinterRow | undefined;
    return row ? mapRowToPrinter(row) : undefined;
  }

  findAll(): Printer[] {
    const rows = this.db.prepare('SELECT * FROM printers ORDER BY created_at ASC').all() as PrinterRow[];
    return rows.map(mapRowToPrinter);
  }

  /** Clears the default flag on whichever printer currently holds it. */
  clearDefault(): void {
    this.db.prepare('UPDATE printers SET is_default = 0 WHERE is_default = 1').run();
  }
}
