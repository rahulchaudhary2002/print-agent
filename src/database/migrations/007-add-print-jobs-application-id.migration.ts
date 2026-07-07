import type { Migration } from './migration-runner.js';

export const addPrintJobsApplicationIdMigration: Migration = {
  name: '007_add_print_jobs_application_id',
  sql: `
    ALTER TABLE print_jobs ADD COLUMN application_id TEXT REFERENCES applications(id);
  `,
};
