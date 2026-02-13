# ADR 0003: Service-Oriented Main Process with Central Registration

- Status: accepted
- Date: 2026-02-13
- Owners: Platform + Runtime

## Context

Main process responsibilities grew across auth, project, LLM orchestration, and system integrations. Tight coupling increased regression risk.

## Decision

Keep domain services separated and register IPC handlers through a single composition root (`registerAllIpc`) using explicit dependencies.

## Alternatives Considered

1. Direct service imports inside each IPC module
2. Monolithic "god service" for all runtime operations

## Consequences

Positive:
- Clear dependency boundaries.
- Easier testability and replacement of services.
- Better observability of system wiring.

Negative:
- Composition root is large and needs discipline.
- Refactors may require synchronized dependency updates.

## Rejected Alternatives

- Direct imports rejected due to hidden coupling.
- Monolithic service rejected for maintainability and ownership concerns.
