import type { MachineIdentity } from './machine-identity.types.js';

export interface ReconnectPolicyConfig {
  delaysMs: number[];
  maxDelayMs: number;
}

export interface RegistrationResponse {
  agentToken: string;
  refreshToken: string;
  expiresAt?: string | undefined;
  heartbeatIntervalMs: number;
  reconnectPolicy?: ReconnectPolicyConfig | undefined;
  config?: Record<string, unknown> | undefined;
}

/**
 * The cloud server isn't implemented yet (out of scope for this phase), so registration is
 * defined behind this interface — swap in a real transport once one exists, or a fake one in
 * tests, without RegistrationService knowing the difference.
 */
export interface RegistrationTransport {
  register(identity: MachineIdentity): Promise<RegistrationResponse>;
  unregister(machineUuid: string, agentToken: string): Promise<void>;
  refresh(machineUuid: string, refreshToken: string): Promise<RegistrationResponse>;
}
