import { CloudEventType, type CloudEventBus } from '../events/index.js';

/** Step 15 — the agent's own view of itself, synchronized to the cloud via heartbeat/status. */
export enum AgentPresence {
  Online = 'online',
  Offline = 'offline',
  Busy = 'busy',
  Printing = 'printing',
  Idle = 'idle',
  Error = 'error',
}

export class PresenceTracker {
  private presence: AgentPresence = AgentPresence.Offline;

  constructor(private readonly events: CloudEventBus) {}

  set(presence: AgentPresence): void {
    if (this.presence === presence) {
      return;
    }
    this.presence = presence;
    this.events.emitEvent(CloudEventType.PresenceChanged, {
      timestamp: new Date().toISOString(),
      metadata: { presence },
    });
  }

  get current(): AgentPresence {
    return this.presence;
  }
}
