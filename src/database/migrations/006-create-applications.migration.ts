import type { Migration } from './migration-runner.js';

export const createApplicationsTableMigration: Migration = {
  name: '006_create_applications',
  sql: `
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT,
      vendor TEXT,
      api_key TEXT NOT NULL UNIQUE,
      api_secret_hash TEXT NOT NULL,
      webhook_url TEXT,
      allowed_features TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_applications_api_key ON applications(api_key);
  `,
};
