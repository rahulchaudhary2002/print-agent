import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DiscoveredPrinterCandidate } from '../types/index.js';

const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MS = 5000;

async function run(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('lpstat', args, { timeout: COMMAND_TIMEOUT_MS });
    return stdout;
  } catch {
    return '';
  }
}

function parseDefault(output: string): string | undefined {
  const match = /system default destination: (\S+)/.exec(output);
  return match?.[1];
}

/** `lpstat -v` lines look like `device for EPSON: usb://EPSON/TM-T88V`. */
function parseUris(output: string): Map<string, string> {
  const uris = new Map<string, string>();
  for (const line of output.split('\n')) {
    const match = /^device for ([^:]+): (.+)$/.exec(line.trim());
    if (match?.[1] && match[2]) {
      uris.set(match[1], match[2]);
    }
  }
  return uris;
}

/** `lpstat -p` lines look like `printer EPSON is idle.  enabled since ...` or `... now printing ...`. */
function parseQueueInfo(output: string): Map<string, string> {
  const info = new Map<string, string>();
  for (const line of output.split('\n')) {
    const match = /^printer (\S+) (.+)$/.exec(line.trim());
    if (match?.[1] && match[2]) {
      info.set(match[1], match[2]);
    }
  }
  return info;
}

/**
 * Normalized CUPS printer discovery (Step 6) — installed destinations, which one is the
 * default, each printer's device URI, and its current queue/status line. `[]` on Windows.
 */
export async function scanCupsCandidates(): Promise<DiscoveredPrinterCandidate[]> {
  if (process.platform === 'win32') {
    return [];
  }

  const [namesOutput, defaultOutput, uriOutput, queueOutput] = await Promise.all([
    run(['-e']),
    run(['-d']),
    run(['-v']),
    run(['-p']),
  ]);

  const names = namesOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const defaultPrinter = parseDefault(defaultOutput);
  const uris = parseUris(uriOutput);
  const queueInfo = parseQueueInfo(queueOutput);
  const now = new Date().toISOString();

  return names.map((name) => ({
    fingerprint: `cups:${name}`,
    name,
    driver: 'cups',
    transport: 'cups' as const,
    connection: { printerName: name },
    isDefault: name === defaultPrinter,
    uri: uris.get(name),
    queueInfo: queueInfo.get(name),
    status: queueInfo.get(name)?.includes('disabled') ? 'disabled' : 'enabled',
    discoveredAt: now,
  }));
}
