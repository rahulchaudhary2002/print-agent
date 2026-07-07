import { DatabaseService } from '../database/index.js';
import { DATABASE_FILE_PATH } from '../utils/index.js';

/**
 * Step 8 (installer) — runs pending database migrations without starting the full service.
 * Used by the installer after a fresh install or upgrade, and safe to run any number of times
 * (each migration is tracked in `_migrations` and only applied once). Contains no migration
 * logic itself — it only opens the same `DatabaseService` the app uses and calls `.migrate()`.
 */
function main(): void {
  const databaseService = new DatabaseService(DATABASE_FILE_PATH);
  databaseService.open();
  try {
    databaseService.migrate();
    console.log('Database migrations applied successfully');
  } finally {
    databaseService.close();
  }
}

main();
