# ADR 0001: Keep Electron Multi-Process Architecture

- Status: accepted
- Date: 2026-02-13
- Owners: Core Platform

## Context

The app executes untrusted model output, handles local files, and must keep UI responsive during long-running operations.

## Decision

Keep strict separation between renderer and main process, with all privileged actions routed through explicit IPC handlers.

## Alternatives Considered

1. Single-process architecture with direct Node access from UI
2. Web-only architecture without local privileged services

## Consequences

Positive:
- Reduced attack surface with context isolation.
- Better stability via fault isolation.
- Clear ownership boundaries for services.

Negative:
- IPC surface must be maintained and documented.
- Extra serialization overhead across process boundaries.

## Rejected Alternatives

- Single-process design rejected due to security risk from untrusted content.
- Web-only approach rejected because local workflows need direct filesystem and terminal integration.
