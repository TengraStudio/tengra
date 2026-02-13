# Main Utils Module

This folder contains reusable low-level utilities used by main-process services and IPC handlers.

## Scope

- Error normalization and typed wrappers (`error.util.ts`, `ipc-wrapper.util.ts`)
- Caching and memoization (`cache.util.ts`)
- Validation and sanitization helpers (`config-validator.util.ts`, `command-validator.util.ts`)
- Event and batch helpers (`event-bus.util.ts`, `ipc-batch.util.ts`)

## Design Rules

- Keep utilities framework-agnostic and side-effect-light.
- Prefer strongly typed inputs/outputs over `any`.
- Expose composable primitives instead of service-specific logic.
- Any utility touching untrusted input must include validation guards.

