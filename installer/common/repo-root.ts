import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const currentDir = dirname(fileURLToPath(import.meta.url));

/** This checkout's own root — where the installer itself is running from, not necessarily the install target. */
export const REPO_ROOT = join(currentDir, '..', '..');
