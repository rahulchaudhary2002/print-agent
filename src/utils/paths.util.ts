import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Resolves paths relative to this file's location so they are correct both
// when run from source (src/utils) and from the compiled output (dist/utils) —
// both sit exactly two directories below the project root.
const currentDir = dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = join(currentDir, '..', '..');
export const STORAGE_DIR = join(PROJECT_ROOT, 'storage');
export const LOGS_DIR = join(PROJECT_ROOT, 'logs');
export const TEMP_DIR = join(PROJECT_ROOT, 'temp');
export const CONFIG_FILE_PATH = join(STORAGE_DIR, 'config.json');
export const DATABASE_FILE_PATH = join(STORAGE_DIR, 'print-agent.db');
export const MACHINE_IDENTITY_FILE_PATH = join(STORAGE_DIR, 'machine-identity.json');
export const CLOUD_CREDENTIALS_FILE_PATH = join(STORAGE_DIR, 'cloud-credentials.json');
export const CLOUD_CONFIG_FILE_PATH = join(STORAGE_DIR, 'cloud-config.json');

// Service management (Step 17 — runtime/process state, distinct from user configuration).
export const PID_FILE_PATH = join(STORAGE_DIR, 'print-agent.pid');
export const CRASH_MARKER_FILE_PATH = join(STORAGE_DIR, 'crash.marker');

// Installer/packaging runtime layout — reserved for future use by the app itself; today the
// installer is the only thing that creates and writes to these (backups during upgrades).
export const CACHE_DIR = join(STORAGE_DIR, 'cache');
export const CRASH_DUMPS_DIR = join(STORAGE_DIR, 'crash-dumps');
export const BACKUPS_DIR = join(STORAGE_DIR, 'backups');
export const VERSION_MANIFEST_FILE_PATH = join(STORAGE_DIR, 'version.json');
