import type { DatabaseService } from '../database.service.js';

interface SettingRow {
  key: string;
  value: string;
}

/** All SQL for the `settings` key/value table lives here — services never touch SQL directly. */
export class SettingsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.getInstance();
  }

  get(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as SettingRow | undefined;
    return row?.value;
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value, created_at, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      )
      .run(key, value);
  }

  delete(key: string): void {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }

  list(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as SettingRow[];
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }
}
