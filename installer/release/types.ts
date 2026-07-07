export type ReleasePlatform = 'windows' | 'linux' | 'macos';

export interface VersionInfo {
  version: string;
  buildNumber: string;
  gitCommit: string | null;
  buildDate: string;
  platform: NodeJS.Platform;
  arch: string;
}

export interface ExecutableArtifact {
  /** Absolute path to the produced launcher (or, if staging-only, where it *would* be). */
  path: string;
  /** False when the tool needed to produce a real binary wasn't available and only source/staging was written. */
  built: boolean;
  kind: 'shell-launcher' | 'native-launcher' | 'staged-source';
}

export interface RuntimePackage {
  /** The staged directory — shaped so it can be handed unmodified to the existing deb/rpm/AppImage builders as `projectRoot`. */
  dir: string;
  executable: ExecutableArtifact;
}

export interface ReleaseArtifact {
  name: string;
  path: string;
  platform: ReleasePlatform | 'portable';
  sizeBytes: number;
  sha256: string;
  sha512: string;
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface VerificationReport {
  platform: ReleasePlatform;
  checks: VerificationCheck[];
  passed: boolean;
}

export interface UpgradeVerificationReport {
  fromVersion: string;
  toVersion: string;
  checks: VerificationCheck[];
  passed: boolean;
}

export interface ReleaseManifest {
  version: VersionInfo;
  generatedAt: string;
  supportedPlatforms: ReleasePlatform[];
  artifacts: ReleaseArtifact[];
  verification: VerificationReport[];
}

export interface PipelineStageResult {
  stage: string;
  durationMs: number;
  success: boolean;
  error?: string | undefined;
}

export interface ReleaseOptions {
  /** Skip the (slow) discovery-scan-dependent verification launch, e.g. in a sandboxed CI runner with no printers. */
  skipVerification?: boolean | undefined;
  /** Skip upgrade verification (Step 12) — requires network/time to install a "previous" build first. */
  skipUpgradeVerification?: boolean | undefined;
  /** Only build for the current host platform's Linux/Windows/macOS artifacts, skipping the others entirely. */
  currentPlatformOnly?: boolean | undefined;
}
