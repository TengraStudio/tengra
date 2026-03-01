# ADR-002: MCP for Plugin System

## Status

Accepted

## Context

Tengra needs an extensibility mechanism to allow AI models to interact with external tools — filesystems, Git, web search, databases, CI/CD pipelines, and more. Options considered:

- **Custom plugin API** — full control but high development cost and no ecosystem.
- **OpenAI function calling only** — limited to specific providers, no standardization.
- **MCP (Model Context Protocol)** — open standard by Anthropic for tool integration, growing ecosystem of pre-built servers.

Requirements: provider-agnostic tool execution, marketplace for discovery, permission controls, and debuggability.

## Decision

We adopted **MCP (Model Context Protocol)** as the plugin/tool system. MCP servers run as separate processes managed by the main process, communicating via JSON-RPC over stdio or SSE.

The implementation lives in `src/main/mcp/` with a marketplace in `src/main/ipc/mcp-marketplace.ts` for discovering and installing community servers.

## Consequences

### Positive

- Large and growing ecosystem of pre-built MCP servers
- Provider-agnostic — works with any LLM that supports tool use
- Process isolation provides security boundaries
- Standardized protocol reduces integration complexity
- Marketplace enables community-driven extensibility

### Negative

- Extra process overhead per active MCP server
- Protocol still evolving — may require updates as spec changes
- Debugging cross-process communication adds complexity
- Permission model must be carefully designed to prevent abuse
