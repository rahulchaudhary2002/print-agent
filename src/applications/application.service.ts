import { randomUUID } from 'node:crypto';
import type { ApplicationRepository, StoredApplication } from '../database/repositories/index.js';
import { AppError, generateToken, hashSecret, verifySecret } from '../utils/index.js';
import type { Application, CreateApplicationInput, CreatedApplication } from './application.types.js';

/**
 * Local application registration (Step 15) — the on-machine equivalent of the cloud module's
 * agent registration, but for business applications (POS, ERP, ...) calling this agent's API.
 */
export class ApplicationService {
  constructor(private readonly applicationRepository: ApplicationRepository) {}

  /** Returns the plaintext secret exactly once — only its hash is ever stored or shown again. */
  register(input: CreateApplicationInput): CreatedApplication {
    const now = new Date().toISOString();
    const apiKey = generateToken('pk');
    const apiSecret = generateToken('sk');

    const application: StoredApplication = {
      id: randomUUID(),
      name: input.name,
      version: input.version ?? null,
      vendor: input.vendor ?? null,
      apiKey,
      apiSecretHash: hashSecret(apiSecret),
      webhookUrl: input.webhookUrl ?? null,
      allowedFeatures: input.allowedFeatures ?? [],
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    this.applicationRepository.create(application);
    const { apiSecretHash: _apiSecretHash, ...publicApplication } = application;
    return { ...publicApplication, apiSecret };
  }

  getById(id: string): Application {
    const application = this.applicationRepository.findById(id);
    if (!application) {
      throw new AppError(`Application ${id} not found`, 404);
    }
    return application;
  }

  list(): Application[] {
    return this.applicationRepository.findAll();
  }

  disable(id: string): Application {
    this.getById(id);
    this.applicationRepository.setEnabled(id, false);
    return this.getById(id);
  }

  enable(id: string): Application {
    this.getById(id);
    this.applicationRepository.setEnabled(id, true);
    return this.getById(id);
  }

  delete(id: string): void {
    this.getById(id);
    this.applicationRepository.delete(id);
  }

  /** Used by the optional API-key auth middleware — never throws, just answers yes/no. */
  verifyCredentials(apiKey: string, apiSecret: string): Application | null {
    const stored = this.applicationRepository.findByApiKeyWithSecret(apiKey);
    if (!stored || !stored.enabled) {
      return null;
    }
    if (!verifySecret(apiSecret, stored.apiSecretHash)) {
      return null;
    }
    const { apiSecretHash: _apiSecretHash, ...publicApplication } = stored;
    return publicApplication;
  }
}
