# API and IPC Reference

This document provides a map of Tengra's local REST API, renderer IPC bridge, and extension surfaces. Source schemas and implementations are the authoritative reference.

## Local REST API

Tengra exposes a local API server for controlled integrations, browser tooling, and extension workflows.

| Area | Purpose | Location |
| --- | --- | --- |
| Auth | Authentication and linked-account status | `src/main/services/system/auth.service.ts` |
| Chat | OpenAI-compatible chat completions | `src/main/services/llm/` |
| Workspaces | Metadata and file operations | `src/main/services/workspace/` |
| Models | Provider and local model discovery | `src/main/services/llm/` |
| Runtime | Health and service status | `src/main/services/system/health.service.ts` |

## Renderer IPC Bridge

The renderer communicates with the main process via domain-specific preload bridges located in `src/main/preload/domains/`.

Key domain areas:

- **AI**: Model registry, downloading, and LLM interactions.
- **Chat**: Conversation flow and streaming.
- **Data**: Database, files, and gallery management.
- **System**: Settings, auth, locale, and window management.
- **Workspace**: Git, terminal, SSH, and MCP integrations.
- **Media**: Image generation and voice services.

## IPC Contract Rules

- **Validation**: Use shared Zod schemas in `src/shared/schemas/` for all cross-process payloads.
- **Security**: Keep privileged operations in the main process or native sidecars.
- **Consistency**: Mirror API additions in both preload domain types and renderer declarations.
- **Error Handling**: Return structured errors; never leak raw credentials or tokens.

## Tool and MCP Execution

Tool execution is managed through:

- `src/main/tools/tool-definitions.ts` (Core tool schemas)
- `src/main/tools/tool-executor.ts` (Execution logic)
- `src/main/services/workspace/mcp.service.ts` (MCP dispatcher)

Native proxy tools are routed through the MCP permission path before reaching `tengra-proxy`.

## Native Proxy Service

Provider routing, token management, and quota checks are consolidated in the `tengra-proxy` sidecar (`src/native/tengra-proxy`).

The Electron process handles the application lifecycle, secure storage, and UI orchestration, while the native proxy manages high-throughput provider communications.
