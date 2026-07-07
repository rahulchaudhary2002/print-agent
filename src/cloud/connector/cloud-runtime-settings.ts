import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import type { ConfigUpdatePayload } from '../protocol/index.js';

export type CloudRuntimeSettings = ConfigUpdatePayload;

const DEFAULT_SETTINGS: CloudRuntimeSettings = {};

/**
 * Step 12 — whatever the server pushes via CONFIG_UPDATE, persisted so it survives a restart.
 * Same load/save-a-JSON-file shape as ConfigService, kept separate since this is cloud-owned
 * state, distinct from the agent's own local config.json.
 */
export class CloudConfigStore {
  private settings: CloudRuntimeSettings = { ...DEFAULT_SETTINGS };

  constructor(private readonly filePath: string) {}

  async load(): Promise<CloudRuntimeSettings> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.settings = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as CloudRuntimeSettings) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    return this.settings;
  }

  async merge(update: CloudRuntimeSettings): Promise<CloudRuntimeSettings> {
    this.settings = { ...this.settings, ...update };
    await fs.mkdir(dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8');
    return this.settings;
  }

  get current(): CloudRuntimeSettings {
    return this.settings;
  }
}
