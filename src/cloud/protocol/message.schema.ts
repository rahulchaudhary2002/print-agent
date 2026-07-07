import { z } from 'zod';
import { MessageType } from './message-type.enum.js';

/** The envelope every incoming frame must match before its payload is even looked at. */
export const messageEnvelopeSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  type: z.enum(MessageType),
  payload: z.unknown(),
});

export type MessageEnvelope = z.infer<typeof messageEnvelopeSchema>;

// ---- Server -> Agent command payloads (untrusted — validated before anything else touches them) ----

export const printJobPayloadSchema = z.object({
  remoteJobId: z.string().min(1),
  printerId: z.string().min(1),
  document: z.record(z.string(), z.unknown()),
  priority: z.number().int().optional(),
});
export type PrintJobPayload = z.infer<typeof printJobPayloadSchema>;

export const jobCancelPayloadSchema = z.object({ jobId: z.string().min(1) });
export type JobCancelPayload = z.infer<typeof jobCancelPayloadSchema>;

export const jobRetryPayloadSchema = z.object({ jobId: z.string().min(1) });
export type JobRetryPayload = z.infer<typeof jobRetryPayloadSchema>;

/**
 * `.strict()` rejects any key outside this allow-list — Step 13's "never allow arbitrary code
 * execution" starts here: a compromised/buggy server can only ever adjust these specific,
 * inert settings, never inject a field a naive future handler might act on unsafely.
 */
export const configUpdatePayloadSchema = z
  .object({
    heartbeatIntervalMs: z.number().int().positive().optional(),
    retryCount: z.number().int().positive().optional(),
    retryDelayMs: z.number().int().nonnegative().optional(),
    loggingLevel: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    defaultPrinterId: z.string().min(1).optional(),
    featureFlags: z.record(z.string(), z.boolean()).optional(),
  })
  .strict();
export type ConfigUpdatePayload = z.infer<typeof configUpdatePayloadSchema>;

export const errorPayloadSchema = z.object({ code: z.string().optional(), message: z.string() });
export type ErrorPayload = z.infer<typeof errorPayloadSchema>;

export const versionPayloadSchema = z.object({
  protocolVersion: z.string(),
  supportedVersions: z.array(z.string()).optional(),
});
export type VersionPayload = z.infer<typeof versionPayloadSchema>;

export const ackPayloadSchema = z.object({ messageId: z.string().min(1), success: z.boolean().optional() });
export type AckPayload = z.infer<typeof ackPayloadSchema>;

export const authPayloadSchema = z.object({
  agentToken: z.string().min(1).optional(),
  refreshToken: z.string().min(1).optional(),
  expiresAt: z.string().optional(),
  success: z.boolean().optional(),
});
export type AuthPayload = z.infer<typeof authPayloadSchema>;
