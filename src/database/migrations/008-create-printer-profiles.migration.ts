import type { Migration } from './migration-runner.js';

export const createPrinterProfilesTableMigration: Migration = {
  name: '008_create_printer_profiles',
  sql: `CREATE TABLE IF NOT EXISTS printer_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    model TEXT,
    paper_width TEXT NOT NULL,
    default_renderer TEXT NOT NULL,
    supported_drivers TEXT NOT NULL,
    encoding TEXT NOT NULL,
    capabilities TEXT NOT NULL,
    image_support INTEGER NOT NULL DEFAULT 0,
    qr_support INTEGER NOT NULL DEFAULT 0,
    barcode_support INTEGER NOT NULL DEFAULT 0,
    cash_drawer_support INTEGER NOT NULL DEFAULT 0,
    cut_support INTEGER NOT NULL DEFAULT 0,
    is_builtin INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
};
