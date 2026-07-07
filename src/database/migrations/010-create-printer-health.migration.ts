import type { Migration } from './migration-runner.js';

export const createPrinterHealthTableMigration: Migration = {
  name: '010_create_printer_health',
  sql: `CREATE TABLE IF NOT EXISTS printer_health (
    printer_id TEXT PRIMARY KEY REFERENCES printers(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'unknown',
    last_seen_at DATETIME,
    last_success_at DATETIME,
    last_error TEXT,
    failure_count INTEGER NOT NULL DEFAULT 0,
    recovery_count INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
};
