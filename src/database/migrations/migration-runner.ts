import type Database from 'better-sqlite3';

export interface Migration {
  name: string;
  sql: string;
}

interface MigrationRow {
  name: string;
}

/** Applies any migrations not yet recorded in `_migrations`, each inside its own transaction. */
export function runMigrations(db: Database.Database, migrations: Migration[]): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedNames = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((row) => (row as MigrationRow).name),
  );

  const applyMigration = db.transaction((migration: Migration) => {
    db.exec(migration.sql);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name);
  });

  for (const migration of migrations) {
    if (!appliedNames.has(migration.name)) {
      applyMigration(migration);
    }
  }
}
