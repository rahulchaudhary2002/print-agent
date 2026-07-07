import type { Migration } from './migration-runner.js';

export const createPrintJobEventsTableMigration: Migration = {
  name: '004_create_print_job_events',
  sql: `
    CREATE TABLE IF NOT EXISTS print_job_events (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT,
      metadata TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES print_jobs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_print_job_events_job_id ON print_job_events(job_id);
  `,
};
