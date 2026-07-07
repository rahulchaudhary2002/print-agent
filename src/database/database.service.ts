import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { AppError } from '../utils/index.js';
import { MIGRATIONS, runMigrations } from './migrations/index.js';

/** Owns the single SQLite connection: opening, migrating, exposing, and closing it. */
export class DatabaseService {
  private database: Database.Database | null = null;

  constructor(private readonly databaseFilePath: string) {}

  open(): void {
    mkdirSync(dirname(this.databaseFilePath), { recursive: true });
    this.database = new Database(this.databaseFilePath);
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('foreign_keys = ON');
  }

  migrate(): void {
    runMigrations(this.getInstance(), MIGRATIONS);
  }

  getInstance(): Database.Database {
    if (!this.database) {
      throw new AppError('Database has not been opened', 500);
    }
    return this.database;
  }

  close(): void {
    this.getInstance().close();
  }
}
