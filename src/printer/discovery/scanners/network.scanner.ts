import net from 'node:net';
import os from 'node:os';
import type { DiscoveredPrinterCandidate } from '../types/index.js';

/** Raw ports (9100), LPR (515), and IPP/CUPS-over-network (631) — Step 4's three well-known printer ports. */
const DEFAULT_PORTS = [9100, 515, 631];
const DEFAULT_PROBE_TIMEOUT_MS = 300;
const DEFAULT_CONCURRENCY = 32;
const MAX_HOSTS = 254;

export interface NetworkDiscoveryOptions {
  /** Explicit hosts to probe (manual IP scan) — overrides the auto-detected /24 subnet sweep. */
  hosts?: string[] | undefined;
  /** Ports to probe per host; defaults to [9100, 515, 631]. */
  ports?: number[] | undefined;
  timeoutMs?: number | undefined;
  concurrency?: number | undefined;
}

function getLocalSubnetHosts(): string[] {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        const prefix = entry.address.split('.').slice(0, 3).join('.');
        return Array.from({ length: MAX_HOSTS }, (_, index) => `${prefix}.${index + 1}`);
      }
    }
  }
  return [];
}

function probeHost(host: string, port: number, timeoutMs: number): Promise<number | null> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const socket = new net.Socket();
    const finish = (result: number | null): void => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(Date.now() - startedAt));
    socket.once('timeout', () => finish(null));
    socket.once('error', () => finish(null));
    socket.connect(port, host);
  });
}

/**
 * Normalized network printer discovery (Step 4) — manual IP list or auto subnet range scan,
 * probing ports 9100/515/631 with a configurable timeout, recording response time per hit.
 */
export async function scanNetworkCandidates(options: NetworkDiscoveryOptions = {}): Promise<DiscoveredPrinterCandidate[]> {
  const hosts = (options.hosts ?? getLocalSubnetHosts()).slice(0, MAX_HOSTS);
  const ports = options.ports ?? DEFAULT_PORTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const now = new Date().toISOString();

  const found: DiscoveredPrinterCandidate[] = [];
  const targets = hosts.flatMap((host) => ports.map((port) => ({ host, port })));

  for (let index = 0; index < targets.length; index += concurrency) {
    const batch = targets.slice(index, index + concurrency);
    const results = await Promise.all(
      batch.map(async (target) => ({ ...target, responseTimeMs: await probeHost(target.host, target.port, timeoutMs) })),
    );
    for (const result of results) {
      if (result.responseTimeMs !== null) {
        found.push({
          fingerprint: `network:${result.host}:${result.port}`,
          name: `Network Printer (${result.host}:${result.port})`,
          driver: result.port === 9100 ? 'network' : 'raw',
          transport: 'network',
          connection: { ip: result.host, port: result.port },
          ip: result.host,
          port: result.port,
          responseTimeMs: result.responseTimeMs,
          status: 'reachable',
          discoveredAt: now,
        });
      }
    }
  }
  return found;
}
