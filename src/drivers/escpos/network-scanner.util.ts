import net from 'node:net';
import os from 'node:os';
import type { DiscoveredPrinter } from '../../printer/interfaces/index.js';

const DEFAULT_PORT = 9100;
const DEFAULT_PROBE_TIMEOUT_MS = 300;
const DEFAULT_CONCURRENCY = 32;
/** Hard cap on hosts probed per call — this is LAN printer discovery, not a network scanner. */
const MAX_HOSTS = 254;

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

function probeHost(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (result: boolean): void => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

export interface NetworkScanOptions {
  hosts?: string[];
  port?: number;
  timeoutMs?: number;
  concurrency?: number;
}

/**
 * Probes a bounded set of hosts (defaults to the local /24 subnet) on the ESC/POS network
 * port. Batched with a concurrency cap and a short per-host timeout — a LAN discovery sweep,
 * not a mass port scanner.
 */
export async function scanNetworkPrinters(options: NetworkScanOptions = {}): Promise<DiscoveredPrinter[]> {
  const hosts = (options.hosts ?? getLocalSubnetHosts()).slice(0, MAX_HOSTS);
  const port = options.port ?? DEFAULT_PORT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  const found: DiscoveredPrinter[] = [];
  for (let index = 0; index < hosts.length; index += concurrency) {
    const batch = hosts.slice(index, index + concurrency);
    const results = await Promise.all(
      batch.map(async (host) => ({ host, reachable: await probeHost(host, port, timeoutMs) })),
    );
    for (const result of results) {
      if (result.reachable) {
        found.push({ name: `Network Printer (${result.host})`, connection: 'Network', driver: 'network' });
      }
    }
  }
  return found;
}
