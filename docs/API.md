# API and IPC Reference

This document gives a high-level map of Tengra's local REST API, renderer IPC bridge, and extension/MCP integration surfaces. Source schemas and handler implementations remain the authoritative reference.

## Local REST API

Tengra exposes a local API server for controlled integrations such as browser tooling, local utilities, and extension workflows.

Typical route groups:

| Area | Example Routes | Purpose |
| --- | --- | --- |
| Auth | `/api/v1/auth/status` | Check linked-account/auth state |
| Chat | `/api/v1/chat/completions` | OpenAI-compatible local chat entrypoint |
| Workspaces | `/api/v1/workspaces`, workspace-scoped file routes | Workspace metadata and file operations |
| Models | model/provider catalog routes | Provider and local model discovery |
| Runtime | health/status routes | Runtime and service health |

Request authentication and exact route contracts are implemented in `src/main/api/api-server.service.ts`.

## Renderer IPC Bridge

The renderer does not access Node.js or the OS directly. It calls functions exposed by preload domain bridges under `src/main/preload/domains`.

Key bridge/domain areas:

| Domain | Typical Responsibility |
| --- | --- |
| `auth` / linked accounts | OAuth, account state, tokens, auth sessions |
| `session` / conversation | chat streaming and session conversation flow |
| `db` | chats, messages, folders, workspaces, stats |
| `files` | filesystem read/write/list operations |
| `workspace` | workspace analysis, code intelligence, inline suggestions |
| `terminal` / `process` | shell sessions and process output |
| `ssh` | SSH profiles, connections, SFTP, remote execution |
| `mcp` / marketplace / extension | plugin and marketplace lifecycle |
| `runtime` | managed runtime status and repair |
| `settings` / theme | user preferences and UI runtime state |

Shared renderer-facing API types live in:

- `src/renderer/electron.d.ts`
- `src/renderer/electron-api/`
- `src/shared/types/electron-api.types.ts`
- `src/shared/schemas/`

## IPC Contract Rules

- Validate external or cross-process payloads with shared schemas where a schema exists.
- Keep privileged work in the main process or native services.
- Keep renderer API additions mirrored in preload domain types and renderer declarations.
- Return structured errors; do not leak raw tokens, headers, or provider credentials.
- Add tests when changing channel shape, response shape, or validation behavior.

## Tool and MCP Execution

Tool execution is centered around:

- `src/main/tools/tool-definitions.ts`
- `src/main/tools/tool-executor.ts`
- `src/main/mcp/dispatcher.ts`
- `src/main/mcp/plugin-base.ts`

Native proxy tools are bridged through the existing MCP permission path before calls reach `tengra-proxy`.

## Provider Proxy API

Provider routing, token refresh, quota checks, and model catalog behavior are consolidated in `tengra-proxy` under `src/native/tengra-proxy`.

The proxy exposes compatibility handlers for common chat/model endpoints and management flows. Electron remains responsible for app lifecycle, secure account storage, UI, and IPC mediation.
