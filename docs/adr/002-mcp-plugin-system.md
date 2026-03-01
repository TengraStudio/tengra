# ADR-002: MCP for Plugin Extensibility

## Status

Accepted

## Context

Tengra's AI assistant needs to interact with external systems — filesystems, Git
repositories, Docker, SSH hosts, databases, CI/CD pipelines, and cloud storage.
Hard-coding each integration into the main process creates tight coupling, bloated
binaries, and limits community contributions.

Options considered:
- **Custom plugin API** — Full control but high maintenance and no ecosystem leverage.
- **Language Server Protocol (LSP)** — Designed for editors, poor fit for tool use.
- **Model Context Protocol (MCP)** — Standardized protocol for AI tool integration
  with growing ecosystem support.

## Decision

We adopted **MCP (Model Context Protocol)** as the plugin architecture, implemented
across `src/main/mcp/` with the following structure:

- `src/main/mcp/registry.ts` — `buildMcpServices()` assembles all 16 built-in MCP
  servers (filesystem, git, database-admin, docker, ssh, web, security, etc.).
- `src/main/mcp/plugin-base.ts` — Defines `IMcpPlugin` interface and
  `InternalMcpPlugin` adapter for TypeScript-based servers.
- `src/main/services/mcp/mcp-plugin.service.ts` — Manages full plugin lifecycle
  (initialize, dispatch, dispose) with per-plugin metrics tracking.
- `src/main/mcp/servers/` — 16 built-in servers, each self-contained with tool
  definitions and handlers.
- `src/main/mcp/dispatcher.ts` — Routes tool calls to the correct server, bridging
  legacy and current interfaces.

Plugins are classified as **internal** (compiled into main process) or **external**
(standalone processes with IPC). Each server receives isolated storage at
`{settingsDir}/mcp-storage/{serverId}`.

## Consequences

### Positive
- Standardized protocol enables third-party and community plugins.
- Each server is independently testable and deployable.
- Storage isolation prevents cross-plugin data leaks.
- Metrics (dispatch count, errors, latency) provide operational visibility.

### Negative
- MCP specification is still evolving; breaking changes may require migration.
- External plugins add process management and IPC serialization overhead.
- 16 built-in servers increase startup initialization time.
- Dispatcher indirection adds complexity to debugging tool call routing.
