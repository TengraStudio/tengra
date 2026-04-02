# Tengra performance Optimization TODO

## Build-Time Optimizations
- [x] Configure Terser for production minification (2 passes, mangle toplevel)
- [x] Prune console logs and traces in production
- [x] Integrate SVGO-like minification for SVG's (Handled via Vite plugins if already present)

## Startup & Runtime Performance
- [x] Enable V8 Compile Cache for fast startup (Node 22+ switch)
- [x] Integrated lightweight CSS loading splash screen to index.html
- [x] Add app-ready class to dismiss splash after React hydration
- [x] Trigger memory cleanup on window blur for backgrounded instances
- [x] Add hardware acceleration toggle (TENGRA_LOW_RESOURCE_MODE)

## Architectural Offloading
- [x] Introduce `UtilityProcessService` for background worker management
- [x] Register UtilityProcessService in DI container and global services map
- [x] Migrate `AuditLogService` to UtilityProcess worker
- [x] Migrate `TelemetryService` to UtilityProcess worker
- [x] Prototype binary IPC transport for chat message payloads

## Workspace Explorer Modernization
- [x] Replace recursive workspace tree rendering with a flat visible-row explorer core
- [x] Move explorer selection/focus state into a dedicated external store
- [x] Add inline rename/create flows directly inside explorer rows
- [x] Add explorer search/filter with reveal-active-file support
- [x] Stop explorer render-loop/stale reveal reloads that caused scroll jumps and delayed file initialization
- [x] Decouple initial explorer row rendering from git decoration fetches

## Workspace Follow-up
- [x] Remove audit logging from hot-path workspace file reads/listing and stop duplicate watcher reinitialization causing explorer lag
- [x] Investigate missing in-editor code suggestion flow in workspace editors and restore suggestion provider wiring
- [x] Add file watcher patching for workspace trees to avoid full explorer refreshes
- [x] Add explorer diagnostics badges for TypeScript, lint, test, and agent issues
- [x] Add git-aware explorer decorations and actions for staged/unstaged/history workflows
- [x] Build workspace-wide fuzzy file, symbol, and content search with reveal-in-tree
- [x] Add Open Editors, Recent Files, and Pinned Files sections to workspace explorer
- [x] Add persisted per-workspace layout profiles for sidebar, terminal, and panel states
- [x] Add inline bulk actions for multi-rename, multi-delete, move, and copy workflows
- [x] Add smart exclude handling from .gitignore and custom workspace ignore rules
- [x] Add SSH/remote workspace metadata cache with lazy hydration for explorer performance
- [x] Add background indexing for semantic search, dependency graph, and code map generation
- [x] Add workspace health checks for runtimes, env issues, permissions, symlinks, and watch limits
- [x] Add collaboration primitives such as file locks, presence, and workspace change feed
- [x] Restore and extend editor intelligence bridge for suggestions, hover, references, and code actions
- [x] Add workspace session snapshot and restore for tabs, scroll state, and expanded tree state
- [x] Add task/run orchestration for per-workspace commands, dev servers, logs, and grouped processes
- [x] Add workspace security boundary checks for secrets, dangerous commands, writable paths, and remote trust levels
- [x] Reorganize workspace settings and add workspace-scoped Monaco editor controls
- [x] Add app/editor zoom controls via Ctrl/Cmd + plus, minus, and zero while removing appearance font controls
- [x] Fixed `SecurityScanService` ENOENT error on Windows by enabling shell for `npm audit`
- [x] Resolved application startup crash by removing duplicate Git IPC handler registrations for `git:getFileHistory` and `git:getLastCommit`
- [x] Enforce single-instance editor tabs, remove recent files explorer section, move terminal appearance controls into Settings > Appearance, add editor auto-save, and relocate workspace danger zone into settings
- [x] Fix workspace diagnostics/LSP integration regressions, stabilize Monaco file-model resolution, and restore the full Vitest suite to green
- [x] Respect `.gitignore` during workspace analysis, remove static/comment-based fake issues, and stop Monaco from surfacing false TS/JSX diagnostics
- [x] Route editor diagnostics through backend LSP sessions with project-root discovery so Monaco markers reflect real workspace TypeScript/JavaScript errors
- [x] Restore Monaco minimap visibility, surface unsaved-change markers in the overview/minimap, and add Ctrl+hover/Ctrl+click import navigation through backend definitions
- [x] Limit workspace storage breakdown to root-relative directories only and merge total-size plus largest-directories into a single dashboard section
- [x] Clarify workspace line-count labeling and extract website backend/frontend repos out of the main workspace after pushing pending frontend changes
- [x] Flatten settings UI chrome, reduce shadcn border/ring intensity, and make core settings tabs responsive across narrow widths
- [x] Make shared/custom modals responsive with fluid heights, lighter chrome, and restore the workspace wizard existing-folder picker so directory selection opens reliably
- [x] Implement UI for workspace agent permission-denied errors with actionable configuration links in the chat interface.
- [x] Fix workspace logo rendering by normalizing `safe-file` image URLs in the renderer and whitelisting workspace roots for protocol-backed logo previews.
- [x] Normalize workspace logo `safe-file` rendering so uploaded/generated logos display immediately on Windows instead of resolving to broken image URLs.

