# Managed Runtime Architecture

## Canonical Rule

Tengra uses one managed runtime root for both development and packaged builds.

- Development mode no longer uses legacy source-tree binary paths.
- Packaged builds do not include or reference `resources/bin`.
- Native build outputs seed the managed runtime directory directly.

## Managed Runtime Root

The managed runtime root is `Tengra/runtime` under the platform app-data directory.

| OS | Base directory | Runtime root |
| --- | --- | --- |
| Windows | `%APPDATA%` | `%APPDATA%/Tengra/runtime` |
| macOS | `~/Library/Application Support` | `~/Library/Application Support/Tengra/runtime` |
| Linux | Electron `appData` (`~/.config` by default) | `~/.config/Tengra/runtime` |

Current subdirectories:

- `bin`: native executables used by Tengra
- `models`: model files owned by Tengra-managed runtimes
- `temp`: temporary downloads, generated images, extraction work
- `downloads`: staged release assets prior to install/extract
- `manifests`: cached runtime manifest snapshots used for offline/fallback repair flows

## Current Binary Ownership

Managed by Tengra and expected under `runtime/bin`:

- `tengra-db-service`
- `tengra-token-service`
- `tengra-model-service`
- `tengra-quota-service`
- `tengra-memory-service`
- `cliproxy-embed`
- `llama-server`

Managed runtime consumers already wired to the central path contract:

- `ProcessManagerService`
- `ProxyProcessManager`
- `LlamaService`
- `LocalAIService`
- `LocalImageService`
- `LocalImageSDCppManager`
- `Local image providers` temp-output flow

## Build and Packaging Policy

- `scripts/compile-native.js` and `scripts/compile-native.ps1` copy native build outputs directly into the managed runtime `bin` directory.
- Windows helper scripts resolve binaries from the managed runtime `bin` directory.
- `package.json` does not include `resources/bin` in `extraResources` as it has been decommissioned.

This means a local build or release build prepares the same runtime destination that the app will use at execution time.

## External Dependencies

Not managed as bundled Tengra runtimes:

- `Ollama`
- OS-level libraries and toolchains required to build native services locally
- Platform-specific runtime prerequisites such as system redistributables where applicable

Current external dependency policy:

- managed Tengra binaries are downloaded and installed by Tengra into the managed runtime root
- external dependencies are detected, never copied into `runtime/bin`
- missing external dependencies surface install guidance instead of silent failure
- installed-but-stopped external dependencies surface an explicit start action

Current probe coverage:

- `Ollama`
  - Windows: `PATH` plus `%LOCALAPPDATA%/Programs/Ollama/ollama.exe`
  - macOS: `/Applications/Ollama.app/Contents/MacOS/Ollama`, `/usr/local/bin/ollama`, `/opt/homebrew/bin/ollama`
  - Linux: `/usr/local/bin/ollama`, `/usr/bin/ollama`, `/snap/bin/ollama`
  - runtime check: `http://127.0.0.1:11434/api/tags`

## Runtime Bootstrap Lifecycle

`RuntimeBootstrapService` now uses a two-phase lifecycle:

1. `scanManagedRuntime()`
2. `ensureManagedRuntime()`

### Scan Phase

Main-process startup performs a scan only. It does not auto-install binaries before the renderer has a chance to gate the app.

`scanManagedRuntime()` does the following:

1. Resolve the runtime manifest URL
2. Download the manifest over `https`
3. Cache the manifest under `runtime/manifests/runtime-manifest.json`
4. Fall back to the cached manifest if the network fetch fails
5. Build a platform/arch-specific install plan
6. Mark missing managed components as `install-required`
7. Run health checks across managed and external components
8. Store the latest runtime status for startup gating and renderer UI

### Repair / Install Phase

Renderer-driven repair performs the actual install/update flow after explicit user action.

`ensureManagedRuntime()` does the following:

1. Re-resolve and validate the manifest
2. Download missing or updated managed artifacts into `runtime/downloads`
3. Verify SHA-256 before install
4. Copy raw binaries or extract archives into the managed runtime root
5. Mark installed `bin` targets executable on non-Windows platforms
6. Delete staged downloads after successful install
7. Re-run health checks and publish the updated runtime status

Current IPC hooks:

- `runtime:get-status`
- `runtime:refresh-status`
- `runtime:repair`

