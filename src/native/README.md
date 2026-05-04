# Tengra Native Infrastructure

This directory contains the native sidecar services for Tengra, written in Rust. These services handle high-performance and security-critical tasks that are better suited for a native environment than the Node.js main process.

## Services

### 1. `db-service`
The central persistence layer for Tengra.
- **Runtime**: Rust + Axum + SQLite (SQLx).
- **Responsibilities**:
    - Managing the local SQLite database.
    - Handling database migrations.
    - Providing a typed HTTP API for the Electron main process to perform CRUD operations.
    - Implementing secure path policies for data access.

### 2. `tengra-proxy`
The communication hub and orchestrator.
- **Runtime**: Rust + Axum + Tokio.
- **Responsibilities**:
    - Acting as a secure gateway for all upstream AI provider requests (OpenAI, Anthropic, etc.).
    - Managing the lifecycle of MCP (Model Context Protocol) plugins.
    - Implementing the native MCP orchestrator for process management and tool execution.
    - Enforcing rate limits and request/response policies.

## Development

### Build Requirements
- Rust stable toolchain (v1.75+ recommended).
- `cargo-edit` (optional, for managing dependencies).

### Building Manually
While `npm run dev` handles building these services automatically, you can build them manually for debugging:

```bash
cd src/native/db-service
cargo build

cd ../tengra-proxy
cargo build
```

### Configuration
The services are typically configured via environment variables or CLI flags passed by the Electron main process during startup. See the service source code for specific configuration options.

## Security
- **Path Isolation**: Native services enforce workspace-root constraints to prevent unauthorized filesystem access.
- **Hardened Handlers**: All HTTP handlers use typed request/response validation to prevent injection or overflow attacks.
- **Process Isolation**: External plugins (MCP) are managed as child processes with restricted access to the host system.
