# AI Agent Guide

This file is for AI coding agents working in the Tengra repository. Human contributors should usually start with [README.md](../README.md) and [CONTRIBUTING.md](./CONTRIBUTING.md).

## First Steps

1. Read [MASTER_COMMANDMENTS.md](./MASTER_COMMANDMENTS.md) and [AI_RULES.md](./AI_RULES.md) before broad code changes.
2. Check [TODO.md](./TODO.md) for active and historical project notes.
3. Inspect the existing source before editing. Prefer local patterns over new abstractions.
4. Preserve user changes in the working tree. Do not revert unrelated edits.
5. Validate the touched area before handing work back.

## Current Stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Electron |
| Renderer | React 18, TypeScript, Tailwind CSS |
| Main process | Node.js and Electron APIs |
| Native runtime | Rust sidecar services under `src/native` |
| Local models | Ollama and local provider integrations |
| Editor/terminal | Monaco Editor and xterm.js |
| IPC | Context-isolated preload bridge with main-process handlers |

Go is not part of the active native runtime. The current managed binaries are `tengra-db-service`, `tengra-memory-service`, and `tengra-proxy`.

## Repository Map

```text
tengra/
├── src/
│   ├── main/        Electron main process, IPC handlers, services
│   ├── renderer/    React UI, feature modules, stores, hooks
│   ├── shared/      shared types, schemas, and utilities
│   ├── native/      Rust workspace for managed sidecar services
│   └── tests/       unit, integration, renderer, main, and e2e tests
├── resources/       packaged assets
├── public/          web assets copied by frontend tooling
├── scripts/         build, audit, release, and maintenance helpers
├── docs/            project documentation
├── build/           Electron packaging assets
└── .github/         CI and release automation
```

See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) and [ARCHITECTURE.md](./ARCHITECTURE.md) for the fuller map.

## Working Rules

- Use TypeScript strictly. Avoid `any`, `@ts-ignore`, and unchecked casts.
- Use existing loggers instead of `console.log`.
- Keep user-facing strings localizable.
- Validate untrusted renderer input before privileged main-process work.
- Keep IPC changes typed and domain-specific.
- Do not add new dependencies unless the benefit is clear and the package is maintained.
- Do not edit generated output unless the generated file is intentionally committed source.
- Keep docs in sync when changing commands, native binaries, release flow, or public setup instructions.

## IPC Guidance

Renderer code should call the preload bridge. It should not import Node APIs or access privileged resources directly.

Main-process handlers should:

- live near the relevant domain under `src/main/ipc`
- validate input before filesystem, process, network, or credential work
- return stable, typed results
- log failures with enough context to debug without leaking secrets

Common domains include window/process, auth/security, AI/model operations, workspace/tools, data, and settings.

## Native Runtime Guidance

The Rust workspace under `src/native` owns the bundled sidecar binaries:

- `db-service` builds `tengra-db-service`
- `memory-service` builds `tengra-memory-service`
- `proxy` builds `tengra-proxy`

Build and packaging coordination lives in `scripts/compile-native.js` and the Electron builder configuration. If native service names, paths, or startup behavior change, update [MANAGED_RUNTIME.md](./MANAGED_RUNTIME.md).

## Validation Commands

Use the narrowest reliable validation for small changes, and run the broader set before release or wide refactors.

```bash
npm run type-check
npm run lint
npm test
npm run build
npm run secrets:scan
npm run audit:deps:gate
```

For release preparation, also follow [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).

## Documentation Rules

- Keep root [README.md](../README.md) short.
- Put onboarding, architecture, and release detail in `docs/`.
- Update [docs/README.md](./README.md) when adding or removing documentation.
- Avoid documenting retired services as current behavior.
- Keep temporary notes out of `docs/`; use a scratch directory or an issue draft.

## Handoff Format

When finishing a task, report:

- what changed
- which files matter
- which validation commands ran and their results
- any remaining risks or follow-up items
