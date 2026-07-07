# Release & Packaging

`npm run release` turns the existing installer tooling (`installer/{common,windows,linux,macos,
scripts,templates}`) into shippable, platform-native artifacts — one command, no manual steps.
This phase adds `installer/release/` on top of that existing tree; nothing in `installer/windows`,
`installer/linux`, `installer/macos`, `installer/common`, or `installer/scripts` was redesigned,
only additively extended (icon/desktop-file generation, an `extraFiles` parameter, an NSIS
generator alongside the existing service-file generators).

## Module layout

```
installer/release/
  types.ts                 ReleasePlatform, VersionInfo, artifacts, verification/manifest shapes
  version.ts                resolveVersionInfo() — package.json version + git commit + build number
  executable-packager.ts    bundles dist/ into a standalone executable (Step 3)
  runtime-packager.ts       assembles the full runtime payload around that executable (Step 4)
  release-folder.ts         creates release/<version>/{windows,linux,macos,portable,checksums,manifest,logs}/
  checksums.ts              SHA256 + SHA512 for every artifact
  release-manifest.ts       release-manifest.json (Step 10)
  portable-packager.ts      UniversalPrintAgent-Portable-<version>.zip (Step 13)
  verification.ts           boots the packaged executable and checks it actually works (Step 11)
  upgrade-verification.ts   installs, mutates state, re-installs, checks state survived (Step 12)
  release-logger.ts         build.log / installer.log / verification.log / release.log (Step 15)
  error-recovery.ts         backup-and-rollback + temp cleanup + actionable failure messages (Step 16)
  release-manager.ts        orchestrates all of the above into one pipeline
  index.ts                  barrel export

installer/scripts/release.ts   CLI entry point — `npm run release`
```

## Pipeline stages

`ReleaseManager.run()` (`installer/release/release-manager.ts`) executes, in order:

1. **Clean** — removes `release/<version>/_staging` and `temp/` leftovers from a prior run.
2. **Compile TypeScript** — `tsc` (the existing `npm run build`).
3. **Build Print Agent** — a no-op placeholder stage kept distinct from "Compile TypeScript" so
   CI logs and `release-manifest.json` can attribute time/failures precisely; reserved for any
   future asset-generation step (e.g. bundling default print templates) that isn't just `tsc`.
4. **Generate Executable** — `executable-packager.ts` bundles `dist/index.js` into one CommonJS
   file with esbuild, then `runtime-packager.ts` wraps it with `node_modules` (pruned to
   production-only), a private copy of the Node runtime, config templates, license, and a
   version manifest — see [Packaging architecture](#packaging-architecture) below.
5. **Generate Installers** — calls the existing `installer/windows` and `installer/linux`
   builders to produce the Setup.exe / .deb / .rpm / .AppImage.
6. **Portable Package** — zips the staged runtime payload with no installer/service wrapper.
7. **Verification** — actually launches the packaged executable and exercises it.
8. **Upgrade Verification** — installs, mutates state, re-installs, confirms state survived.
9. **Generate Build Manifest** — writes `release-manifest.json` with checksums for everything.

Each stage runs through a private `runStage()` helper that times it, logs start/failure/success,
and — on failure — calls `describeFailure()` (`error-recovery.ts`) for a stage-specific actionable
message instead of a raw stack trace. If any stage throws, `error-recovery.ts`'s backup (taken
before the pipeline starts) is restored and the partial `release/<version>` directory is discarded;
on success the backup is deleted and `temp/` is swept clean.

## Packaging architecture

**Why not Node's Single Executable Applications (SEA):** evaluated and rejected. SEA's embedded
entry point restricts `require()` to Node builtins and blob-embedded assets only — verified
empirically, not just from docs — which makes it incompatible with this app's native addons
(`better-sqlite3`, `usb`).

