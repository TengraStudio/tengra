# Managed Runtime Architecture

## Canonical Rule

Tengra uses one managed runtime root for both development and packaged builds.

- Development mode does not execute binaries from `resources/bin`.
- Packaged builds do not bundle `resources/bin`.
- Native build outputs seed the managed runtime directory instead of acting as a runtime source.

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

- `scripts/build-native.js` copies native build outputs into the managed runtime `bin` directory.
- Windows helper scripts resolve binaries from the managed runtime `bin` directory.
- `package.json` no longer includes `resources/bin` in `extraResources`.

This means a local build or release build prepares the same runtime destination that the app will use at execution time.

## External Dependencies

Not managed as bundled Tengra runtimes:

- `Ollama`
- OS-level libraries and toolchains required to build native services locally
- Platform-specific runtime prerequisites such as system redistributables where applicable

These dependencies need explicit detection and user-consent flows in the upcoming bootstrap layer.

## Remaining Gaps

- Define GitHub release artifact naming and manifest schema
- Add download, checksum, extraction, and repair orchestration
- Add runtime health probes before dependent services launch
- Standardize external dependency handling, especially `Ollama`
- Add update and repair workflows for installed runtimes

## Contributor Rules

- New native runtime binaries must be added to the managed runtime contract, not `resources/bin`.
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

## Bootstrap Planning

`RuntimeBootstrapService` currently owns the install-plan phase only.

Current responsibilities:

- validate/parse a runtime manifest
- normalize current `platform` and `arch`
- select the matching artifact target
- resolve the expected managed-runtime install path
- classify each component as `ready`, `install`, `external`, or `unsupported`

Download, extraction, checksum enforcement, and repair execution are the next layer on top of this planner.
