# Tengra Proxy Architecture

## Purpose

`tengra-proxy` is the native Rust service that brokers provider auth, chat/completion transport, quota checks, tool execution, local terminal/workspace access, and account persistence.

## Top-Level Modules

- `src/proxy/`
  - HTTP-facing proxy logic, request routing, provider model resolution, and handler orchestration.
- `src/auth/`
  - Provider-specific OAuth/session flows and account bootstrap helpers.
- `src/quota/`
  - Provider quota fetchers and normalized quota response types.
- `src/db/`
  - SQLite access, account persistence, metadata merge/update helpers.
  - `support.rs`: provider/account normalization, metadata shaping, and token-sanitization helpers.
- `src/token/`
  - Refresh coordination and provider token lifecycle management.
- `src/tools/`
  - Local tool execution surface exposed through the proxy.
- `src/terminal/`
  - PTY session management and terminal process lifecycle.
- `src/security/`
  - Token encryption and path policy enforcement.
- `src/analysis/`
  - Code analysis and conflict-resolution helpers.

## Proxy Handler Layout

- `src/proxy/handlers/chat/`
  - `compact.rs`: request compaction and token-budget fitting.
  - `headers.rs`: provider header builders, especially provider fingerprinting.
  - `request.rs`: provider request dispatch.
  - `request_codex.rs`: Codex request shaping, tool-call normalization, and image generation bridging.
  - `request_claude.rs`: Claude request shaping and message block conversion.
  - `request_gemini.rs`: Gemini and Antigravity request shaping plus reasoning/thinking policy.
  - `request_support.rs`: shared content extraction and optional-field insertion helpers.
  - `response.rs`: non-stream response normalization.
  - `stream.rs`: stream dispatch and shared streaming loop orchestration.
  - `stream_claude.rs`: Claude SSE event translation.
  - `stream_copilot.rs`: Copilot session-event and usage translation.
  - `stream_cursor.rs`: Cursor Connect/SSE stream translation.
  - `stream_gemini.rs`: Gemini and Antigravity chunk translation.
  - `cursor.rs`: Cursor-specific HTTP client, local ID discovery, retry path, Connect framing.
  - `mod.rs`: generic chat execution path and provider dispatch.
- `src/proxy/handlers/`
  - `management.rs`: auth/quota/session HTTP handlers.
  - `management_support.rs`: quota snapshot building, Ollama auth helpers, token decrypt helpers, Cursor fallback IDs.
- `src/proxy/model_service/`
  - `support.rs`: provider-row grouping, model payload parsing, token extraction, and model dedupe helpers.
  - `static_models.rs`: static fallback catalogs and thinking-level definitions.

## Current Refactor Boundaries

- Generic chat flow should stay in `chat/mod.rs`.
- Provider-specific transport behavior should move into dedicated submodules like `chat/cursor.rs`.
- Shared provider fingerprint/version helpers should stay in `chat/headers.rs`.
- Tests should live next to the behavior they verify.

## Remaining Hotspots

These should be the next refactor targets:

- `src/proxy/model_service.rs`
- `src/db/mod.rs`
- `src/proxy/handlers/chat/mod.rs`
- `src/proxy/handlers/terminal.rs`

## Testing Policy

- Prefer small unit tests beside helpers.
- Keep provider translation tests in `request.rs`, `response.rs`, and `stream.rs`.
- Keep provider fingerprint and local-discovery tests in provider-specific modules.
- Run at minimum:
  - `cargo check`
  - `cargo test --lib`

## Notes

- The project currently mixes transport logic, provider heuristics, and persistence concerns in a few large files.
- New work should prefer extraction into narrow modules over growing existing `mod.rs` files.
