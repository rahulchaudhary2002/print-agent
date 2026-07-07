import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import type { AgentCredentials } from './auth.types.js';

/**
 * Persists the agent's cloud tokens as a file, mode 0600 (owner read/write only) — the closest
 * this platform-independent, dependency-free agent can get to "store securely" without pulling
 * in an OS keychain integration. Credentials never appear in logs or REST responses.
 */
export class AuthStore {
  private credentials: AgentCredentials | null = null;

  constructor(private readonly filePath: string) {}

  async load(): Promise<AgentCredentials | null> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.credentials = JSON.parse(raw) as AgentCredentials;
      return this.credentials;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async save(credentials: AgentCredentials): Promise<void> {
    this.credentials = credentials;
    await fs.mkdir(dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(credentials, null, 2), { encoding: 'utf-8', mode: 0o600 });
    await fs.chmod(this.filePath, 0o600);
  }

  async clear(): Promise<void> {
    this.credentials = null;
    await fs.rm(this.filePath, { force: true });
  }

  get current(): AgentCredentials | null {
    return this.credentials;
  }

  isExpired(): boolean {
    if (!this.credentials?.expiresAt) {
      return false;
    }
    return new Date(this.credentials.expiresAt).getTime() <= Date.now();
  }
}
