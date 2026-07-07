import type { Application } from '../../applications/application.types.js';
import type { DatabaseService } from '../database.service.js';

interface ApplicationRow {
  id: string;
  name: string;
  version: string | null;
  vendor: string | null;
  api_key: string;
  api_secret_hash: string;
  webhook_url: string | null;
  allowed_features: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

function mapRowToApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    vendor: row.vendor,
    apiKey: row.api_key,
    webhookUrl: row.webhook_url,
    allowedFeatures: JSON.parse(row.allowed_features) as string[],
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface StoredApplication extends Application {
  apiSecretHash: string;
}

/** All SQL for the `applications` table — services never touch SQL directly. */
export class ApplicationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.getInstance();
  }

  create(application: StoredApplication): void {
    this.db
      .prepare(
        `INSERT INTO applications
           (id, name, version, vendor, api_key, api_secret_hash, webhook_url, allowed_features, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        application.id,
        application.name,
        application.version,
        application.vendor,
        application.apiKey,
        application.apiSecretHash,
        application.webhookUrl,
        JSON.stringify(application.allowedFeatures),
        application.enabled ? 1 : 0,
        application.createdAt,
        application.updatedAt,
      );
  }

  findById(id: string): Application | undefined {
    const row = this.db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as ApplicationRow | undefined;
    return row ? mapRowToApplication(row) : undefined;
  }

  /** Includes the secret hash — only for the auth middleware, which needs to verify against it. */
  findByApiKeyWithSecret(apiKey: string): StoredApplication | undefined {
    const row = this.db.prepare('SELECT * FROM applications WHERE api_key = ?').get(apiKey) as ApplicationRow | undefined;
    return row ? { ...mapRowToApplication(row), apiSecretHash: row.api_secret_hash } : undefined;
  }

  findAll(): Application[] {
    const rows = this.db.prepare('SELECT * FROM applications ORDER BY created_at ASC').all() as ApplicationRow[];
    return rows.map(mapRowToApplication);
  }

  setEnabled(id: string, enabled: boolean): void {
    this.db
      .prepare('UPDATE applications SET enabled = ?, updated_at = ? WHERE id = ?')
      .run(enabled ? 1 : 0, new Date().toISOString(), id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM applications WHERE id = ?').run(id);
  }
}
