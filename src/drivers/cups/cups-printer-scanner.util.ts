import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DiscoveredPrinter } from '../../printer/interfaces/index.js';

const execFileAsync = promisify(execFile);

/** Lists CUPS destinations via `lpstat -e`. Returns `[]` on Windows or if CUPS isn't installed/running. */
export async function scanCupsPrinters(): Promise<DiscoveredPrinter[]> {
  if (process.platform === 'win32') {
    return [];
  }
  try {
    const { stdout } = await execFileAsync('lpstat', ['-e'], { timeout: 5000 });
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name, connection: 'CUPS', driver: 'cups' }));
  } catch {
    return [];
  }
}
