# ADR-005: Event-Driven Service Communication

## Status

Accepted

## Context

Tengra's main process contains 30+ services that need to communicate. Direct method calls between services create tight coupling and circular dependencies. Options considered:

- **Direct service injection** — simple but creates dependency graphs that are hard to manage.
- **Event emitter / pub-sub** — loose coupling, services react to events without knowing producers.
- **Message queue** — overkill for a single-process desktop application.

Requirements: decouple services, support async workflows (e.g., "model downloaded" triggers "index model"), and enable telemetry/audit logging without modifying business services.

## Decision

We use an **event-driven architecture** where services communicate through typed events. Services emit domain events (e.g., `chat:created`, `model:downloaded`, `project:opened`) and other services subscribe to events they care about.

The `BaseService` class provides lifecycle hooks (`initialize`, `cleanup`) that set up and tear down event subscriptions. Cross-cutting concerns like telemetry, audit logging, and performance monitoring subscribe to events without coupling to business logic.

## Consequences

### Positive

- Services are loosely coupled — can be developed and tested independently
- New features can react to existing events without modifying producers
- Audit and telemetry are transparent to business services
- Easier to reason about service boundaries and responsibilities
- Supports async workflows naturally

### Negative

- Event flow harder to trace than direct calls during debugging
- Event ordering not guaranteed — must design for eventual consistency
- Risk of event storms if not carefully managed
- Requires discipline to define clear event contracts
