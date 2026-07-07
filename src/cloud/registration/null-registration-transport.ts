import { AppError } from '../../utils/index.js';
import type { MachineIdentity } from './machine-identity.types.js';
import type { RegistrationResponse, RegistrationTransport } from './registration.types.js';

/**
 * Used when no cloud server URL is configured — every call fails clearly and immediately
 * instead of the app either crashing at boot or silently trying to reach a blank URL.
 * Step 11: local API and local printing must work with zero cloud configuration at all.
 */
export class NullRegistrationTransport implements RegistrationTransport {
  async register(_identity: MachineIdentity): Promise<RegistrationResponse> {
    throw new AppError('Cloud server URL is not configured', 400);
  }

  async unregister(_machineUuid: string, _agentToken: string): Promise<void> {
    throw new AppError('Cloud server URL is not configured', 400);
  }

  async refresh(_machineUuid: string, _refreshToken: string): Promise<RegistrationResponse> {
    throw new AppError('Cloud server URL is not configured', 400);
  }
}
