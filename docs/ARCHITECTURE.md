# 🏗️ TENGRA ARCHITECTURE & STRUCTURE

## 1. CORE LAYERS
- **ELECTRON MAIN**: Orchestration, IPC handlers, background services.
- **ELECTRON RENDERER**: React 18 UI, feature modules, shadcn/ui.
- **RUST SIDECARS**: High-performance services (DB, Proxy, Memory).
- **SHARED**: Immutable types, Zod schemas, cross-process utilities.

## 2. DIRECTORY MAP
| Path | Responsibility |
| --- | --- |
| `src/main/` | Services, IPC, Lifecycle, Startup. |
| `src/renderer/` | Features, Components, Hooks, Stores, UI logic. |
| `src/shared/` | Contracts (Schemas), Shared Types, Helpers. |
| `src/native/` | Rust workspace for native binaries. |
| `src/tests/` | Unit (Vitest), Integration, E2E (Playwright). |

## 3. IPC DATA FLOW
- Renderer invokes `window.electron.invoke(channel, args)`.
- Preload bridge validates and forwards to Main.
- Main handlers use `createValidatedIpcHandler` for strict Zod validation.
- Services perform logic and return typed responses.

## 4. SERVICE LIFECYCLE
- **Init**: All services register in `startup/services.ts`.
- **Base**: Every service extends `BaseService`.
- **Cleanup**: Mandatory `dispose()` implementation for resource safety.

"Architecture is about the important stuff. Whatever that is."
