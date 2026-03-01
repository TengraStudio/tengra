# ADR-004: Electron IPC Validation with Zod

## Status

Accepted

## Context

Electron IPC is the communication bridge between the renderer (untrusted) and main (privileged) processes. Without validation, malformed or malicious data from the renderer could cause crashes, data corruption, or security vulnerabilities.

Options considered:

- **No validation** — fastest but unsafe; any data shape passes through.
- **Manual type checks** — tedious, error-prone, inconsistent.
- **Zod runtime validation** — declarative schemas, TypeScript inference, rich error messages.
- **io-ts / Yup** — similar capability but Zod has better DX and TypeScript integration.

## Decision

We use **Zod** for runtime validation of IPC messages. The `createValidatedIpcHandler` utility in `src/main/utils/ipc-wrapper.util.ts` wraps handlers with input/output schema validation. A `sender-validator.ts` module verifies that IPC messages originate from legitimate renderer windows.

All new IPC handlers should use validated handlers where input complexity warrants it. Simple handlers (no parameters or trivial types) may use `createIpcHandler` without Zod.

## Consequences

### Positive

- Runtime type safety at the process boundary
- TypeScript types inferred from schemas — single source of truth
- Clear error messages when validation fails
- Prevents malformed data from reaching service layer
- Sender validation prevents IPC spoofing

### Negative

- Small runtime overhead per IPC call for validation
- Schema definitions add boilerplate for simple handlers
- Zod version updates may introduce breaking changes
- Developers must remember to use validated handlers for new endpoints