## Provider Follow-up
- [ ] Research and prototype `groq` provider support, including OAuth flow validation and current API compatibility gaps
- [ ] Research `cursor` provider support, including reverse-engineering the auth flow and identifying implementation constraints
- [ ] Research `kimi` provider support, including reverse-engineering the auth flow and identifying implementation constraints
- [ ] Evaluate whether `gemini` should be added as a distinct Google provider alongside `antigravity`
- [x] Refined AI Assistant Sidebar UI: reduced composer height (h-11), implemented configurable message footers (timestamp and model only for sidebar), added dynamic context-aware header icons, and suppressed duplicate display of identical model variants.
- [x] Implemented robust XML tool call detection for Copilot/Codex models, enabling tool execution from `<function_calls>` tags and eliminating visual flickering during streaming.


## Tengra Proxy Future TODO (Service Roadmap)
- [x] Add Tengra Proxy routing/middleware engine using standard axum/hyper routers
- [x] Implement proxy request interception and SSE streaming for `claude.ai` and `chatgpt.com` APIs
- [x] Implement quota exhaustion check before rewriting proxy requests (`429 Too Many Requests`)
- [x] Implement GitHub Copilot OAuth support (Device Flow + Session Token swap) in Rust proxy.
- [x] Stop launching native token/quota/model helper services and route token sync, quota, and model catalog reads through `tengra-proxy`
- [x] Consolidate native token/quota/model responsibilities into `tengra-proxy`, preserve linked-account metadata, and remove legacy helper binaries from native build output
- [x] Align `linked_accounts` proxy upserts with the real DB primary key and namespace provider default account IDs to avoid `ON CONFLICT` sync failures
- [x] Restore local Ollama model visibility in the unified model registry even when no remote account is linked
- [x] Restore browser auth reliability by moving Codex off the missing proxy URL endpoint and preventing stale provider auth locks in the settings UI
- [x] Harden linked-account timestamp handling so legacy text timestamps do not break encryption upgrades or token refresh sync jobs
- [x] Bring Copilot token lifecycle parity into `tengra-proxy`, including session persistence, plan metadata, v1 fallback, and invalid-token invalidation
- [x] Route Copilot chat and stream IPC traffic through the generic `tengra-proxy` LLM path so native proxy rate limits and token refresh logic are always applied
- [x] Remove the legacy main-process `CopilotRateLimitManager` and direct Copilot request stack once all Copilot chat/rate-limit enforcement lives in `tengra-proxy`
- [x] Remove remaining main-process Antigravity quota-triggered token refresh loop so quota/token authority stays with `tengra-proxy`
- [x] Remove the final JS-side token refresh/retry paths so 401 handling no longer performs proactive refresh outside `tengra-proxy`
- [ ] Secure `db-service` localhost port against outside bindings or implement local token authentication
- [x] Migrate `token_data` storage in DB from plaintext to AES/Keychain encrypted blobs
- [x] Optimize sequential `reqwest` DB calls in the proxy auth handlers (lazy caching)
- [x] Add OpenAI bridge readiness endpoint (`/api/auth/oauth/bridge/readiness`) reporting bind status and target route health.
- [ ] Add startup integration test that asserts failure when fixed bridge port `1455` is occupied.
- [ ] Add callback bridge telemetry (redirect count, error count, p50/p95 latency) and expose via `/health` diagnostics payload.
- [ ] Add authenticated provider info enrichment for OpenAI/Anthropic accounts (avatar/organization metadata where available).
- [ ] Add provider-level OAuth timeout configuration (currently static) with strict bounds validation.
- [ ] Add resilient DB retry policy for callback completion write path with explicit failure reporting.
- [ ] Add one-click auth verification endpoint that runs provider readiness + callback route sanity checks.
- [ ] Add per-provider benchmark harness in CI for auth start/callback local latency baselines.
- [ ] Add formal contract tests against `vendor/cliproxyapi` parity cases for OpenAI/Codex parameters and redirect behavior.
- [ ] Add migration helper to normalize existing OpenAI linked-account metadata generated before bridge rollout.
- [x] Add cliproxy-style compatibility aliases and native handlers for `/responses`, Claude `/messages`, and `/messages/count_tokens` in `tengra-proxy`
- [x] Add management compatibility wrappers for auth URL generation and linked-account auth status in `tengra-proxy`
- [x] Move OAuth callback/session ownership into `tengra-proxy` so auth URL generation, callback completion, and auth-status polling stay in native proxy state
- [x] Stop browser-account linking from using the legacy `LocalAuthServer` callback listeners so retrying OAuth does not leave the UI stuck in connecting or fixed callback ports occupied
- [x] Make browser OAuth completion resilient to stale proxy session state by falling back to linked-account DB detection in both native auth-status and main/renderer polling
- [x] Stop repeated `proxy_key_default` encryption-upgrade churn from blocking auth/settings loads and surface real loading state in Settings > Accounts instead of a false "no results" empty state
- [x] Refresh public linked-account reads from DB after proxy-side OAuth writes so newly linked browser accounts appear immediately in the UI instead of staying hidden behind stale AuthService cache
- [x] Restore native proxy-to-main auth synchronization so browser OAuth writes emit structured auth updates, refresh renderer account state immediately, and keep linked-account timestamps numeric
- [x] Normalize native proxy auth-update payloads and emit completion signals on OAuth DB writes so Codex/Claude browser-linked accounts surface in UI immediately after callback completion
- [x] Unblock browser OAuth UI completion by dropping `authBusy` before renderer refresh work and grouping aliased providers (`openai/codex`, `anthropic/claude`, `google/antigravity`) under the correct account cards
- [x] Convert proxy `/responses` streaming into OpenAI-style `response.*` SSE events and improve Claude/Gemini response fidelity
- [x] Remove obsolete native `token-service`, `quota-service`, and `model-service` source crates from `src/native`
- [x] Replace browser OAuth `default` slots with proxy-owned request/account IDs, scope auth-status polling to `{provider,state,accountId}`, and keep Settings > Accounts buttons provider-local instead of globally disabled
- [x] Remove remaining `cliproxyapi`/`cliproxy-runtime`/`cliproxy-embed` build and test ties outside `vendor/`, including the legacy Go runtime sources and managed-runtime fixtures
- [x] Reconcile browser OAuth completion against request/account ID drift, trust exact request-scoped `ok` auth-status responses, and purge stale `cliproxy` runtime binaries/manifests on startup/build
- [x] Centralize AppData logs under `AppData/Roaming/Tengra/logs` and add startup cleanup for Electron cache folders, stale terminal logs, and legacy token artifacts
- [x] Stabilize browser OAuth completion in Settings by tracking the live pending auth request outside render state so auth events cannot leave providers stuck in `Connecting`
- [x] Emit renderer auth updates directly from proxy-side auth sync and accept recently created provider accounts as browser-auth completion signals when request/account IDs drift
- [x] Bound browser OAuth startup with explicit renderer/proxy timeouts and log `proxy:*` auth IPC entrypoints so stalled `Connecting...` states fail fast instead of hanging silently
- [x] Restore legacy native model-service fetch semantics inside `tengra-proxy` so Copilot/Antigravity/NVIDIA model lists are served from provider fetches instead of the old static proxy catalog alone
- [x] Expand NVIDIA proxy model serving beyond the narrow live `/v1/models` response by merging it with the official NVIDIA NIM language-model catalog in `tengra-proxy`
- [x] Parse `db-service` query responses from `data.rows` in `tengra-proxy` so linked-account-aware remote model fetching works instead of silently falling back to the static proxy catalog
- [x] Refresh the model registry again after `tengra-proxy` becomes ready and retry renderer model loading when expected remote providers are still missing from the first startup snapshot
- [x] Serve NVIDIA models from the live NVIDIA `/v1/models` API only and recover app startup caches when the first snapshot incorrectly collapses to a single NVIDIA model
- [x] Unwrap malformed `{ success, data }` persisted settings envelopes so provider API keys load into startup sync and `tengra-proxy` no longer falls back to the static 17-model catalog
- [x] Serve NVIDIA model discovery in `tengra-proxy` directly from the live public `/v1/models` API without docs scraping or token-gated fallback
- [x] Flatten Antigravity OAuth token persistence in `tengra-proxy`, support legacy nested token payloads, and refresh on 401 before falling back to the static Gemini catalog
- [x] Hydrate Copilot session tokens on demand inside `tengra-proxy` model discovery and stop serving the static 3-model Copilot fallback
- [x] Add the missing current Claude Code models (`claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`) to the proxy-served Claude catalog and metadata registry
- [x] Stop `RuntimeBootstrapService` from deleting locked Chromium `Shared Dictionary`/`DIPS*` artifacts on startup and make initial remote model cache hydration non-blocking while avoiding duplicate proxy model fetches
- [x] Skip redundant Rust native rebuilds in `scripts/compile-native.js` when `src/native` inputs have not changed, while still syncing the managed runtime binaries
- [x] Switch renderer production minification to esbuild, make bundle visualizer/compressed-size reporting opt-in, and remove the static Ollama startup import from `RuntimeBootstrapService`
- [x] Defer `modelRegistryService` initialization until after the window is shown so remote model hydration stops competing with first-window startup
- [x] Defer `localImageService` initialization to post-window startup and make its initialize path idempotent so deferred startup no longer double-initializes image state
- [x] Limit proxy background token refresh to genuinely refreshable providers/credentials and invalidate stale Copilot GitHub tokens on 401/404 instead of retry-looping forever
- [x] Preserve Copilot device-flow session token, expiry, and plan metadata from `tengra-proxy` poll responses through main-process account linking so fresh Copilot auth no longer lands in DB as access-token-only
- [x] Stop freshly linked Copilot sessions from being invalidated immediately by using a tighter Copilot refresh threshold and refusing to clear still-valid Copilot session tokens on refresh exchange failures
- [x] Decrypt stored OAuth refresh/access/session tokens inside `tengra-proxy` before background refresh so Codex/Claude/Antigravity/Copilot refresh requests stop sending encrypted `Tengra:v1:` blobs upstream
- [x] Provide `tengra-proxy` the live decrypted master key from Electron startup so native token/model paths no longer depend on incompatible `safeStorage` key decryption
- [x] Source model-registry proxy discovery from the raw `tengra-proxy` `/v1/models` catalog so Copilot live models are preserved, and demote step-by-step auth/model refresh chatter to debug logs
- [x] Wrap Antigravity chat requests for `cloudcode-pa` with `{ model, project, request }` and unwrap wrapped non-stream/stream Gemini responses so Gemini models stop failing with `Unknown name "contents"` payload errors
- [x] Resolve real Antigravity `project_id` from `loadCodeAssist` instead of persisting/sending `auto`, and map Codex system prompts into the required `/responses` `instructions` field
- [x] Align Antigravity model aliasing, request shaping, and base-url fallback order with `vendor/cliproxyapi` so fetched model IDs and chat upstream IDs stay in exact parity
- [x] Reassemble streamed `/responses` function-call deltas into stable tool calls so Codex/Copilot tool execution preserves real `call_id` and function names
- [x] Make Copilot proxy model discovery retry expired session tokens and fall back across linked accounts so startup refresh races do not hide the Copilot category

