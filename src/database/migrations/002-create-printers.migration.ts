import type { Migration } from './migration-runner.js';

export const createPrintersTableMigration: Migration = {
  name: '002_create_printers',
  sql: `
    CREATE TABLE IF NOT EXISTS printers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      driver TEXT NOT NULL,
      connection_type TEXT NOT NULL,
      connection TEXT NOT NULL,
      status TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `,
};
