import type { AuthStore } from '../auth/index.js';
import { CloudEventType, type CloudEventBus } from '../events/index.js';
import type { LoggerService } from '../../services/index.js';
import { AppError } from '../../utils/index.js';
import type { MachineIdentityService } from './machine-identity.service.js';
import type { RegistrationResponse, RegistrationTransport } from './registration.types.js';

/** Implements Step 3: register/unregister/refresh, persisting whatever the server hands back. */
export class RegistrationService {
  constructor(
    private readonly machineIdentityService: MachineIdentityService,
    private readonly transport: RegistrationTransport,
    private readonly authStore: AuthStore,
    private readonly events: CloudEventBus,
    private readonly logger: LoggerService,
  ) {}

  async register(): Promise<RegistrationResponse> {
    const identity = await this.machineIdentityService.load();
    try {
      const response = await this.transport.register(identity);
      await this.authStore.save({
        agentToken: response.agentToken,
        refreshToken: response.refreshToken,
        expiresAt: response.expiresAt ?? null,
      });
      this.events.emitEvent(CloudEventType.RegistrationCompleted, {
        timestamp: new Date().toISOString(),
        metadata: { machineUuid: identity.machineUuid },
      });
      this.logger.info('Registered with cloud platform', { machineUuid: identity.machineUuid });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.events.emitEvent(CloudEventType.RegistrationFailed, { timestamp: new Date().toISOString(), message });
      this.logger.error('Cloud registration failed', { error: message });
      throw error;
    }
  }

  async unregister(): Promise<void> {
    const identity = this.machineIdentityService.get();
    const credentials = await this.authStore.load();
    if (credentials) {
      await this.transport.unregister(identity.machineUuid, credentials.agentToken);
    }
    await this.authStore.clear();
    this.events.emitEvent(CloudEventType.Unregistered, { timestamp: new Date().toISOString() });
    this.logger.info('Unregistered from cloud platform', { machineUuid: identity.machineUuid });
  }

  async refresh(): Promise<RegistrationResponse> {
    const identity = this.machineIdentityService.get();
    const credentials = await this.authStore.load();
    if (!credentials) {
      throw new AppError('No cloud credentials to refresh — register first', 400);
    }
    const response = await this.transport.refresh(identity.machineUuid, credentials.refreshToken);
    await this.authStore.save({
      agentToken: response.agentToken,
      refreshToken: response.refreshToken,
      expiresAt: response.expiresAt ?? null,
    });
    this.events.emitEvent(CloudEventType.TokenRefreshed, { timestamp: new Date().toISOString() });
    this.logger.info('Refreshed cloud credentials', { machineUuid: identity.machineUuid });
    return response;
  }
}
