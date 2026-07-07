import type { DiscoveredPrinterCandidate } from '../types/index.js';

/**
 * Bluetooth printer discovery placeholder (Step 2/3). No Bluetooth stack is bundled with the
 * agent today — wiring a real scan means adding a platform BLE/RFCOMM dependency (e.g.
 * `@abandonware/noble`) and a matching driver. Kept as an explicit no-op (not omitted) so
 * `DiscoveryManager.discoverAll()` always reports which transports it swept.
 */
export async function scanBluetoothCandidates(): Promise<DiscoveredPrinterCandidate[]> {
  return [];
}
