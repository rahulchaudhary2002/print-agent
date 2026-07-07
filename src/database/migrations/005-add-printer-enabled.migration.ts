import type { Migration } from './migration-runner.js';

export const addPrinterEnabledColumnMigration: Migration = {
  name: '005_add_printer_enabled',
  sql: `
    ALTER TABLE printers ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
  `,
};
