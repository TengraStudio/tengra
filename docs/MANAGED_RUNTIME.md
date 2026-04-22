# Managed Runtime

Tengra uses a managed runtime directory for native binaries and runtime-owned assets. Development and packaged builds use the same path contract so first-run checks, repair flows, and service startup behave consistently.

## Runtime Root

The runtime root is `Tengra/runtime` under the platform app-data directory.

| OS | Base Directory | Runtime Root |
| --- | --- | --- |
| Windows | `%APPDATA%` | `%APPDATA%/Tengra/runtime` |
| macOS | `~/Library/Application Support` | `~/Library/Application Support/Tengra/runtime` |
| Linux | Electron appData, usually `~/.config` | `~/.config/Tengra/runtime` |

Subdirectories:

| Directory | Purpose |
| --- | --- |
| `bin` | managed native executables |
| `models` | model files owned by managed runtimes |
| `temp` | temporary downloads, generated files, extraction work |
| `downloads` | staged assets before install/extract |
| `manifests` | cached runtime manifest snapshots |

## Managed Binaries

Current Rust binaries built from `src/native`:

- `tengra-db-service`
- `tengra-memory-service`
- `tengra-proxy`

Windows builds use `.exe` suffixes.

The Rust workspace is:

```text
src/native/
├── db-service/
├── memory-service/
└── tengra-proxy/
```

## External Dependencies

These are detected and used but are not bundled as Tengra-managed binaries:

- Ollama
- SD-CPP runtime where configured
- terminal emulators such as Ghostty, Alacritty, Warp, and Kitty
- OS toolchains needed to build native services locally

Missing external dependencies should surface install or start guidance instead of failing silently.

## Build Flow

`npm run build` calls `scripts/build-all.js`, which runs `scripts/compile-native.js`.

Native build behavior:

1. Compute a stamp from Rust source files.
2. Skip `cargo build --release` when native sources are unchanged and release outputs are present.
3. Build the Rust workspace when needed.
4. Copy `tengra-*` binaries into the managed runtime `bin` directory.
5. Keep existing binaries if a local Windows process lock prevents copy and local locked-skip policy allows it.

The managed runtime is intentionally outside `resources/bin`; packaged builds should not rely on legacy source-tree binary paths.

## Startup Lifecycle

`RuntimeBootstrapService` has two phases:

### Scan

`scanManagedRuntime()` runs during startup and does not auto-install missing binaries before the renderer can show the runtime gate.

It:

1. Resolves the runtime manifest.
2. Uses a cached manifest when network access fails.
3. Builds a platform/architecture install plan.
4. Marks missing required components as `install-required`.
5. Runs health checks.
6. Stores the latest status for startup gating and renderer UI.

### Repair

`ensureManagedRuntime()` performs install/update work after explicit user action.

It:

1. Downloads missing or updated managed artifacts.
2. Verifies SHA-256 checksums.
3. Copies raw binaries or extracts archives.
4. Marks `bin` targets executable on non-Windows platforms.
5. Deletes staged downloads after success.
6. Re-runs health checks.

Renderer IPC hooks:

- `runtime:get-status`
- `runtime:refresh-status`
- `runtime:repair`

## Startup Gates

Startup gates prevent known-broken native services from launching.

Current required component mapping:

| Service Area | Runtime Component |
| --- | --- |
| Database | `tengra-db-service` |
| Embedded proxy | `tengra-proxy` |

When a required component is missing or unhealthy, the runtime boundary blocks the main app and shows repair actions.

## Operational Notes

- Close Tengra before rebuilding native binaries on Windows if files are locked.
- Do not commit managed runtime binaries or `src/native/target`.
- Do not refer to legacy `cliproxy-embed`, `token-service`, `quota-service`, or `model-service` as current runtime binaries.
