export interface ConnectionDiagnosticsSnapshot {
  connectedAt: string | null;
  connectionDurationMs: number | null;
  reconnectCount: number;
  packetsSent: number;
  packetsReceived: number;
  lastLatencyMs: number | null;
  averageLatencyMs: number;
  authenticationFailures: number;
}

const MAX_LATENCY_SAMPLES = 50;

/** Step 17 — tracked by WebSocketClient (which directly observes all of this) and read by CloudConnector. */
export class ConnectionDiagnostics {
  private connectedAtMs: number | null = null;
  private reconnectCount = 0;
  private packetsSent = 0;
  private packetsReceived = 0;
  private authenticationFailures = 0;
  private readonly latencySamplesMs: number[] = [];

  recordConnected(): void {
    this.connectedAtMs = Date.now();
  }

  recordDisconnected(): void {
    this.connectedAtMs = null;
  }

  recordReconnectAttempt(): void {
    this.reconnectCount += 1;
  }

  recordPacketSent(): void {
    this.packetsSent += 1;
  }

  recordPacketReceived(): void {
    this.packetsReceived += 1;
  }

  recordAuthenticationFailure(): void {
    this.authenticationFailures += 1;
  }

  recordLatency(latencyMs: number): void {
    this.latencySamplesMs.push(latencyMs);
    if (this.latencySamplesMs.length > MAX_LATENCY_SAMPLES) {
      this.latencySamplesMs.shift();
    }
  }

  snapshot(): ConnectionDiagnosticsSnapshot {
    const lastLatencyMs = this.latencySamplesMs.at(-1) ?? null;
    const averageLatencyMs =
      this.latencySamplesMs.length > 0
        ? Math.round(this.latencySamplesMs.reduce((sum, value) => sum + value, 0) / this.latencySamplesMs.length)
        : 0;

    return {
      connectedAt: this.connectedAtMs !== null ? new Date(this.connectedAtMs).toISOString() : null,
      connectionDurationMs: this.connectedAtMs !== null ? Date.now() - this.connectedAtMs : null,
      reconnectCount: this.reconnectCount,
      packetsSent: this.packetsSent,
      packetsReceived: this.packetsReceived,
      lastLatencyMs,
      averageLatencyMs,
      authenticationFailures: this.authenticationFailures,
    };
  }
}
