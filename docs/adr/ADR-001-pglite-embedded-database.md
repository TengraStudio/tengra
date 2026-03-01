# ADR-001: PGlite as Embedded Database

## Status

Accepted

## Context

Tengra needs a local database for storing chats, messages, projects, memory, and user data. The options considered were:

- **SQLite** — widely used, simple, but lacks advanced features like JSONB, full-text search extensions, and vector operations needed for AI memory.
- **PGlite** — PostgreSQL compiled to WebAssembly, runs in-process with no external server dependency.
- **External PostgreSQL** — full-featured but requires users to install and manage a separate database server.

Key requirements: zero-config setup, vector similarity search for AI memory, JSONB support for flexible metadata, and migration support.

## Decision

We chose **PGlite** as the embedded database engine. It runs PostgreSQL in-process via WebAssembly, providing full SQL compatibility without requiring users to install any database server.

The database is accessed through `DatabaseService` in `src/main/services/data/` which manages connections, migrations, and schema versioning via a `migration_history` table.

## Consequences

### Positive

- Zero configuration — works out of the box on all platforms
- Full PostgreSQL feature set including JSONB, CTEs, window functions
- Vector operations possible for semantic memory search
- Standard SQL migrations work without custom tooling
- No external process to manage or monitor

### Negative

- Slightly higher memory footprint than SQLite
- WebAssembly startup time adds to initial app load
- Limited to single-process access (acceptable for desktop app)
- Fewer community resources compared to SQLite for Electron apps