**What's used instead:** `executable-packager.ts` bundles first-party `dist/` code into a single
CommonJS file with esbuild (`--bundle --platform=node --format=cjs --packages=external`).
`--packages=external` keeps every npm dependency — native and pure-JS alike — as a real file in
`node_modules`, so native addons load normally and no third-party package's own asset-resolution
logic (e.g. `@fastify/swagger-ui`'s `import.meta.url`-based static file paths) gets disturbed.

That bundle ships next to a private copy of the Node runtime and a tiny launcher (a shell script
on Linux/macOS, a small `CreateProcessA`-based C program compiled with mingw-w64 on Windows),
so the packaged app genuinely does not require Node.js to be installed on the target machine —
`UniversalPrintAgent`/`UniversalPrintAgent.exe` launches the bundled runtime itself.

This strategy sits behind the `ExecutablePackager` interface (`{strategy, package(input)}`)
specifically so a better tool in the future (a maintained `pkg` fork, improved SEA with real
native-addon support) can replace only `executable-packager.ts` — no other file in the pipeline
or in `installer/windows`/`installer/linux` needs to know how the executable was produced.

**`import.meta.url` shim caveat:** `src/utils/paths.util.ts` (unmodified — a deliberate choice to
avoid touching application source) derives `PROJECT_ROOT` as "two directories above this file",
which is true for `dist/utils/paths.util.js` but breaks once esbuild flattens everything into one
file with no directory nesting. `bundleToCommonJs()` works around this entirely inside the
packaging layer: it shims `import.meta.url` to a *fictional* path two levels under the bundle's
real directory, so `paths.util.ts`'s "go up two" arithmetic still lands back on the real runtime
directory. Verified by confirming `storage/`, `logs/`, and `temp/` are created inside the packaged
runtime directory, not two levels above it.

## Runtime package contents

`runtime-packager.ts` stages, per platform, only what a shipped app needs:

- the bundled executable + launcher
- pruned `node_modules` (`npm prune --omit=dev` run against a *copy*, never the dev tree)
- `config-templates/config.default.json`
- `LICENSE`, `README.md`
- `version.json`

A `NEVER_PACKAGE` guard (`src`, `tests`, `installer`, `.git`, `tsconfig.json`,
`installer/tsconfig.json`) throws if any of those end up in the staging directory, so a future
change to the packaging steps can't accidentally ship source or test files.

## Versioning

`version.ts`'s `resolveVersionInfo()` reads the app version from `package.json`, the commit from
`git rev-parse --short HEAD`, and the build number from `BUILD_NUMBER`/`GITHUB_RUN_NUMBER` (CI) or
a timestamp fallback (local). This feeds both `version.json` (shipped inside every runtime
package) and `release-manifest.json`.

## Release folder layout

```
release/<version>/
  windows/     UniversalPrintAgentSetup.exe (or staged NSIS script + payload if makensis is absent)
  linux/       universal-print-agent_<version>_amd64.deb, .rpm sources, AppImage AppDir
  macos/       (staged only — not a required output of this phase, unbuildable/unverifiable on Linux)
  portable/    UniversalPrintAgent-Portable-<version>.zip
  checksums/   <artifact>.sha256 / <artifact>.sha512 for every artifact above
  manifest/    release-manifest.json
  logs/        build.log, installer.log, verification.log, release.log
  version.json
```

## Release manifest

`release-manifest.ts` writes `release-manifest.json` containing, for every artifact: platform,
filename, size in bytes, SHA256 and SHA512 checksums, plus the resolved `VersionInfo`, a generated
timestamp, and the de-duplicated list of platforms actually produced in that run.

## Verification

`verification.ts` boots the packaged executable for real (not the source tree) and checks:
executable launches, port 3210 becomes reachable, the REST API responds, `/api/v1/health` reports
healthy, and the process exits cleanly on `SIGTERM`. `verifyServiceLifecycle()` additionally
registers/starts/stops a real OS service when running as root or in CI (`CI=true`); otherwise it
records a passed-but-skipped check, since real service registration requires privileges this
sandbox doesn't have.

`upgrade-verification.ts` exercises the existing installer's upgrade path end to end in a
disposable directory: fresh install with a real one-time launch (so `ConfigService` actually
creates `config.json`/the database, the way a genuine first boot does — the installer itself only
creates directories, never `config.json`), stop it, mutate the config with a marker, re-install
over the same directory as the "upgrade," and confirm config, database, printer profiles (via the
database + a pre-upgrade backup), and logs all survived.

## Running it

```
npm run release                        # full pipeline, all platforms this host can build
npm run release -- --skip-verification
npm run release -- --skip-upgrade-verification
```

CI-friendly by design (Step 17): no prompts, deterministic non-zero exit code on failure, and the
existing `installer/*` and `installer/release/*` modules have no environment-specific paths beyond
what `REPO_ROOT`/`commandExists()` already resolve — a GitHub Actions workflow can call
`npm run release` directly with no changes to this code.

**Tool-availability note:** `rpmbuild`, `appimagetool`, `makensis`, and `mingw-w64` are optional
on the host. When one is missing, the corresponding stage never fabricates a fake artifact — it
stages every source/config file needed and logs the exact command to finish the build on a machine
that has the tool (e.g. `rpmbuild --define ... -bb <spec>`, `appimagetool <AppDir>`,
`makensis <script.nsi>`). On a host with all four tools installed, the same pipeline produces
every required artifact with no code changes.
