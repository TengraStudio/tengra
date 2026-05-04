# Project Architecture
 
 ## 1. Core Layers

- **Electron Main**: Orchestration, categorized IPC handlers, and domain-specific services.
- **Electron Renderer**: React 18 UI, modular feature folders, and shared components.
- **Native Sidecars**: High-performance Rust services (`db-service`, `tengra-proxy`) for database and proxy operations.
- **Shared**: Immutable types, Zod contracts, and cross-process utilities.

 ## 2. Directory Map

 | Path | Responsibility |
 | --- | --- |
 | `src/main/ipc/` | Categorized IPC handlers (ai, chat, workspace, etc.) |
 | `src/main/services/` | Core backend services grouped by domain. |
 | `src/renderer/features/` | Modular UI features (hooks, components, stores, utils). |
 | `src/renderer/components/` | Shared UI components and layout elements. |
 | `src/shared/` | Cross-process contracts and shared TypeScript types. |
 | `src/native/` | Rust source code for native sidecar binaries. |
 | `src/tests/` | Unit, integration, and E2E tests mirroring the source tree. |

 ## 3. Data Flow and Communication

- **IPC Bridge**: The renderer process invokes actions via domain-specific preload bridges.
- **Validation**: Every IPC call is validated using Zod schemas defined in `src/shared/schemas/`.
- **Services**: Business logic is encapsulated in services that extend `BaseService`.
- **Sidecars**: Heavy-duty operations (DB indexing, proxy routing) are delegated to native Rust binaries.

 ## 4. Service Lifecycle

- **Registration**: Services are initialized and registered in the core service container during startup.
- **Management**: The `BaseService` ensures consistent initialization and resource cleanup.
- **Disposal**: Mandatory `dispose()` implementations prevent memory leaks and dangling resources.
