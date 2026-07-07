import { AppError } from '../../utils/index.js';
import type { MachineIdentity } from './machine-identity.types.js';
import type { RegistrationResponse, RegistrationTransport } from './registration.types.js';

/**
 * The real (HTTP) implementation, for whenever a cloud server exists to talk to. HTTPS-only
 * (Step 13) except for `http://localhost`, which stays open for local development.
 */
export class HttpRegistrationTransport implements RegistrationTransport {
  constructor(private readonly baseUrl: string) {
    if (!baseUrl.startsWith('https://') && !baseUrl.startsWith('http://localhost')) {
      throw new AppError('Cloud registration URL must use HTTPS (http://localhost is allowed for development)', 400);
    }
  }

  async register(identity: MachineIdentity): Promise<RegistrationResponse> {
    return this.request('POST', '/api/agents/register', identity);
  }

  async unregister(machineUuid: string, agentToken: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/agents/${machineUuid}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    if (!response.ok) {
      throw new AppError(`Unregister failed: ${response.status} ${response.statusText}`, response.status);
    }
  }

  async refresh(machineUuid: string, refreshToken: string): Promise<RegistrationResponse> {
    return this.request('POST', `/api/agents/${machineUuid}/refresh`, { refreshToken });
  }

  private async request(method: string, path: string, body: unknown): Promise<RegistrationResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new AppError(`Cloud request failed: ${response.status} ${response.statusText}`, response.status);
    }
    return (await response.json()) as RegistrationResponse;
  }
}
