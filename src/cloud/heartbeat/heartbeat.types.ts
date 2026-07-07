export interface HeartbeatSystemInfo {
  cpuLoadAverage: number[];
  memory: { totalMb: number; freeMb: number; usedPercent: number };
  disk: { totalMb: number; freeMb: number; usedPercent: number } | null;
  network: { interfaces: string[] };
}

export interface HeartbeatPayload {
  machineId: string;
  appVersion: string;
  queueLength: number;
  /** Printer status (online/offline/busy/...) mapped to how many printers are in that state. */
  printerStatusSummary: Record<string, number>;
  system: HeartbeatSystemInfo;
}
