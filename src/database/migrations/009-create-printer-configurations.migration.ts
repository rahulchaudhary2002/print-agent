import type { Migration } from './migration-runner.js';

export const createPrinterConfigurationsTableMigration: Migration = {
  name: '009_create_printer_configurations',
  sql: `CREATE TABLE IF NOT EXISTS printer_configurations (
    printer_id TEXT PRIMARY KEY REFERENCES printers(id) ON DELETE CASCADE,
    friendly_name TEXT,
    profile_id TEXT,
    preferred_driver TEXT,
    paper_width TEXT,
    renderer TEXT,
    timeout_ms INTEGER,
    retry_max INTEGER,
    retry_backoff_ms INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
};
