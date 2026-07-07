import type { DatabaseService } from '../database.service.js';
import type { PrinterConfigurationOverrides } from '../../printer/configuration/printer-configuration.types.js';

interface PrinterConfigurationRow {
  printer_id: string;
  friendly_name: string | null;
  profile_id: string | null;
  preferred_driver: string | null;
  paper_width: string | null;
  renderer: string | null;
  timeout_ms: number | null;
  retry_max: number | null;
  retry_backoff_ms: number | null;
  created_at: string;
  updated_at: string;
}

function mapRowToOverrides(row: PrinterConfigurationRow): PrinterConfigurationOverrides {
  return {
    printerId: row.printer_id,
    friendlyName: row.friendly_name,
    profileId: row.profile_id,
    preferredDriver: row.preferred_driver,
    paperWidth: row.paper_width,
    renderer: row.renderer,
    timeoutMs: row.timeout_ms,
    retryMax: row.retry_max,
    retryBackoffMs: row.retry_backoff_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** All SQL for the `printer_configurations` table — extended, per-printer settings beyond the core `printers` row. */
export class PrinterConfigurationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.getInstance();
  }

  upsert(overrides: PrinterConfigurationOverrides): void {
    this.db
      .prepare(
        `INSERT INTO printer_configurations
           (printer_id, friendly_name, profile_id, preferred_driver, paper_width, renderer, timeout_ms, retry_max, retry_backoff_ms, created_at, updated_at)
         VALUES (@printerId, @friendlyName, @profileId, @preferredDriver, @paperWidth, @renderer, @timeoutMs, @retryMax, @retryBackoffMs, @createdAt, @updatedAt)
         ON CONFLICT(printer_id) DO UPDATE SET
           friendly_name = excluded.friendly_name,
           profile_id = excluded.profile_id,
           preferred_driver = excluded.preferred_driver,
           paper_width = excluded.paper_width,
           renderer = excluded.renderer,
           timeout_ms = excluded.timeout_ms,
           retry_max = excluded.retry_max,
           retry_backoff_ms = excluded.retry_backoff_ms,
           updated_at = excluded.updated_at`,
      )
      .run(overrides);
  }

  findByPrinterId(printerId: string): PrinterConfigurationOverrides | undefined {
    const row = this.db.prepare('SELECT * FROM printer_configurations WHERE printer_id = ?').get(printerId) as
      | PrinterConfigurationRow
      | undefined;
    return row ? mapRowToOverrides(row) : undefined;
  }

  findAll(): PrinterConfigurationOverrides[] {
    const rows = this.db.prepare('SELECT * FROM printer_configurations').all() as PrinterConfigurationRow[];
    return rows.map(mapRowToOverrides);
  }

  delete(printerId: string): void {
    this.db.prepare('DELETE FROM printer_configurations WHERE printer_id = ?').run(printerId);
  }
}
