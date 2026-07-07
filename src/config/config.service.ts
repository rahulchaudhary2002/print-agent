import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_CONFIG, type AppConfig, type MutableAppConfig } from './config.types.js';

/**
 * Loads, persists, and exposes typed access to the agent's local configuration file.
 * Creates the file with default values on first run.
 */
export class ConfigService {
  private config: AppConfig = { ...DEFAULT_CONFIG };

  constructor(private readonly configFilePath: string) {}

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.configFilePath, 'utf-8');
      this.config = { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<AppConfig>) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.config = { ...DEFAULT_CONFIG };
        await this.save();
        return;
      }
      throw error;
    }
  }

  async save(): Promise<void> {
    await fs.mkdir(dirname(this.configFilePath), { recursive: true });
    await fs.writeFile(this.configFilePath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
  }

  /** Returns a copy — callers can inspect the whole config without being able to mutate it directly. */
  getAll(): AppConfig {
    return { ...this.config };
  }

  /** Merges only the client-mutable settings (PUT /config) and persists. */
  async update(patch: { [K in keyof MutableAppConfig]?: MutableAppConfig[K] | undefined }): Promise<AppConfig> {
    this.config = {
      ...this.config,
      defaultPrinterId: patch.defaultPrinterId ?? this.config.defaultPrinterId,
      paperWidth: patch.paperWidth ?? this.config.paperWidth,
      autoCut: patch.autoCut ?? this.config.autoCut,
      loggingLevel: patch.loggingLevel ?? this.config.loggingLevel,
      queueSize: patch.queueSize ?? this.config.queueSize,
      retryCount: patch.retryCount ?? this.config.retryCount,
      renderTimeoutMs: patch.renderTimeoutMs ?? this.config.renderTimeoutMs,
      printTimeoutMs: patch.printTimeoutMs ?? this.config.printTimeoutMs,
      allowRemote: patch.allowRemote ?? this.config.allowRemote,
      requireApiKey: patch.requireApiKey ?? this.config.requireApiKey,
      corsOrigins: patch.corsOrigins ?? this.config.corsOrigins,
      rateLimitMax: patch.rateLimitMax ?? this.config.rateLimitMax,
      rateLimitWindowMs: patch.rateLimitWindowMs ?? this.config.rateLimitWindowMs,
      discoveryIntervalMs: patch.discoveryIntervalMs ?? this.config.discoveryIntervalMs,
    };
    await this.save();
    return this.getAll();
  }

  /** POST /config/reset — back to factory defaults, persisted immediately. */
  async reset(): Promise<AppConfig> {
    this.config = { ...DEFAULT_CONFIG };
    await this.save();
    return this.getAll();
  }
}
