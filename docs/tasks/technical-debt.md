# Technical Debt & Internationalization

> Extracted from TODO.md — remaining tasks only

## Architecture

- ( ) **DEBT-01**: Migrate to React Server Components
  - ( ) Evaluate feasibility for Electron
  - ( ) Identify components for migration
  - ( ) Performance benchmarking

## Internationalization


## Project Health & Maintenance (Backlog 0503–0506)

## Security Debt (Audit 2026-02-27)

- [x] **AUD-2026-02-27-01**: Remove access-token exposure from auth IPC response (`auth:poll-token` returns raw token).
  - [x] Return account metadata only; never return `access_token` to renderer.
  - [x] Add regression test to assert token is not present in IPC payload.

- [x] **AUD-2026-02-27-02**: Harden local API token handling in `ApiServerService`.
  - [x] Remove query-string token fallback (`?token=`) to prevent leakage via logs/browser history.
  - [x] Gate `/api/auth/token` with explicit one-time consent/nonce flow.

- [x] **AUD-2026-02-27-03**: Restrict `shell:runCommand` IPC surface with strict allowlist and policy checks.
  - [x] Allow known-safe executables only and validate args per-command schema.
  - [x] Add abuse-rate limiting and security-focused regression tests.

