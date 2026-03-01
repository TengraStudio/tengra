# ADR-001: PGlite for In-Process PostgreSQL

## Status

Accepted

## Context

Tengra requires a robust relational database for persisting chat history, project
metadata, knowledge graphs, user access control, and system configuration. Desktop
applications face unique constraints: no external database server dependency, seamless
installation, zero user configuration, and full SQL capability.

Options considered:
- **SQLite** — Lightweight but lacks PostgreSQL-compatible types and extensions.
- **External PostgreSQL** — Powerful but requires separate installation and management.
- **PGlite** — Embeddable PostgreSQL running in-process with full SQL compatibility.

## Decision

We chose **PGlite** as the database engine, accessed through a dedicated Rust
microservice (`src/services/`) that exposes an HTTP interface to the Electron main
process.

Key implementation details:
- `src/main/services/data/database.service.ts` — Primary service implementing the
  repository pattern via a `DatabaseAdapter` interface.
- `src/main/services/data/database-client.service.ts` — HTTP client communicating with
  the standalone Rust db-service (connection pooling, keep-alive, maxSockets: 10).
- `src/main/services/data/repositories/` — Domain-specific repositories organized by
  bounded context: `chat/`, `knowledge/`, `project/`, `system/`, `uac/`.
- Service discovery uses a port-file cache mechanism for locating the Rust process.

The `DatabaseAdapter` abstraction decouples business logic from the storage engine,
allowing future migration without touching repository code.

## Consequences

### Positive
- Zero external dependencies — users install a single application.
- Full PostgreSQL dialect support (JSON operators, CTEs, window functions).
- Repository pattern enables isolated testing with in-memory adapters.
- Rust microservice isolates database I/O from the Node.js event loop.

### Negative
- Additional process management complexity (Rust sidecar lifecycle).
- HTTP serialization overhead compared to direct in-process calls.
- PGlite ecosystem is less mature than SQLite for desktop use cases.
- Database migrations must be carefully managed across app updates.