- [x] Resolved Antigravity Gemini authentication issues by correcting provider settings key and hiding problematic/unsupported model versions (Gemini 2.5/3.1).

- [x] Refined internationalization (i18n) system: Removed all unsupported language files and directories (ar, de, es, fr, ja, zh), updated types and schemas to strictly support English and Turkish, and added missing translations for agent characteristics and workspace states.

- [x] Removed browser extension install modal and associated translations (Turkish and English) to simplify the core application interface and reduce unnecessary dependencies.

- [x] Streamlined MCP architecture by removing 19 redundant server modules, merging monitoring into the system core, and modernizing the Marketplace UI with accessible font scaling, enhanced status indicators, and full i18n support for all module descriptions.
- [x] Reworked i18n around runtime locale packs by making English the single built-in JSON locale pack, removing per-key fallback behavior, deleting legacy `en`/`tr` source trees, and aligning translation export/runtime loading with marketplace-installed languages.
- [x] Fixed runtime theme restoration for marketplace-installed themes by loading the theme registry eagerly at startup and reapplying theme variables when the runtime registry updates; also hardened utility workers to handle Electron message channels reliably without timing out into local fallbacks.

---
- [x] Removed the automated onboarding system and "Start Tour" functionality from the application core and settings, while preserving translation keys for weekend-only updates.

