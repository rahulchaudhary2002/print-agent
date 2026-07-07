import type { DatabaseService } from '../database.service.js';
import type { PersistedPrinterHealth } from '../../printer/health/printer-health.types.js';

interface PrinterHealthRow {
  printer_id: string;
  status: string;
  last_seen_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  failure_count: number;
  recovery_count: number;
  updated_at: string;
}

function mapRowToHealth(row: PrinterHealthRow): PersistedPrinterHealth {
  return {
    printerId: row.printer_id,
    status: row.status as PersistedPrinterHealth['status'],
    lastSeenAt: row.last_seen_at,
    lastSuccessAt: row.last_success_at,
    lastError: row.last_error,
    failureCount: row.failure_count,
    recoveryCount: row.recovery_count,
    updatedAt: row.updated_at,
  };
}

/** All SQL for the `printer_health` table — one row per printer, continuously updated by PrinterHealthMonitor. */
export class PrinterHealthRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.getInstance();
  }

  upsert(health: PersistedPrinterHealth): void {
    this.db
      .prepare(
        `INSERT INTO printer_health
           (printer_id, status, last_seen_at, last_success_at, last_error, failure_count, recovery_count, updated_at)
         VALUES (@printerId, @status, @lastSeenAt, @lastSuccessAt, @lastError, @failureCount, @recoveryCount, @updatedAt)
         ON CONFLICT(printer_id) DO UPDATE SET
           status = excluded.status,
           last_seen_at = excluded.last_seen_at,
           last_success_at = excluded.last_success_at,
           last_error = excluded.last_error,
           failure_count = excluded.failure_count,
           recovery_count = excluded.recovery_count,
           updated_at = excluded.updated_at`,
      )
      .run(health);
  }

  findByPrinterId(printerId: string): PersistedPrinterHealth | undefined {
    const row = this.db.prepare('SELECT * FROM printer_health WHERE printer_id = ?').get(printerId) as
      | PrinterHealthRow
      | undefined;
    return row ? mapRowToHealth(row) : undefined;
  }

  findAll(): PersistedPrinterHealth[] {
    const rows = this.db.prepare('SELECT * FROM printer_health').all() as PrinterHealthRow[];
    return rows.map(mapRowToHealth);
  }

  delete(printerId: string): void {
    this.db.prepare('DELETE FROM printer_health WHERE printer_id = ?').run(printerId);
  }
}
