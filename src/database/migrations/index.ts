import type { Migration } from './migration-runner.js';
import { createSettingsTableMigration } from './001-create-settings.migration.js';
import { createPrintersTableMigration } from './002-create-printers.migration.js';
import { createPrintJobsTableMigration } from './003-create-print-jobs.migration.js';
import { createPrintJobEventsTableMigration } from './004-create-print-job-events.migration.js';
import { addPrinterEnabledColumnMigration } from './005-add-printer-enabled.migration.js';
import { createApplicationsTableMigration } from './006-create-applications.migration.js';
import { addPrintJobsApplicationIdMigration } from './007-add-print-jobs-application-id.migration.js';
import { createPrinterProfilesTableMigration } from './008-create-printer-profiles.migration.js';
import { createPrinterConfigurationsTableMigration } from './009-create-printer-configurations.migration.js';
import { createPrinterHealthTableMigration } from './010-create-printer-health.migration.js';

export const MIGRATIONS: Migration[] = [
  createSettingsTableMigration,
  createPrintersTableMigration,
  createPrintJobsTableMigration,
  createPrintJobEventsTableMigration,
  addPrinterEnabledColumnMigration,
  createApplicationsTableMigration,
  addPrintJobsApplicationIdMigration,
  createPrinterProfilesTableMigration,
  createPrinterConfigurationsTableMigration,
  createPrinterHealthTableMigration,
];

export * from './migration-runner.js';
