import { TtlCache } from './ttl-cache.util.js';
import type { PrinterCapabilitySnapshot } from '../capabilities/capability.types.js';
import type { DiscoveryResultEntry } from '../discovery/types/index.js';
import type { PrinterHealthSnapshot } from '../health/printer-health.types.js';
import type { PrinterProfile } from '../profiles/printer-profile.types.js';

const DISCOVERY_TTL_MS = 60_000;
const CAPABILITIES_TTL_MS = 5 * 60_000;
const PROFILES_TTL_MS = 5 * 60_000;
const HEALTH_TTL_MS = 15_000;

const DISCOVERY_KEY = 'discovery:all';
const PROFILES_KEY = 'profiles:all';

/**
 * Central cache for the discovery/configuration system (Step 13) — one named TTL cache per
 * concern, so re-reading `/discovery`, `/printers/capabilities`, `/printers/health`, or
 * `/printers/profiles` doesn't re-scan hardware or re-run driver probes on every HTTP request.
 * `DiscoveryManager` still owns *when* to invalidate (a completed scan, a config change).
 */
export class PrinterCacheService {
  private readonly discovery = new TtlCache<string, DiscoveryResultEntry[]>(DISCOVERY_TTL_MS);
  private readonly capabilities = new TtlCache<string, PrinterCapabilitySnapshot>(CAPABILITIES_TTL_MS);
  private readonly profiles = new TtlCache<string, PrinterProfile[]>(PROFILES_TTL_MS);
  private readonly health = new TtlCache<string, PrinterHealthSnapshot>(HEALTH_TTL_MS);

  getDiscovery(): DiscoveryResultEntry[] | undefined {
    return this.discovery.get(DISCOVERY_KEY);
  }

  setDiscovery(entries: DiscoveryResultEntry[]): void {
    this.discovery.set(DISCOVERY_KEY, entries);
  }

  getCapabilities(printerId: string): PrinterCapabilitySnapshot | undefined {
    return this.capabilities.get(printerId);
  }

  setCapabilities(printerId: string, snapshot: PrinterCapabilitySnapshot): void {
    this.capabilities.set(printerId, snapshot);
  }

  invalidateCapabilities(printerId: string): void {
    this.capabilities.delete(printerId);
  }

  getProfiles(): PrinterProfile[] | undefined {
    return this.profiles.get(PROFILES_KEY);
  }

  setProfiles(profiles: PrinterProfile[]): void {
    this.profiles.set(PROFILES_KEY, profiles);
  }

  invalidateProfiles(): void {
    this.profiles.delete(PROFILES_KEY);
  }

  getHealth(printerId: string): PrinterHealthSnapshot | undefined {
    return this.health.get(printerId);
  }

  setHealth(printerId: string, snapshot: PrinterHealthSnapshot): void {
    this.health.set(printerId, snapshot);
  }

  invalidateHealth(printerId: string): void {
    this.health.delete(printerId);
  }

  /** Drops every expired entry across all sub-caches — call on a slow interval, not per-request. */
  sweep(): void {
    this.discovery.sweep();
    this.capabilities.sweep();
    this.profiles.sweep();
    this.health.sweep();
  }
}