- [x] Removed unused optional environment variables (Sentry, OAuth redirects, and secrets) from .env.example to eliminate redundant EnvValidator warnings.

- [x] Fixed an infinite update loop in the `useVoice` hook that caused "Maximum update depth exceeded" errors in General Settings by splitting voice synthesis and recognition initialization and stabilizing callback dependencies.
- [x] Resolved build-time TypeScript errors in `session-conversation.ts` and `protocols.ts` related to protocol registration and chatId metadata access.

## UI Modernization & Design System
- [x] Initialize Shadcn/ui with standard configuration and @/renderer aliases
- [x] Create core Shadcn/ui components (Input, Checkbox, Label, Textarea) with HSL theme support
- [x] Migrate Workspace Settings fields to Shadcn/ui (General, Editor, Advanced, Dev Server)
- [ ] Continue migrating inputs and checkboxes across other features (SSH, SFTP, Chat, Terminal)

## Remote Interaction (Günün Hedefi: Discord & Telegram)
- [x] Define `RemoteAccountsSettings` schema and update `AppSettings` interface
- [x] Create `SocialMediaService` in Main process with platform-agnostic provider architecture
- [x] Implement Discord bot provider (Token based) with message routing
- [x] Implement Telegram bot provider (BotFather token based) with message routing
- [x] Develop Whitelist security layer (User ID verification)
- [x] Create IPC handlers for remote account management (handled via generic settings update)
- [x] Build "Social Media" Tab in Settings using Shadcn/ui (Card-based UI)
- [ ] Implement proactive notifications (finished task alerts via bot)
- [ ] WhatsApp Integration (QR or API - Next Priority)

*Updated on 2026-04-01*
