# Contributing to Tengra

This guide covers the development workflow for contributors. For architecture context, read [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) and [ARCHITECTURE.md](./ARCHITECTURE.md) after the setup section.

## Prerequisites

- Node.js 20 or newer.
- npm matching the installed Node.js version.
- Rust stable toolchain with Cargo.
- Platform build tools:
  - Windows: Visual Studio Build Tools with C++ workload.
  - macOS: Xcode Command Line Tools.
  - Linux: GCC/Clang plus common native build dependencies.
- Optional external tools for runtime features: Ollama, Git, Docker, SSH client, and supported terminal emulators.

Go is not required for the current native runtime. The active native services are Rust crates under `src/native`.

## Setup

```bash
git clone https://github.com/TengraStudio/tengra.git
cd tengra
npm install
npm run dev
```

Useful one-time environment check:

```bash
npm run setup-build-env
```

## Development Workflow

1. Keep changes scoped to the feature or fix.
2. Prefer existing services, schemas, stores, and IPC helpers over adding parallel patterns.
3. Add or update tests when changing behavior.
4. Do not commit generated build output from `dist/`, `release/`, `node_modules/`, or managed runtime binaries.
5. Keep provider credentials, personal tokens, local paths, and machine-specific artifacts out of documentation and tests unless they are intentional public test/static configuration.

## Verification

Run the narrowest relevant check while iterating, then run the broader checks before release or PR review.

```bash
npm run type-check
npm test
npm run lint
npm run secrets:scan
npm run audit:deps:gate
npm run build
```

Notes:

- `npm run lint` may print existing warnings, but should exit successfully.
- `npm run build` skips strict lint and bundle budget in normal local mode. CI and release workflows can enforce stricter gates.
- `npm run secrets:scan` scans tracked text files and intentionally avoids generated/binary output.

## Native Services

Native services are built from `src/native`:

- `tengra-db-service`
- `tengra-memory-service`
- `tengra-proxy`

`scripts/compile-native.js` builds the Rust workspace and copies binaries into the managed runtime bin directory. It skips the Rust rebuild when native sources are unchanged and existing release outputs are current.

## Code Standards

- Use TypeScript types deliberately. Avoid `any`; use concrete types or shared schema-derived types.
- Do not suppress TypeScript or ESLint errors to pass checks. Fix the cause.
- Use project logging utilities instead of raw `console.log` in application code.
- Keep renderer code free of direct Node.js access; go through preload/IPC contracts.
- Validate IPC payloads with existing schema patterns.
- Keep UI copy localizable and avoid hardcoded user-facing strings where the surrounding feature uses `t()`.
- Keep large lists virtualized and clean up subscriptions, processes, timers, and event listeners.

## Pull Request Checklist

- The change has a clear description and scope.
- Relevant tests were added or updated.
- `npm run type-check` passes.
- Relevant test suite passes.
- `npm run lint` passes.
- Security-sensitive changes mention risk and mitigation.
- Documentation is updated when behavior, setup, architecture, or public commands change.

## Release Work

For release preparation, use [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md). For runtime packaging details, use [MANAGED_RUNTIME.md](./MANAGED_RUNTIME.md).
