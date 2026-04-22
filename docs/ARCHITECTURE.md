# Architecture

Tengra is an Electron desktop application with a React renderer, an Electron main process, and Rust sidecar services. The design keeps the user interface isolated from direct operating system access while moving persistence, memory, and provider proxy work into explicit service boundaries.

## Process Model

```text
React renderer
  |
  | context-isolated preload bridge
  v
Electron main process
  |
  | service managers, IPC handlers, lifecycle orchestration
  v
Rust sidecar services and external tools
```

### Renderer

The renderer is the browser-facing React application. It owns UI state, routing, views, and feature-specific presentation code.

Key technologies:

- React 18 and TypeScript
- Tailwind CSS
- Monaco Editor
- xterm.js
- Zustand-style state stores where feature modules need shared UI state

The renderer should call the preload bridge. It should not import Node-only APIs or reach directly into the filesystem, child processes, secrets, or native services.

### Preload Bridge

The preload layer exposes a typed, allowlisted IPC surface to the renderer. It is the contract boundary between browser code and privileged main-process code.

Bridge changes should be treated as API changes:

- validate renderer-provided input before privileged work starts
- expose narrow domain methods instead of broad generic IPC escape hatches
- keep channel names stable unless the renderer and tests are updated together

### Main Process

The main process owns application lifecycle and privileged orchestration.

Primary responsibilities:

- window creation and lifecycle management
- IPC handler registration
- provider account and auth flow coordination
- database and repository access
- managed runtime startup
- terminal, Git, filesystem, and workspace operations
- tool, MCP, and model-provider orchestration
- logging, audit, backup, and health checks

### Utility and Background Work

Long-running or CPU-heavy work should not block the renderer. Existing background execution uses service managers, workers, or child/native processes depending on the task boundary. New background work should follow the nearest existing pattern in `src/main`.

## Runtime Services

Tengra currently manages three Rust sidecar binaries from `src/native`:

| Binary | Source crate | Responsibility |
| --- | --- | --- |
| `tengra-db-service` | `db-service` | SQLite-backed persistence service |
| `tengra-memory-service` | `memory-service` | long-term memory and retrieval support |
| `tengra-proxy` | `proxy` | local provider-compatible proxy and request routing |

These are built by `scripts/compile-native.js` and bundled through the Electron build. Go is not part of the active native runtime.

External tools such as Ollama, Git, shells, and MCP servers are integrations, not bundled Tengra microservices.

## IPC Domains

IPC is organized by domain. Exact handler names live in `src/main/ipc` and the preload bridge.

| Domain | Typical scope |
| --- | --- |
| Window and process | window controls, app lifecycle, health |
| Auth and security | OAuth, linked accounts, key rotation, audit |
| AI and models | chat, provider routing, Ollama, local model metadata |
| Workspace and tools | workspaces, Git, terminal, SSH, filesystem access |
| Data | database, backups, memories, files |
| UI settings | preferences, themes, clipboard-safe helpers |

When adding IPC, prefer a domain-specific handler and a typed bridge method over a generic command channel.

## Source Layout

```text
tengra/
├── src/
│   ├── main/          Electron main process
│   ├── renderer/      React application
│   ├── shared/        shared types, schemas, utilities
│   ├── native/        Rust workspace for sidecar services
│   └── tests/         unit, integration, renderer, main, and e2e tests
├── resources/         packaged assets
├── public/            web assets copied by Vite/Electron tooling
├── scripts/           build, audit, maintenance, and release helpers
├── docs/              maintainer and user documentation
├── build/             Electron packaging assets
└── .github/           CI and release automation
```

Generated output such as `dist`, `dist-electron`, `release`, coverage reports, runtime logs, and copied Monaco assets should not be treated as source documentation.

## Main-Process Organization

The main process is split by responsibility:

- `ipc/`: privileged APIs exposed to the preload bridge
- `services/`: domain services and orchestration logic
- `repositories/`: persistence access patterns
- `startup/`: startup gates and initialization flow
- `runtime/` and native managers: managed sidecar lifecycle
- `logging/`: logs, diagnostics, and rotation

New code should stay close to the domain it changes. Avoid creating broad cross-domain helpers unless the same behavior is already shared in several places.

## Renderer Organization

The renderer groups product behavior under feature modules, shared UI components, hooks, contexts, and stores.

Feature code should own feature-specific UI and state. Shared components should stay generic and avoid importing domain services directly.

## Data Domains

The storage layer is split by product domain rather than by screen.

Core domains include:

- chats, messages, folders, and conversation metadata
- linked accounts, provider credentials, and auth state
- workspaces, workspace files, Git state, and terminal sessions
- long-term memories, semantic fragments, and code intelligence data
- token usage, audit logs, backups, and operational metadata

Schema and repository changes should be paired with tests that cover migration behavior and the relevant IPC/service contract.

## Design Patterns

Tengra uses a few recurring patterns:

- service managers for lifecycle-heavy dependencies
- repository classes for data access
- typed IPC contracts for renderer-to-main calls
- event-driven coordination where direct coupling would create startup or teardown hazards
- lazy initialization for expensive services that are not required at first paint
- circuit-breaker and retry logic around unreliable external providers

Prefer extending an existing pattern in the same area before introducing a new abstraction.

## Release-Relevant Checks

Before release, the architecture-sensitive checks are:

```bash
npm run type-check
npm run lint
npm test
npm run build
npm run secrets:scan
npm run audit:deps:gate
```

Use `docs/RELEASE_CHECKLIST.md` for the full release flow.
