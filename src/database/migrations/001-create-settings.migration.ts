import type { Migration } from './migration-runner.js';

export const createSettingsTableMigration: Migration = {
  name: '001_create_settings',
  sql: `
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `,
};
