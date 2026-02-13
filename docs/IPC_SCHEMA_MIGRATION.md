# IPC Schema Migration Guide

## Goals

- Keep renderer-main IPC contracts backward compatible by default.
- Introduce versioned schema checks for sensitive handlers.
- Provide a deterministic migration path when payload structures change.

## Rules

- Add or rename fields in a backward-compatible way first (optional + defaults).
- For breaking changes, either:
  - keep the same channel and normalize old payloads in `normalizeArgs`, or
  - create a new channel name and deprecate the old channel.
- Set `schemaVersion` in `createValidatedIpcHandler` options when introducing a new contract.

## Migration Checklist

1. Add/Update Zod schema in IPC module.
2. Wire schema using `createValidatedIpcHandler`.
3. Add `normalizeArgs` for legacy payload support if needed.
4. Add or update tests for valid/invalid payloads.
5. Run `npm run docs:ipc:schemas` and commit docs update.

