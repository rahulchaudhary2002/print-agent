export interface AgentCredentials {
  agentToken: string;
  refreshToken: string;
  /** `null` when the server didn't specify an expiry. */
  expiresAt: string | null;
}
