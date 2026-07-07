export type SupportedPlatform = 'windows' | 'linux' | 'macos';

export type InstallAction = 'install' | 'upgrade' | 'repair' | 'uninstall';

export interface InstallOptions {
  /** Absolute path the application is installed into (equivalent to PROJECT_ROOT at runtime). */
  installDir: string;
  serviceName: string;
  startAutomatically: boolean;
  desktopShortcut: boolean;
  launchAfterInstall: boolean;
  /** Silent mode reads everything from flags/defaults; interactive mode prompts for anything unset. */
  silent: boolean;
  /** Developer mode (Step 17) — skip service registration, use dev config, verbose logging. */
  dev: boolean;
  /** `--purge` for uninstall: also remove config/database/logs instead of preserving them. */
  purge?: boolean | undefined;
}

export interface ValidationIssue {
  check: string;
  severity: 'fatal' | 'warning';
  message: string;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  ok: boolean;
}

export interface VersionManifest {
  installedVersion: string;
  schemaVersion: number;
  configVersion: number;
  migrationVersion: string | null;
  buildNumber: string;
  installedAt: string;
  updatedAt: string;
}

/**
 * Every platform (windows/linux/macos) implements this the same way, so `scripts/install.ts`,
 * `scripts/uninstall.ts`, and `scripts/cli.ts` (Step 11 — consistent CLI across platforms) can
 * dispatch on `process.platform` once and otherwise stay platform-agnostic.
 */
export interface PlatformInstaller {
  readonly platform: SupportedPlatform;
  registerService(options: InstallOptions): Promise<void>;
  unregisterService(options: InstallOptions): Promise<void>;
  startService(options: InstallOptions): Promise<void>;
  stopService(options: InstallOptions): Promise<void>;
  restartService(options: InstallOptions): Promise<void>;
  serviceStatus(options: InstallOptions): Promise<string>;
}

export interface BackupManifest {
  id: string;
  createdAt: string;
  reason: 'upgrade' | 'repair' | 'manual';
  fromVersion: string | null;
  files: string[];
}
