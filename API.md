# Tengra API & IPC Reference

This document defines the high-level API and IPC contracts available in Tengra.

## 1. REST API (Browser Extension Integration)

Tengra exposes a local REST API for integration with browser-based IDEs and utilities.

### Authenticated Handlers
All requests MUST include `X-Tengra-Session` header.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/status` | `GET` | Get current authentication status |
| `/api/v1/chat/completions` | `POST` | OpenAI-compatible chat completion endpoint |
| `/api/v1/projects` | `GET` | List available workspace projects |
| `/api/v1/files/read` | `GET` | Read file content from a project |
| `/api/v1/files/write` | `POST` | Write content to a project file |

---

## 2. IPC Guide (Main ↔ Renderer)

Tengra utilizes a strictly typed IPC bridge.

### Core Architecture
- **Validated IPC**: Handlers are registered with Zod schemas for request and response validation.
- **IPC Response Wrapper**: All IPC calls return a wrapped response:
  ```typescript
  interface IpcResponse<T> {
    success: boolean;
    data?: T;
    error?: {
      code: string;
      message: string;
      details?: any;
    };
  }
  ```

### Key Domain Namespaces
| Namespace | Responsibility |
|-----------|----------------|
| `auth:` | Authentication flows and token management |
| `chat:` | LLM interaction and streaming |
| `project:` | Project lifecycle, indexing, and analysis |
| `files:` | Secure filesystem operations |
| `terminal:` | Terminal emulation and session handling |
| `settings:` | Application preferences and configuration |

### Auto-Generated IPC Channel List
Full list of all 600+ IPC channels can be found in [IPC_CHANNELS.md](./IPC_CHANNELS.md).

---

## 3. Marketplace API

Extensions are managed by the `ExtensionService` and use the following IPC channels.

### Extension Lifecycle
| Channel | Args | Returns |
|---------|------|---------|
| `extension:get-all` | — | All installed extensions |
| `extension:get` | `id: string` | Single extension by ID |
| `extension:activate` | `id: string` | Trigger activation |
| `extension:deactivate` | `id: string` | Deactivate extension |

### Extension Context
Extensions receive a scoped `ExtensionContext` with access to:
- `globalState`: Persistent storage.
- `workspaceState`: Per-project storage.
- `logger`: Scoped logging.
- `configuration`: Settings access.
- `subscriptions`: Cleanup management.

---

## 4. OpenAPI Specification

The formal OpenAPI 3.0 specification for the internal REST API is located in [tengra-api.openapi.yaml](./tengra-api.openapi.yaml).
