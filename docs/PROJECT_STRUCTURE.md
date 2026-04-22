# Project Structure

Tengra is an Electron application with a React renderer, a Node/Electron main process, shared TypeScript contracts, and Rust native services.

## Repository Map

```text
tengra/
├── src/
│   ├── main/             # Electron main process, services, IPC, startup
│   ├── renderer/         # React UI, feature modules, stores, hooks
│   ├── shared/           # Cross-process types, schemas, constants, pure utilities
│   ├── native/           # Rust workspace: db-service, memory-service, tengra-proxy
│   └── tests/            # Main, renderer, shared, startup, and integration tests
├── docs/                 # Project documentation
├── resources/            # Static assets and runtime-adjacent resources
├── public/               # Public renderer assets copied/served by Vite
├── scripts/              # Build, verification, audit, and maintenance scripts
├── build/                # Electron Builder support files
├── .github/              # CI, release, and repository automation
├── package.json          # npm scripts, dependencies, Electron Builder config
└── vite.config.ts        # Vite/Electron build config
```

Generated output and local state are intentionally excluded from source control:

- `dist/`
- `release/`
- `node_modules/`
- `logs/`
- `src/native/target/`
- local managed runtime binaries

## Main Process

`src/main` is the application backend. It owns OS access, service lifecycle, native process startup, secure storage, IPC handlers, and external provider orchestration.

```text
src/main/
├── main.ts                 # Electron entry point
├── preload.ts              # Preload bridge composition
├── api/                    # Local API server
├── core/                   # Container, registry, circuit breaker, service infra
├── ipc/                    # Domain IPC handlers
├── logging/                # Main-process logger
├── mcp/                    # MCP/plugin dispatch and native plugin bridge
├── preload/domains/        # Renderer-exposed bridge domains
├── repositories/           # Smaller legacy repositories
├── services/               # Domain services
├── startup/                # Startup lifecycle, services, windows, runtime gates
├── tools/                  # Built-in tool definitions and executor
└── utils/                  # Main-process utilities
```

Important service domains:

| Folder | Purpose |
| --- | --- |
| `services/data` | Database, filesystem, backup, repositories |
| `services/llm` | LLM providers, local image, memory, model flows |
| `services/proxy` | Native proxy process integration |
| `services/security` | Auth, encryption, token/account handling |
| `services/system` | Command/process/runtime/bootstrap/system health |
| `services/workspace` | Workspace, terminal, SSH, Git, Docker, LSP |
| `services/ui` and `services/theme` | UI-facing settings/theme services |

## Renderer Process

`src/renderer` is the React UI. It must use the preload bridge for privileged operations.

```text
src/renderer/
├── main.tsx
├── App.tsx
├── assets/
├── components/            # Reusable layout/shared/ui components
├── context/               # React providers
├── electron-api/          # Renderer API type domains
├── features/              # Product feature modules
├── hooks/                 # Cross-feature hooks
├── i18n/                  # Locale registry and locale files
├── lib/                   # Renderer libraries and IPC client helpers
├── store/                 # External stores and UI state
├── themes/                # Theme registry and manifests
├── utils/                 # Renderer utilities
└── views/                 # View loading/routing layer
```

Current feature modules include:

| Feature | Purpose |
| --- | --- |
| `chat` | Chat UI, streaming, tool loop handling, message rendering |
| `settings` | Settings tabs and account/model/runtime configuration |
| `workspace` | Workspace shell, explorer, dashboard, agent sessions |
| `terminal` | Terminal sessions and detached terminal UI |
| `models` | Model discovery and selection |
| `marketplace` | Marketplace views and install state |
| `memory` | Memory inspection and visualization |
| `ssh` | SSH manager, SFTP, tunnels, remote tools |
| `voice` | Voice commands and speech UI |

## Shared Code

`src/shared` contains code safe to import from both main and renderer:

```text
src/shared/
├── constants/
├── prompts/
├── schemas/
├── terminal-ipc/
├── types/
└── utils/
```

Keep this layer free of Electron, Node-only, and browser-only side effects unless the file is explicitly typed as a contract.

## Native Workspace

`src/native` is a Rust workspace:

```text
src/native/
├── Cargo.toml
├── db-service/
├── memory-service/
└── tengra-proxy/
```

The release binaries are copied into Tengra's managed runtime directory by `scripts/compile-native.js`.

## Tests

Tests live under `src/tests` and are split by runtime:

```text
src/tests/
├── main/
├── renderer/
└── shared/
```

Use:

```bash
npm test
npm run test:renderer
npm run test:e2e
```

## Documentation

Use [README.md](./README.md) as the docs index. Do not add temporary notes under `docs/`; keep scratch material outside the documentation tree until it is ready to become a maintained document.
