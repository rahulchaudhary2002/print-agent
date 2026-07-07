import type { Migration } from './migration-runner.js';

export const createPrintJobsTableMigration: Migration = {
  name: '003_create_print_jobs',
  sql: `
    CREATE TABLE IF NOT EXISTS print_jobs (
      id TEXT PRIMARY KEY,
      printer_id TEXT,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      retry_count INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      finished_at DATETIME,
      FOREIGN KEY (printer_id) REFERENCES printers(id)
    );
  `,
};