These back both first-run launch gating and post-install repair/update actions without requiring a separate installer.

## First-Run UX

The renderer now owns the first-run bootstrap boundary:

- `RuntimeBootstrapBoundary` mounts before auth/theme/model/workspace/chat providers
- blocking managed runtime issues keep the main app from rendering
- the boundary shows the managed runtime status panel
- the user can refresh status, repair managed components, open an external install URL, or start supported external dependencies such as `Ollama`
- once required components become healthy, the boundary releases the rest of the app

The same status panel is also exposed in Developer settings as a repair/update maintenance surface.

Startup gating now consumes the bootstrap health result before launching native daemons:

- `databaseService.initialize()` is skipped when `tengra-db-service` is not `ready` or `external`
- `proxyService.startEmbeddedProxy()` is skipped when `cliproxy-embed` is not `ready` or `external`

This keeps startup from launching known-broken managed runtimes and turns health classification into an actual launch gate instead of a passive report.

## Runtime Health

`RuntimeHealthService` currently validates:

- file existence for managed components
- executable permission/readiness for `bin` targets
- external dependency detection, running state, and recommended action (`install`, `start`, `none`)
- unsupported targets as first-class health outcomes
- per-component health messages suitable for startup gating and renderer maintenance UI

Current health/action semantics:

- managed missing binary: `missing`
- managed non-executable binary: `not-executable`
- managed healthy binary: `ready`
- external dependency: `external` plus `detected`, `running`, and `action`
- unsupported platform/arch: `unsupported`

## Contributor Rules

- New native runtime binaries must be added to the managed runtime contract.
- Services must resolve executable paths through the central runtime path layer.
- Temp runtime artifacts must live under `runtime/temp` unless a stricter location is required and documented.
- Build and packaging changes must preserve the one-runtime-root rule across dev and packaged modes.

## Manifest Specification

Shared schema/type sources:

- `src/shared/constants/runtime-manifest.ts`
- `src/shared/types/runtime-manifest.ts`
- `src/shared/schemas/runtime-manifest.schema.ts`

Current manifest contract:

- top-level `schemaVersion`
- top-level `releaseTag`
- top-level `generatedAt`
- `components[]` with `id`, `displayName`, `version`, `kind`, `source`, `requirement`
- per-target `platform`, `arch`, `assetName`, `downloadUrl`, `archiveFormat`, `sha256`, `executableRelativePath`, `installSubdirectory`

Rules:

- managed components must declare at least one target
- download URLs must use `https`
- `sha256` must be a 64-char hex digest
- executable paths must be safe relative paths

Recommended artifact naming:

- `<component-id>-<platform>-<arch>.<ext>`
- `tengra-db-service-win32-x64.zip`
- `llama-server-darwin-arm64.tar.gz`
- `cliproxy-embed-linux-x64.tar.gz`

## Update And Repair Policy

Current runtime update model:

- the manifest `releaseTag` is the runtime version registry exposed through runtime status
- `runtime:repair` acts as both repair and update because it re-evaluates the manifest and installs the latest matching assets
- staged downloads are removed after a successful install
- cached manifests allow offline refresh/repair attempts when the network manifest is temporarily unavailable

Rollback boundary:

- automatic rollback is intentionally not performed inside the app
- manual rollback is supported by invoking `runtime:repair` with a pinned older manifest URL
- checksum validation remains mandatory for rollback artifacts as well

## Release Runbook

When publishing new managed runtime artifacts:

1. Build each native runtime for supported `platform/arch` combinations
2. Publish archives/raw assets using the canonical naming contract
3. Generate `runtime-manifest.json` with SHA-256 values and release metadata
4. Upload the manifest alongside the artifacts
5. Verify that `runtime:refresh-status` resolves the new manifest in a packaged app
6. Verify that a repair run installs the new binaries into the managed runtime root

## Troubleshooting

- `runtime:get-status` returns `null`
  - startup could not complete the scan and no cached manifest was available
- component shows `install-required`
  - the binary is expected for this machine but is not currently installed under the managed runtime root
- component shows `external` with action `install`
  - Tengra detected that the dependency is missing and can only guide the user to install it
- component shows `external` with action `start`
  - the dependency is installed but not currently running
- DB or embedded proxy does not start on launch
  - startup gating intentionally skipped it because runtime health was not ready
