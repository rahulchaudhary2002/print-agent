import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { arch, hostname, platform } from 'node:os';
import { dirname } from 'node:path';
import { AppError } from '../../utils/index.js';
import type { MachineIdentity } from './machine-identity.types.js';

/**
 * Generates the agent's permanent identity on first startup (Step 2) and persists it —
 * `reset()` is the only way to get a new one; `load()` never regenerates an existing identity.
 */
export class MachineIdentityService {
  private identity: MachineIdentity | null = null;

  constructor(
    private readonly identityFilePath: string,
    private readonly appVersion: string,
  ) {}

  async load(): Promise<MachineIdentity> {
    if (this.identity) {
      return this.identity;
    }
    try {
      const raw = await fs.readFile(this.identityFilePath, 'utf-8');
      this.identity = JSON.parse(raw) as MachineIdentity;
      return this.identity;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.identity = await this.generateAndSave();
        return this.identity;
      }
      throw error;
    }
  }

  get(): MachineIdentity {
    if (!this.identity) {
      throw new AppError('Machine identity has not been loaded yet — call load() first', 500);
    }
    return this.identity;
  }

  /** Explicit reset only (Step 2: "Never regenerate unless explicitly reset") — a new machine identity. */
  async reset(): Promise<MachineIdentity> {
    this.identity = await this.generateAndSave();
    return this.identity;
  }

  private async generateAndSave(): Promise<MachineIdentity> {
    const identity: MachineIdentity = {
      machineUuid: randomUUID(),
      installationId: randomUUID(),
      publicName: hostname(),
      platform: platform(),
      arch: arch(),
      hostname: hostname(),
      appVersion: this.appVersion,
      createdAt: new Date().toISOString(),
    };
    await fs.mkdir(dirname(this.identityFilePath), { recursive: true });
    await fs.writeFile(this.identityFilePath, JSON.stringify(identity, null, 2), 'utf-8');
    return identity;
  }
}
