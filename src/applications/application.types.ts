/** A business application registered to use this agent's local API (Step 15) — never a cloud concept. */
export interface Application {
  id: string;
  name: string;
  version: string | null;
  vendor: string | null;
  apiKey: string;
  webhookUrl: string | null;
  allowedFeatures: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationInput {
  name: string;
  version?: string | undefined;
  vendor?: string | undefined;
  webhookUrl?: string | undefined;
  allowedFeatures?: string[] | undefined;
}

/** Returned only once, at creation time — the secret's hash is all that's ever persisted. */
export interface CreatedApplication extends Application {
  apiSecret: string;
}
