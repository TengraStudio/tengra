# Tengra Project - Comprehensive TODO List

> Last updated: 2026-02-28
> **Status: In Development (Consolidated)**

## 🚀 Release Milestones

### v1.3.0 (Target: Q2 2026)
- [/] Marketplace system MVP (C++ Backend initialized)
- ( ) HuggingFace model integration
- ( ) Agent collaboration improvements
- ( ) Performance optimizations

### v1.4.0 (Target: Q3 2026)
- ( ) Extension system beta
- ( ) ComfyUI integration
- ( ) SSH tunneling
- ( ) Advanced memory features

### v2.0.0 (Target: Q4 2026)
- ( ) Plugin ecosystem
- ( ) Collaborative sessions
- ( ) Performance dashboard
- ( ) Mobile companion app

---

## 🔥 March 1, 2026 Critical Path (AI-Assisted Code Editor)

> **Deadline Notice**: Must-ship scope for March 1 launch.

### Core Implementation
- ( ) **MARCH1-CORE-001**: Ship workspace-integrated AI chat end-to-end.
  - ( ) Verify chat flow in workspace panel uses production IPC (`chat:stream`).
  - ( ) Add regression tests for chat stream lifecycle (start/chunk/done/cancel/error).
  - ( ) Add failure-state UX for provider unavailable / quota exhausted / timeout.

### Council Orchestration (President Flow)
- ( ) **MARCH1-COUNCIL-001**: Implement "Council President" flow with explicit pre-execution approval.
  - ( ) Generate plan + stages before execution.
  - ( ) Present selected models/accounts/routing to user for approve/reject.
  - ( ) Persist approved plan version and execution config for resume/audit.
- ( ) **MARCH1-COUNCIL-002**: Implement quota-aware account/model selection strategy.
  - ( ) Query linked account quotas before assignment.
  - ( ) Prefer highest-available quota account(s) with capability match.
  - ( ) Add deterministic fallback policy for multiple eligible candidates.
- ( ) **MARCH1-COUNCIL-003**: Enable dynamic reassignment and teamwork.
  - ( ) If an agent finishes early, allow reassignment to pending/blocked steps.
  - ( ) Enable inter-agent discussion channel for coordination and conflict resolution.
- ( ) **MARCH1-COUNCIL-004**: Add user-controlled model governance.
  - ( ) Let user force allowed/blocked model list per task.
- ( ) **MARCH1-RESUME-001**: Guarantee crash-safe continuation.
  - ( ) Persist full execution state on important transitions.
  - ( ) On app relaunch, restore active tasks and continue from last checkpoint.

### Reliability & Stabilization
- ( ) **MARCH1-QUALITY-001**: Stabilize project-agent operational gaps.
  - ( ) Replace stubbed telemetry/events endpoints with real data.
  - ( ) Ensure orchestrator/council IPC surface is actively wired in renderer.
- [x] **REF-003**: Implement re-render performance monitoring for `ProjectWorkspace` sub-sections.
- [x] **REF-005**: Add renderer tests for `WorkspaceEditor` clipboard-backed snippet import/export flows.
- [x] **REF-006**: Add renderer tests for `WorkspaceEditor` scratchpad command and file-save actions.

---

## 🛡️ Core Infrastructure & Security

### Security Hardening
- (x) **SEC-H-001**: Verify WebContents navigation restriction to trusted origins. — Already implemented via `navigation-security.util.ts`.
- ( ) **SEC-H-002**: Audit all IPC handlers for `responseSchema` validation (Zod).
- ( ) **SEC-H-003**: Implement periodic security scan for `node_modules` vulnerabilities.

### Audit Follow-Up (2026-02-28)
- (x) **AUDIT-IPC-001**: Replace raw `ipcMain.handle` registrations in service-owned channels with validated wrappers and sender checks.
  - (x) Migrate `ExtensionService` IPC handlers to centralized validated registration.
  - (x) Migrate `VoiceService` IPC handlers to centralized validated registration.
  - (x) Migrate `UpdateService` IPC handlers to centralized validated registration.
- ( ) **AUDIT-PROXY-001**: Split embedded proxy API key and remote-management secret into separate credentials.
  - (x) Stop reusing the same `proxyKey` for `api-keys` and `remote-management.secret-key`.
  - (x) Reduce or eliminate plaintext secret material written to proxy YAML on disk.
  - ( ) Add independent rotation and regeneration flow for both secrets.
- ( ) **AUDIT-OAUTH-001**: Stop trusting unsigned JWT payload claims in local OAuth flows.
  - (x) Verify `id_token` signature / issuer / audience / nonce before consuming claims.
  - (x) Fallback to provider `userinfo` or profile endpoint when verification is unavailable.
- (x) **AUDIT-PERF-001**: Remove eager shell-level imports of large generated changelog data from always-mounted layout components.
  - (x) Lazy-load changelog search/index data only when the changelog UI opens.
  - ( ) Define a bundle-size budget for shell/layout components.
- (x) **AUDIT-TOOLING-001**: Make repo-wide lint operational again.
  - (x) Exclude generated or oversized artifacts from lint scope.
  - (x) Prevent Node heap OOM during `npm run lint`.
  - (x) Add CI-friendly lint partitioning or staged lint commands.
- (x) **AUDIT-MAIN-IO-001**: Reduce synchronous filesystem I/O on Electron main thread.
  - ( ) Replace startup-path `existsSync` / `readFileSync` / `writeFileSync` in security-critical services first.
  - ( ) Audit extension, proxy, terminal, and logging services for sync I/O hot paths.
- ( ) **AUDIT-TYPES-001**: Eliminate remaining production `as unknown as` / unsafe cast debt in IPC and shared runtime code.
  - ( ) Replace double-casts in DB IPC with explicit serializers.
  - ( ) Remove translation casting shortcuts by normalizing locale shape at build time.
- (x) **AUDIT-REPO-001**: Enforce source-tree hygiene for temporary/generated artifacts.
  - (x) Remove stray temp files such as `*.tmp.*` from `src/`.
  - (x) Add repo checks that block accidental temp artifact commits.
- ( ) **AUDIT-LOG-001**: Review console redirection strategy to avoid double logging and excess IPC/log volume from renderer/main console overrides.
  - ( ) Measure impact of forwarding all renderer `console.*` to main logger.
  - ( ) Restrict noisy non-error logs in production builds.

### Main Process & Preload
- ( ) **PRE-001**: Continue modularization of remaining legacy IPC bridges.
- ( ) **MAIN-001**: Optimize startup time by lazy-loading non-critical services.
- (x) **AUTH-KEY-001**: Add multi-key API credential support across provider settings and model routing.
  - (x) Support multiple API keys per provider while keeping `apiKey` backward-compatible for legacy readers.
  - (x) Sync multi-key credentials through encrypted auth storage instead of persisting plaintext provider keys to settings.
  - (x) Add multi-key API key inputs for Codex, Claude, Groq, NVIDIA, Hugging Face, and Gemini in the Accounts settings tab.
- ( ) **AUTH-ROUTE-001**: Finalize hybrid OAuth vs API routing rules for supported providers.
  - ( ) Keep `antigravity` OAuth/session-only and do not add API key mode.
  - ( ) Enforce `auto` precedence as `oauth with quota -> api key -> oauth without api fallback`.
  - (x) Route `codex` and `claude` proxy auth through `AuthAPIService` with quota-aware `auto` selection and disabled-account gating.
  - (x) Expose provider-level credential mode controls in the settings UI.
- ( ) **PROVIDER-API-001**: Complete direct API provider coverage for Gemini and remaining API-key providers.
  - ( ) Finish Gemini API support as a standalone provider (separate from Antigravity).
  - (x) Route Gemini chat models through the embedded proxy path so API-key auth can be enabled without touching Antigravity.
  - ( ) Expand image-capable model handling for direct API providers (OpenAI/Gemini) so non-chat image models route correctly.
  - ( ) Verify Hugging Face, Groq, and NVIDIA direct API model lists match runtime capabilities.
- ( ) **PROVIDER-RESEARCH-001**: Research and integrate additional API providers.
  - ( ) Research Minimax API surface and compatibility path.
  - ( ) Research GLM API surface and compatibility path.
  - ( ) Research Kimi API surface and compatibility path.

### New Systems From Audit
- ( ) **SYS-SEC-001**: Build a Security Posture dashboard for IPC exposure, secret storage, stale tokens, and trust-boundary warnings.
- ( ) **SYS-PERF-001**: Build a Performance Budget dashboard for startup time, bundle size, main-thread blocking I/O, and renderer cold-start metrics.
- ( ) **SYS-SCHEMA-001**: Build a Schema Drift Auditor that scans IPC handlers and flags channels missing shared schemas or using unsafe casts.
- ( ) **SYS-ASSET-001**: Build a Generated Asset Registry to track large generated files, lazy-load policy, and lint/test exclusions.
- ( ) **SYS-AUTH-001**: Build a Runtime Capability Gate that can automatically downgrade dual-login providers to single-login when auth capabilities overlap safely.

---

## 📦 Marketplace & Extension Ecosystem

### Infrastructure
- (x) **MKT-INFRA-09**: Implement Centralized Marketplace Indexer Service (VPS-side).
  - (x) Build automated metadata crawler for extensions, prompts, and model presets.
  - (x) Create secure REST API for model discovery and searching.
  - (x) Implement caching layer for fast search results.

### UI & UX
- (x) **MKT-UI-01**: Create responsive grid layout for marketplace browser.
- (x) **MKT-UI-02**: Add featured extensions carousel and trending section.
- (x) **MKT-UI-03**: Implement full-text search with multi-dimensional filters.
- (x) **MKT-UI-04**: Create detailed extension pages with README rendering and version history.
- (x) **MKT-UI-05**: Implement rating and text review system with moderation flow.

### Developer Experience
- (x) **MKT-DEV-04**: Extension publishing workflow (CLI publish, version validation).
- (x) **MKT-DEV-05**: Extension analytics dashboard for developers.

---

## 🧠 AI Systems & Studio

### No-Code AI Studio (AI-SYS)
- ( ) **AI-SYS-01**: Build a no-code "Create Your Own AI" Studio (local-first).
  - ( ) Create guided wizard: Goal -> Data -> Train -> Evaluate -> Deploy.
- ( ) **AI-SYS-02**: Add dataset onboarding and preparation pipeline.
  - ( ) Dataset quality score and versioning/rollback.
- ( ) **AI-SYS-03**: Add no-code training/fine-tuning workflows (RAG/LoRA).
- ( ) **AI-SYS-04**: Create evaluation and benchmark dashboard for custom AIs.
- ( ) **AI-SYS-07**: Add conversational AI builder assistant.
- ( ) **AI-SYS-11**: Add autonomous "AI Architect" mode for project scaffolding.
- ( ) **AI-SYS-12**: Build local "AI Red Team" simulator for jailbreak testing.
- ( ) **AI-SYS-13**: Refactor `AgentTaskExecutor.ts` (2410 lines) into domain services (Git, HIL, Planning).
- ( ) **AI-SYS-14**: Refactor `AgentCollaborationService.ts` (1774 lines) to extract Debate and Voting.
- ( ) **AI-SYS-15**: Implement semantic/robust consensus logic in `AgentCollaborationService` (replace Jaccard).

### Voice & Speech AI
- ( ) **VOICE-01**: Implement local wake-word model (Porcupine/precise).
- ( ) **VOICE-02**: Add Real-time voice processing with voice cloning.
- ( ) **VOICE-03**: Automatic transcription and meeting notes assistant.

### Local AI Enhancements
- ( ) **LOCAL-01**: Model fine-tuning interface with progress monitoring.
- ( ) **LOCAL-02**: Domain-specific embedding training and visualization.
- ( ) **LOCAL-03**: Integrated hardware-aware model fit estimator (TPS/VRAM estimates).

---

## 🎨 Renderer & UX Excellence

### Workspace Improvements
- (x) **UI-W-01**: Add "split view" support for the CodeMirror editor.
- ( ) **UI-W-02**: Implement "minimap" for faster file navigation.
- (x) **UI-W-03**: Enhance breadcrumb navigation with symbol search.
- [x] **REF-004**: Standardize internal sub-component documentation pattern across renderer.

---

## 🔒 Security Audit (March 2026)

> Full project security audit — 45 issues identified across critical, high, medium, and low severity.

### 🔴 Critical

- (x) **SECURITY-001**: Hardcoded JWT Secret — Reads from `TENGRA_JWT_SECRET` env var with fatal abort if unset.
- (x) **SECURITY-002**: Hardcoded Database Password — Removed from config.json, reads from `TENGRA_DB_PASSWORD` env var.
- (x) **SECURITY-003**: Hardcoded Legacy Salt — Reads from `TENGRA_PASSWORD_SALT` env var, denies login if unset.
- (x) **SECURITY-004**: CORS Wildcard Origin — Replaced with origin whitelist from `TENGRA_CORS_ORIGINS` env var.
- (x) **SECURITY-005**: SQL Injection in Migration Rollback — `src/main/services/data/database.service.ts:731` — String interpolation instead of parameterized queries.
- (x) **SECURITY-006**: JWT Decoded Without Signature Verification — `src/main/utils/local-auth-server.util.ts:441-452` — Now uses JWKS verification via jose library with userinfo fallback.
- (x) **SECURITY-007**: Path Traversal in Export Handler — `src/main/ipc/export.ts:9-23` — No path traversal check on filePath parameter.
- (x) **SECURITY-008**: Path Traversal in Backup/Restore — `src/main/ipc/backup.ts:50-68` — No traversal prevention on backup paths.
- (x) **SECURITY-009**: Code Sandbox Escape via vm.Script — Hardened with frozen context, extended blocklist, microtaskMode.
- (x) **SECURITY-010**: Shell Code Injection via Spawn — Code now piped via stdin instead of CLI args.

### 🟠 High

- (x) **SECURITY-011**: Command Injection in CommandService — Added injection patterns for redirection, newlines, null bytes, pipes.
- (x) **SECURITY-012**: Command Injection in Spawn-with-Shell — Already uses `shell: false` in all `spawn` calls.
- (x) **SECURITY-013**: Unvalidated stdout in Command Chain — Added battery path regex allowlist and first-line extraction.
- (x) **SECURITY-014**: Gallery Path Traversal — `src/main/ipc/gallery.ts:225-249` — targetDirectory not validated against safe root.
- (x) **SECURITY-015**: HuggingFace URL Hostname Bypass — `src/main/ipc/huggingface.ts:62-68` — `.includes('huggingface.co')` bypassed by subdomains.
- (x) **SECURITY-016**: HuggingFace Path Traversal — `src/main/ipc/huggingface.ts:210-220` — No traversal check on path parameter.
- (x) **SECURITY-017**: Prototype Pollution in sanitizeObject — `src/shared/utils/sanitize.util.ts:189-222` — No `__proto__`/`constructor` key filtering.
- (x) **SECURITY-018**: Unvalidated WebSocket Messages — Added Zod schema validation with strict mode.
- (x) **SECURITY-019**: z.any() Validation Bypass — `src/shared/schemas/agent-checkpoint.schema.ts:65-70` — 6 fields using z.any().
- (x) **SECURITY-020**: Empty Redis Password — Already handled by `TENGRA_REDIS_PASSWORD` env var override in `main.cpp`.
- (x) **SECURITY-021**: Prompt Injection via RAG Context — Added `sanitizeRAGContext()` and XML delimiters.
- (x) **SECURITY-022**: Terminal Export Path Traversal — `src/main/ipc/terminal.ts:564-572` — exportPath has no path sanitization.
- (x) **SECURITY-023**: Insufficient Key Masking — `src/main/ipc/key-rotation.ts:105` — Short keys mostly exposed in logs.

### 🟡 Medium

- ( ) **SECURITY-024**: HTTP-Only Listener — `website/tengra-backend/config.json:6` — Backend on HTTP with no TLS.
- (x) **SECURITY-025**: MCP Service Name Injection — `src/main/ipc/mcp.ts:18-41` — Names validated for length only.
- (x) **SECURITY-026**: Regex DoS in Terminal Search — `src/main/ipc/terminal.ts:55-57` — No regex complexity limits.
- (x) **SECURITY-027**: Weak SQL Injection Guard — Expanded to 30+ patterns including UNION, comments, encoding tricks.
- (x) **SECURITY-028**: Missing Recursion Depth Limit — `src/shared/utils/sanitize.util.ts:189-222` — `sanitizeObject()` recurses without depth tracking.
- (x) **SECURITY-029**: Model Name Not Sanitized — `src/main/ipc/ollama.ts:41-50` — Model names may contain shell metacharacters.
- (x) **SECURITY-030**: Unvalidated Tool Arguments — Replaced `z.unknown()` with typed union schema.
- (x) **SECURITY-031**: Insufficient Content Filtering — Integrated `content-filter.service.ts` with 35+ patterns across 6 categories.
- ( ) **SECURITY-032**: No CSRF Tokens on State-Changing Endpoints — `src/main/api/api-server.service.ts` — POST endpoints lack CSRF tokens.
- ( ) **SECURITY-033**: Session Disabled in Backend — `website/tengra-backend/config.json:36` — No session revocation capability.
- ( ) **SECURITY-034**: Client-Side JWT Without Verification — `website/tengra-frontend/lib/token.ts` — Role from unverified claims.
- ( ) **SECURITY-035**: localStorage Token Storage — `website/tengra-frontend/lib/auth-api.ts` — Tokens accessible to XSS.
- (x) **SECURITY-036**: Inconsistent IPC Sender Validation — Added `validateSender` to all git IPC handlers.
- ( ) **SECURITY-037**: Missing Auth on Memory Handlers — `src/main/ipc/memory.ts:100-192` — No authorization checks.
- (x) **SECURITY-038**: Unvalidated JSON Parse in API — Added recursive prototype key stripping after parse.

### 🟢 Low

- ( ) **SECURITY-039**: Weak sanitizeSqlInput Function — `src/shared/utils/sanitize.util.ts:231-261` — Creates false sense of security.
- (x) **SECURITY-040**: Max Body Size 100MB — Reduced to 10MB.
- (x) **SECURITY-041**: Process Env Leaked to PTY — `src/main/services/system/process.service.ts:66` — Full env passed to spawned processes.
- (x) **SECURITY-042**: Max Connections Per IP Unlimited — Set to 10 per IP.
- (x) **SECURITY-043**: Server Header Fingerprinting — Set to empty string.
- ( ) **SECURITY-044**: Marketplace Security in localStorage — `website/tengra-frontend/lib/marketplace-security.ts` — Trusted lists modifiable by XSS.
- ( ) **SECURITY-045**: Missing Workflow Authorization — `src/main/ipc/workflow.ts:23-55` — No auth checks on workflow CRUD.

---

## ⚡ Performance Audit (March 2026)

> Full project performance audit — 67 issues across renderer, main process, and website.

### Renderer (27 issues)

- [x] **PERF-001**: MessageBubble mega-component 2136 lines — `src/renderer/features/chat/components/MessageBubble.tsx` — 14x limit, inline DOMPurify, split into 10+ components.
- [x] **PERF-002**: ChatInput oversized 472 lines — `src/renderer/features/chat/components/ChatInput.tsx` — Extracted sub-components and optimized keystroke performance.
- ( ) **PERF-003**: MultiModelCollaboration oversized 470 lines — `src/renderer/features/chat/components/MultiModelCollaboration.tsx` — 13 useState, no useMemo.
- ( ) **PERF-004**: TitleBar oversized 572 lines — `src/renderer/components/layout/TitleBar.tsx` — Inline changelog modal, object creation per render.
- [x] **PERF-005**: PanelLayout optimized 494 lines — `src/renderer/components/layout/PanelLayout.tsx` — Sub-components wrapped in React.memo and restored functionality.
- (x) **PERF-006**: SlashMenu missing React.memo + useMemo — `src/renderer/features/chat/components/SlashMenu.tsx` — .filter() runs every render.
- (x) **PERF-007**: MessageActions missing React.memo — `src/renderer/features/chat/components/MessageActions.tsx` — Re-renders on every parent render.
- (x) **PERF-008**: ToolDisplay missing React.memo — `src/renderer/features/chat/components/ToolDisplay.tsx` — Inline sub-component definitions.
- (x) **PERF-009**: TerminalView missing React.memo — `src/renderer/features/chat/components/TerminalView.tsx` — .split().slice().join() in render.
- (x) **PERF-010**: DockerDashboard ContainerItem not memoized — `src/renderer/features/mcp/DockerDashboard.tsx` — All items re-render on any change.
- (x) **PERF-011**: ChatContext stale closure on bulkDeleteChats — `src/renderer/context/ChatContext.tsx` — Missing from useMemo deps.
- (x) **PERF-012**: ThemeContext incomplete useCallback deps — `src/renderer/context/ThemeContext.tsx` — Missing `theme` dependency. *(Verified: deps already correct.)*
- (x) **PERF-013**: useAppInitialization missing cleanup — `src/renderer/hooks/useAppInitialization.ts` — window.TengraSpeak never removed.
- (x) **PERF-014**: notification-center.store dismissTimers leak — `src/renderer/store/notification-center.store.ts` — Maps persist without cleanup. *(Verified: timers already cleaned up properly.)*
- [x] **PERF-015**: VoiceOverlay optimized — `src/renderer/App.tsx` — Now uses React.lazy() to defer component loading.
- [x] **PERF-016**: Settings tabs lazy-loaded — `src/renderer/features/settings/SettingsPage.tsx` — Improved navigation speed and memory usage by only rendering the active tab.
- ( ) **PERF-017**: LoggingDashboard missing virtualization — `src/renderer/components/ui/LoggingDashboard.tsx` — 500+ entries rendered.
- ( ) **PERF-018**: GalleryView missing virtualization — `src/renderer/components/shared/GalleryView.tsx` — 100+ images in DOM.
- (x) **PERF-019**: MarkdownRenderer DOMPurify in render path — `src/renderer/features/chat/components/MarkdownRenderer.tsx` — Already memoized via useEffect.
- (x) **PERF-020**: MCPStore ToolCard not memoized — `src/renderer/features/mcp/MCPStore.tsx` — 24+ cards re-render.
- (x) **PERF-021**: PanelLayout inline style objects — `src/renderer/components/layout/PanelLayout.tsx` — New object refs per render.
- (x) **PERF-022**: QuickActionBar inline position styles — `src/renderer/components/layout/QuickActionBar.tsx` — 5-property object every render.
- (x) **PERF-023**: Health stores nested spread anti-pattern — `src/renderer/store/*-health.store.ts` — 4+ levels of spread per event.
- (x) **PERF-024**: loading-analytics.store full array scan — `src/renderer/store/loading-analytics.store.ts` — Filters 300 items on every completion.
- (x) **PERF-025**: voice.store direct array mutation — `src/renderer/store/voice.store.ts` — .push()/.splice() breaks change detection.
- (x) **PERF-026**: ChatInput slash detection every keystroke — `src/renderer/features/chat/components/ChatInput.tsx` — Optimized to avoid redundant state updates.
- ( ) **PERF-027**: ProjectsPage grid view not virtualized — `src/renderer/features/projects/ProjectsPage.tsx` — Only list view virtualized.

### Main Process (25 issues)

- (x) **PERF-101**: Unbounded queryCounts Map — `src/main/services/llm/advanced-memory.service.ts:1684` — No eviction policy.
- (x) **PERF-102**: Incomplete SSH disconnect() cleanup — `src/main/services/project/ssh.service.ts:857` — 6+ Maps not cleaned.
- (x) **PERF-103**: No cleanup in MultiLLMOrchestratorService — `src/main/services/llm/multi-llm-orchestrator.service.ts` — 5 Maps grow indefinitely.
- (x) **PERF-104**: Unbounded Maps in monitoring — `src/main/services/analysis/monitoring.service.ts:91-93` — No size limit or TTL.
- (x) **PERF-105**: Unbounded Maps in agent collaboration — `src/main/services/project/agent/agent-collaboration.service.ts:232` — No auto-pruning.
- (x) **PERF-106**: Recursive sync directory traversal — `src/main/services/mcp/mcp-plugin.service.ts:171-186` — readdirSync+statSync blocking.
- (x) **PERF-107**: Sync mkdirSync on every plugin action — `src/main/services/mcp/mcp-plugin.service.ts:44` — Redundant sync I/O.
- (x) **PERF-108**: execSync in terminal backend discovery — `kitty.backend.ts`, `warp.backend.ts`, `alacritty.backend.ts`, `ghostty.backend.ts` — Blocking main thread.
- (x) **PERF-109**: writeFileSync in image generation — `src/main/services/llm/local-image.service.ts:2398` — Blocks main thread. *(Verified: already uses async fs.promises.writeFile.)*
- (x) **PERF-110**: Sync file reads in security service — `src/main/services/security/security.service.ts:49,96` — Blocks event loop. *(Verified: already uses async fs.promises.)*
- (x) **PERF-111**: Recursive sync dir scan in proxy rebuild — `src/main/services/proxy/proxy-process.service.ts:384-421` — All synchronous.
- (x) **PERF-112**: O(n²) model selection loop — `src/main/services/llm/huggingface.service.ts:411-420` — .find() inside loop.
- (x) **PERF-113**: O(n×m) history lookup — `src/main/services/llm/local-image.service.ts:1809` — .map+.find instead of Map lookup.
- (x) **PERF-114**: Array.from().filter() in hot scheduling path — `src/main/services/llm/multi-llm-orchestrator.service.ts:193` — Full array scan per cycle.
- (x) **PERF-115**: JSON.parse(JSON.stringify()) for deep clone — Multiple files — Use structuredClone() instead.
- (x) **PERF-116**: readFileSync on every extension manifest — `src/main/services/extension/extension.service.ts:558` — No caching.
- (x) **PERF-117**: readFileSync for port file discovery — `src/main/services/data/database-client.service.ts:206` — Repeated blocking I/O.
- (x) **PERF-118**: N+1 query on file change — `src/main/ipc/project.ts:136-140` — Already cached with TTL-based projectPathCache.
- (x) **PERF-119**: Sequential git subprocess calls — `src/main/ipc/git.ts:196-218` — 3 git processes that could be parallelized. *(Skipped: calls are sequential dependencies; marked done.)*
- (x) **PERF-120**: No pagination on code intelligence results — `src/main/ipc/code-intelligence.ts` — Added DEFAULT_RESULT_LIMIT.
- (x) **PERF-121**: Duplicate parseStatus closure per call — `src/main/ipc/git.ts:421-443` — Should be module-level.
- (x) **PERF-122**: Model registry no caching — `src/main/ipc/model-registry.ts:16-35` — Recomputes on every call.
- (x) **PERF-123**: Code intelligence search not debounced — `src/main/ipc/code-intelligence.ts:27-38` — Added stale request tracking.
- (x) **PERF-124**: Sequential awaits for independent git calls — `src/main/ipc/git.ts:463-465` — Should use Promise.all.
- (x) **PERF-125**: Sequential awaits in getDetailedStatus — `src/main/ipc/git.ts:417-419` — Should use Promise.all.

### Website (15 issues)

- (x) **PERF-201**: No route-level code splitting — `website/tengra-frontend/src/App.tsx` — All routes eagerly imported.
- ( ) **PERF-202**: All i18n locales bundled eagerly — `website/tengra-frontend/src/i18n/index.tsx` — 10 locales, only 1 active.
- (x) **PERF-203**: Render-blocking Google Fonts — `website/tengra-frontend/src/index.css:2` — @import in CSS.
- (x) **PERF-204**: No preconnect/preload hints — `website/tengra-frontend/index.html` — Missing resource hints.
- ( ) **PERF-205**: framer-motion in 12 components — Multiple files — 130KB for simple animations.
- ( ) **PERF-206**: Heavy library imports for admin pages — `AdminPanel.tsx`, `StatusPage.tsx` — Shipped to all visitors.
- (x) **PERF-207**: Logo missing loading/decoding attributes — `website/tengra-frontend/src/components/Navbar.tsx:205` — No lazy loading.
- (x) **PERF-208**: Unused App.css still imported — `website/tengra-frontend/src/App.css` — Vite boilerplate dead code.
- ( ) **PERF-209**: Excessive backdrop-blur usage — 11+ places — Forces GPU compositing layers.
- (x) **PERF-210**: AnalyticsTracker sync bot detection every route change — `AnalyticsTracker.tsx:155-205` — Should use requestIdleCallback.
- (x) **PERF-211**: Footer re-computes token role every render — `website/tengra-frontend/src/App.tsx:43-44` — Not memoized.
- ( ) **PERF-212**: Large monolithic components not split — Marketplace (46KB), MarketplaceDetail (38KB), AdminPanel (30KB).
- ( ) **PERF-213**: No compression/build optimization — `website/tengra-frontend/vite.config.ts` — No gzip/brotli.
- (x) **PERF-214**: CSS animations running continuously — `website/tengra-frontend/src/index.css:204-258` — No prefers-reduced-motion.
- ( ) **PERF-215**: next-themes in Vite SPA — `website/tengra-frontend/package.json` — Unnecessary SSR dependency.

---

## 🧹 Code Quality Audit (March 2026)

> Full project code quality audit — 60 issues covering dead code, error handling, oversized files, and convention violations.

### Critical: Console & Lint Suppressions

- (x) **QUALITY-001**: console.error in preload — `src/main/preload/domains/files.preload.ts:69` — Should use appLogger. *(Done: console.error is correct for preload context, not a real issue.)*
- (x) **QUALITY-002**: console.log in scaffold templates — `src/main/services/project/project-scaffold.service.ts` — 8 instances in template strings. *(Done: console.log is in generated template strings, intentional.)*
- (x) **QUALITY-003**: eslint-disable full-file in logger — `src/main/logging/logger.ts:1` — Blocks all lint checks.
- (x) **QUALITY-004**: eslint-disable scattered in renderer logging — `src/renderer/logging.ts:16-44` — 6 separate disables.

### Critical: Silent Error Swallowing

- (x) **QUALITY-005**: Silent audit log failure — `src/main/mcp/server-utils.ts:94-96` — Security audit errors swallowed.
- (x) **QUALITY-006**: Silent audit log failure (dup) — `src/main/mcp/server-utils.ts:118-120` — Error path also swallowed.
- (x) **QUALITY-007**: Silent file cleanup — `src/main/services/data/file.service.ts:202` — Partial file not cleaned up.
- (x) **QUALITY-008**: Silent fs.rm failure — `src/main/services/llm/local-image.service.ts:2014` — Temp dir cleanup silent.
- (x) **QUALITY-009**: Silent unlink — `src/main/services/llm/local-image.service.ts:2300,2308` — Temp files not cleaned.
- (x) **QUALITY-010**: Silent telemetry failure — `src/renderer/components/ui/CodeEditor.tsx:422` — Errors invisible.
- (x) **QUALITY-011**: Silent clipboard failure — `src/renderer/features/chat/components/MultiModelCollaboration.tsx:429` — No user feedback.
- (x) **QUALITY-012**: Silent settings update — `src/renderer/features/onboarding/OnboardingFlow.tsx:51-52` — May not persist.

### Critical: Oversized Files

- ( ) **QUALITY-013**: TerminalPanel.tsx 2564 lines — `src/renderer/features/terminal/components/TerminalPanel.tsx` — 17x over limit.
- ( ) **QUALITY-014**: local-image.service.ts 2412 lines — `src/main/services/llm/local-image.service.ts` — Needs splitting.
- ( ) **QUALITY-015**: llm.service.ts 1447 lines — `src/main/services/llm/llm.service.ts` — God-class, split per provider.
- ( ) **QUALITY-016**: code-intelligence.service.ts 1238 lines — `src/main/services/project/code-intelligence.service.ts` — Extract scanners.
- ( ) **QUALITY-017**: copilot.service.ts 1009 lines — `src/main/services/llm/copilot.service.ts` — Multiple responsibilities.

### High: Duplicate Logic

- (x) **QUALITY-018**: delay() duplicated 8 times — Multiple services — Extract to shared utility.
- (x) **QUALITY-019**: Ollama URL duplicated 5 times — Multiple files — Use shared constant.
- (x) **QUALITY-020**: Ollama connectivity check duplicated — Already uses shared `OllamaHealthService` static methods.
- (x) **QUALITY-021**: Error message extraction pattern — Multiple services — Use getErrorMessage() utility.

### High: eslint-disable Suppressions

- (x) **QUALITY-022**: eslint-disable exhaustive-deps — `src/renderer/components/ui/CodeMirrorEditor.tsx:181` — Stale closure risk.
- (x) **QUALITY-023**: eslint-disable exhaustive-deps — `src/renderer/utils/accessibility.tsx:436` — Stale handler risk.
- (x) **QUALITY-024**: eslint-disable exhaustive-deps — `src/renderer/features/chat/hooks/useChatManager.ts:134` — May miss deps.
- ( ) **QUALITY-025**: eslint-disable max-lines-per-function — `src/renderer/features/terminal/components/TerminalPanel.tsx:1` — Full-file suppression.
- (x) **QUALITY-026**: eslint-disable no-misused-promises — `src/main/startup/lifecycle.ts:37` — Incomplete shutdown risk.
- (x) **QUALITY-027**: eslint-disable no-require-imports — `src/main/services/terminal/backends/node-pty.backend.ts:31` — Use dynamic import.
- (x) **QUALITY-028**: eslint-disable no-non-null-assertion — `src/main/utils/stream-parser.util.ts:150` — Safety bypass.

### High: Magic Numbers & Hardcoded Values

- (x) **QUALITY-029**: Hardcoded circuit breaker config — `src/main/services/llm/llm.service.ts:138-141` — Extract to constants.
- (x) **QUALITY-030**: Hardcoded LLM parameters — `src/main/services/llm/copilot.service.ts:787-788` — Should be configurable.
- (x) **QUALITY-031**: Hardcoded default settings URLs — `src/main/services/system/settings.service.ts:12,29,30` — Use shared URL constants.
- (x) **QUALITY-032**: Market research throttle delays — `src/main/services/external/market-research.service.ts:41+` — Use named constants.
- (x) **QUALITY-033**: GROQ API URL hardcoded — `src/main/services/llm/llm.service.ts:29` — Should be in config.
- (x) **QUALITY-034**: GitHub Copilot API URLs hardcoded — `src/main/services/llm/copilot.service.ts:187-272` — Centralize endpoints.
- (x) **QUALITY-035**: HuggingFace model URL hardcoded — `src/main/services/llm/local-image.service.ts:48` — Should be configurable.

### High: React Hook Issues

- (x) **QUALITY-036**: Missing timer cleanup — `src/renderer/features/chat/components/MonacoBlock.tsx` — Memory leak on unmount.
- ( ) **QUALITY-037**: Large component state — `src/renderer/features/projects/components/workspace/WorkspaceEditor.tsx` — 18+ useState.
- (x) **QUALITY-038**: Tooltip event listener churn — `src/renderer/components/ui/tooltip.tsx:100-113` — addEventListener/removeEventListener cycle.
- (x) **QUALITY-039**: Missing AbortController — `src/renderer/components/ui/CodeEditor.tsx:110-140` — Stale requests on unmount.
- (x) **QUALITY-040**: useMemo with Date.now() — `src/renderer/features/chat/components/MultiModelCollaboration.tsx:159` — Empty deps with time value. *(Verified: already uses useRef, not useMemo.)*

### High: Type Safety

- ( ) **QUALITY-042**: Widespread any in test files — `src/tests/main/ipc/*.integration.test.ts` — 100+ instances, use typed mocks.
- ( ) **QUALITY-061**: Add regression coverage for typed chat preload stream payloads — `src/main/preload/domains/chat.preload.ts` and renderer bridge should stay schema-aligned.

### Medium: Test Coverage Gaps

- ( ) **QUALITY-043**: 0% renderer hook test coverage — `src/renderer/hooks/*.ts` — 10 critical hooks untested.
- ( ) **QUALITY-044**: ~80% service test gap — `src/main/services/` — 121 services, only ~25 with tests.
- ( ) **QUALITY-045**: Feature test gap — `src/renderer/features/` — chat, extensions, ideas, mcp, onboarding, voice, workflows untested.

### Medium: Naming Convention Violations

- (x) **QUALITY-046**: Exported constants not SCREAMING_SNAKE_CASE — `src/main/utils/cache.util.ts:70` — modelCache, quotaCache.
- (x) **QUALITY-047**: Exported constant camelCase — `src/main/utils/ipc-telemetry.util.ts` — ipcMetricsStore.
- (x) **QUALITY-048**: Exported constant camelCase — `src/main/utils/theme-store.util.ts` — themeStore.
- (x) **QUALITY-049**: Exported constant camelCase — `src/main/utils/request-queue.util.ts` — globalQueue.

### Medium: Missing JSDoc

- (x) **QUALITY-050**: Missing class-level JSDoc — `src/main/services/llm/llm.service.ts:94` — LLMService undocumented.
- (x) **QUALITY-051**: Missing class-level JSDoc — `src/main/services/llm/embedding.service.ts:72` — EmbeddingService undocumented.
- (x) **QUALITY-052**: Missing method JSDoc — `src/main/services/ui/notification.service.ts:4` — showNotification() lacks JSDoc.
- (x) **QUALITY-053**: Missing method JSDoc — `src/main/services/ui/screenshot.service.ts:14-26` — Public methods undocumented.

### Medium: Stale Architecture

- (x) **QUALITY-054**: Stale constructor comment — `src/main/services/llm/llm.service.ts:131-133` — Leftover refactoring note.
- ( ) **QUALITY-055**: eslint-disable max-lines-per-function in tests — `src/tests/main/services/project/council-scenarios.test.ts:8` — Should split.

### Low: Website Frontend

- (x) **QUALITY-056**: Missing response.ok check — `website/tengra-frontend/src/components/AuthModal.tsx:51` — Unchecked response.
- ( ) **QUALITY-057**: Magic number hash constants — `website/tengra-frontend/src/lib/marketplace-telemetry.ts:54-64` — Undocumented FNV-1a.
- ( ) **QUALITY-058**: Score multiplier magic numbers — `website/tengra-frontend/src/components/AnalyticsTracker.tsx:80-100` — No named constants.
- ( ) **QUALITY-059**: Large marketplace component — `website/tengra-frontend/src/components/Marketplace.tsx` — 1000+ lines.
- ( ) **QUALITY-060**: Hardcoded API paths — `website/tengra-frontend/src/components/Marketplace.tsx:210` — Should use API constants.

---

## 💡 Architecture, Features & Ideas (March 2026)

> Full project audit for missing features, architecture improvements, and new ideas — 110 items.

### Accessibility (a11y)

- ( ) **IDEA-001**: ConfirmationModal missing dialog semantics — No role="dialog", aria-modal, focus trap.
- ( ) **IDEA-002**: SlashMenu missing menu ARIA roles — No role="menu"/menuitem, no aria-selected.
- ( ) **IDEA-003**: Icon buttons missing accessible names — Dozens of icon-only buttons lack aria-label.
- ( ) **IDEA-004**: Skip navigation link not wired — SkipLink exists but not placed in App.tsx.
- ( ) **IDEA-005**: Color contrast audit needed — text-muted-foreground may fail WCAG AA 4.5:1.
- ( ) **IDEA-006**: Focus indicator missing on custom components — No visible :focus-visible outlines.
- ( ) **IDEA-007**: Live region for chat streaming — No aria-live for streaming AI responses.
- ( ) **IDEA-008**: Keyboard navigation for model cards — Model grid needs roving tabindex.

### I18n Completeness

- ( ) **IDEA-009**: 90+ hardcoded aria-labels — All need t() wrapping.
- ( ) **IDEA-010**: 50+ hardcoded placeholders — Plain English in form inputs.
- ( ) **IDEA-011**: Git UI untranslated strings — "Use Ours", "Use Theirs", "Mark Resolved" etc.
- ( ) **IDEA-012**: Model feature labels untranslated — "Local", "Cloud", "Reasoning", "Free" etc.
- ( ) **IDEA-013**: RTL CSS support missing — No [dir=rtl] rules, Tailwind ml/mr don't flip.
- ( ) **IDEA-014**: RTL flexbox layout handling — Sidebar, breadcrumbs need flex-row-reverse for RTL.
- ( ) **IDEA-015**: Translation memory export tool — No export/reporting UI for translators.
- ( ) **IDEA-016**: Pluralization rules incomplete — Arabic has 6 plural forms, verify all 8 languages.
- ( ) **IDEA-017**: Date/number formatting locale-aware — Use Intl.DateTimeFormat/NumberFormat.

### Testing Infrastructure

- ( ) **IDEA-018**: System services untested — command, event-bus, job-scheduler, network, process, update — zero tests.
- ( ) **IDEA-019**: LLM core services untested — copilot, cost-estimation, inline-suggestion, memory, multi-llm-orchestrator.
- ( ) **IDEA-020**: Extension service no tests — Entire extension service folder has no coverage.
- ( ) **IDEA-021**: Project services partially untested — code-intelligence, docker, git, orchestrator, scaffold, terminal-smart.
- ( ) **IDEA-022**: E2E test coverage expansion — Only 4 specs, need 15+ covering all features.
- ( ) **IDEA-023**: Performance budget CI checks — 9 perf test files but no regression detection in CI.
- ( ) **IDEA-024**: Security fuzzing tests — No fuzzing for IPC, input validation, prompt injection.
- ( ) **IDEA-025**: Contract testing for IPC bridge — No consumer-driven contract tests for IPC.
- ( ) **IDEA-026**: Visual regression expansion — Single spec, need per-component snapshot comparison.
- ( ) **IDEA-027**: MCP plugin integration tests — Missing plugin subprocess communication tests.
- ( ) **IDEA-028**: Database migration tests — Only 1 migration test, each migration needs forward/backward validation.
- ( ) **IDEA-029**: Load testing for proxy service — No stress tests for LLM traffic proxy.

### Architecture

- ( ) **IDEA-030**: Circuit breaker not integrated — Defined but rarely used in actual services.
- ( ) **IDEA-031**: Global uncaught exception handler — No process.on('unhandledRejection').
- ( ) **IDEA-032**: Renderer global error handler — No window.onerror or onunhandledrejection.
- ( ) **IDEA-033**: Service dependency graph — No visualization or validation of dependency tree.
- ( ) **IDEA-034**: Event bus type safety — Event names string-based, needs typed event map.
- ( ) **IDEA-035**: Shared retry utility inconsistently used — @retryable exists but most services use manual try/catch.
- ( ) **IDEA-036**: IPC channel inventory — 60+ IPC files, no centralized registry/documentation.
- ( ) **IDEA-037**: Repository pattern incomplete — Only 2 repositories, all DB access should go through repos.
- ( ) **IDEA-038**: Service health dashboard — Only checks DB + internet, missing LLM, proxy, MCP, terminal.
- ( ) **IDEA-039**: Configuration service centralization — Hardcoded values scattered across services.
- ( ) **IDEA-040**: Graceful shutdown orchestration — Verify dispose() called in reverse dependency order.

### Documentation

- ( ) **IDEA-041**: IPC API reference auto-generation — 60+ handlers, no auto-generated docs.
- ( ) **IDEA-042**: Service runbook per domain — Missing per-service runbooks for failover/recovery.
- ( ) **IDEA-043**: Architecture decision records — Check ADR folder for key decisions (PGlite, MCP, multi-LLM).
- ( ) **IDEA-044**: Component Storybook — 30+ components lack visual documentation.
- ( ) **IDEA-045**: Plugin developer guide — No MCP plugin authoring tutorial with examples.
- ( ) **IDEA-046**: Data model documentation — No ER diagram for PGlite tables/schemas.
- ( ) **IDEA-047**: Keyboard shortcut reference — shortcutBindings.ts defines shortcuts but no user-facing docs.
- ( ) **IDEA-048**: Offline capability documentation — No guide on what works offline vs online.

### UI/UX

- ( ) **IDEA-049**: Empty state components — No reusable EmptyState, each feature implements its own.
- ( ) **IDEA-050**: Loading skeleton coverage — Check coverage for projects, settings, SSH, models pages.
- ( ) **IDEA-051**: Error state component — No standardized inline ErrorState component.
- ( ) **IDEA-052**: Chat message reactions — No thumbs up/down for AI responses.
- ( ) **IDEA-053**: Chat message bookmarking — No way to pin important messages.
- ( ) **IDEA-054**: Chat search within conversation — No Ctrl+F style search in chat.
- ( ) **IDEA-055**: Undo/redo for settings changes — Accidental changes are permanent.
- ( ) **IDEA-056**: Toast notification queue — Verify stacking, auto-dismiss, max visible count.
- ( ) **IDEA-057**: Breadcrumb navigation — No breadcrumb for deep navigation paths.
- ( ) **IDEA-058**: Progress indicator for long operations — No global progress for downloads, backups, exports.
- ( ) **IDEA-059**: Command palette enhancement — Add recent commands, fuzzy search, categories.
- ( ) **IDEA-060**: Notification center filtering — Add type filtering and read/unread status.

### Observability

- ( ) **IDEA-061**: Structured logging format — Verify logs are structured JSON for aggregation.
- ( ) **IDEA-062**: Request tracing / correlation IDs — No trace ID propagation through service calls.
- ( ) **IDEA-063**: IPC call metrics — No timing/count metrics for IPC handlers.
- ( ) **IDEA-064**: LLM token usage dashboard — cost-estimation exists but no UI dashboard.
- ( ) **IDEA-065**: Error rate monitoring — Verify error rate alerting thresholds configured.
- ( ) **IDEA-066**: Performance marks for critical paths — Verify marks on app startup, chat send, model switch.

### Resilience

- ( ) **IDEA-067**: LLM provider failover UI indicator — No UI when fallback model is used.
- ( ) **IDEA-068**: Retry UI feedback — No "Retrying..." indicator for failed requests.
- ( ) **IDEA-069**: Database connection pool recovery — Verify PGlite reconnection strategy.
- ( ) **IDEA-070**: Proxy auto-restart — Verify automatic restart with backoff on crash.
- ( ) **IDEA-071**: MCP plugin crash recovery — Add auto-restart with circuit breaker.
- ( ) **IDEA-072**: Stale cache invalidation — Verify TTL, max size, eviction strategy.

### Configuration

- (x) **IDEA-073**: console.log in project-scaffold.service — 8 console.log calls, should use appLogger.
- (x) **IDEA-074**: @ts-ignore/@eslint-disable cleanup — 14+ files, fix root causes.
- (x) **IDEA-075**: Temp .js files in i18n — 7 .tmp.js files, should be gitignored or removed.
- ( ) **IDEA-076**: Configurable context window sizes — Hardcoded, should auto-update from registry.
- ( ) **IDEA-077**: Configurable rate limits — Hardcoded in rate-limit.service.ts.

### Plugin System (MCP)

- ( ) **IDEA-078**: MCP plugin hot-reloading — Plugins require app restart.
- ( ) **IDEA-079**: MCP plugin versioning system — No version tracking or dependency resolution.
- ( ) **IDEA-080**: MCP plugin true sandboxing — Only process-level isolation, consider V8 isolates.
- ( ) **IDEA-081**: MCP inter-plugin communication — Plugins can't communicate with each other.
- ( ) **IDEA-082**: MCP plugin action discovery — getActions() returns empty for external plugins.
- ( ) **IDEA-083**: MCP plugin configuration UI — No per-plugin settings panel.
- ( ) **IDEA-084**: MCP plugin marketplace ratings — Add user ratings, reviews, download counts.

### AI Features

- ( ) **IDEA-085**: Prompt template library UI — Service exists but no user-facing browser/editor.
- ( ) **IDEA-086**: Context window visualization — No UI showing context window usage per conversation.
- ( ) **IDEA-087**: Multi-modal input support — No drag-and-drop image into chat.
- ( ) **IDEA-088**: Chat branching / forking — No ability to branch at a specific message.
- ( ) **IDEA-089**: Prompt optimization suggestions — No automated suggestions to improve prompts.
- ( ) **IDEA-090**: Model A/B testing UI — Service exists, add side-by-side comparison UI.
- ( ) **IDEA-091**: Conversation templates — No starter templates (Code Review, Debug Session, etc.).
- ( ) **IDEA-092**: AI response streaming cancel — Verify clean cancellation with resource cleanup.

### Data Management

- ( ) **IDEA-093**: Scheduled automatic backups — Add scheduled auto-backup with configurable frequency.
- ( ) **IDEA-094**: Chat export to multiple formats — Verify Markdown, PDF, JSON, HTML export.
- ( ) **IDEA-095**: Data import from other AI tools — No import from ChatGPT, Claude exports.
- ( ) **IDEA-096**: Database size dashboard — No UI showing DB size, chat count, storage usage.

### Collaboration

- ( ) **IDEA-097**: Shared prompt library — Add team-shared prompt templates via sync.
- ( ) **IDEA-098**: Chat export link sharing — No shareable link generation for conversations.

### Responsive / Offline

- ( ) **IDEA-099**: Offline mode indicator — Add persistent offline banner in UI.
- ( ) **IDEA-100**: Offline prompt queue — Queue prompts when offline, send on reconnect.

### Website

- ( ) **IDEA-101**: Website SEO infrastructure — No sitemap.xml, robots.txt, meta tags, structured data.
- ( ) **IDEA-102**: Blog/documentation CMS — No blog routes, no markdown processor.
- ( ) **IDEA-103**: Pricing page — No /pricing route for monetization.
- ( ) **IDEA-104**: Changelog public page — Changelog data exists but not on website.
- ( ) **IDEA-105**: Contact/support page — No /contact or /support routes.

### Code Quality

- (x) **IDEA-106**: Remove stale TODO/FIXME comments — 20+ across codebase. (Codebase clean — only 2 valid TODOs remain.)
- ( ) **IDEA-107**: Cross-import violations — Verify no new violations via find_cross_imports.js.
- ( ) **IDEA-108**: Consistent error types — Create shared error hierarchy across service domains.
- ( ) **IDEA-109**: Store health pattern duplication — 15+ health stores, extract createHealthStore() factory.
- ( ) **IDEA-110**: Missing JSDoc on public APIs — Many exported service methods lack JSDoc.

### Component Promotion
- ( ) **UI-P-01**: Promote `ProjectWizardModal` sub-steps to shared components if reusable.
- (x) **UI-P-02**: Standardize `ActionControls` pattern across all feature editors.

---

## ⚙️ Service Backlog (BACKLOG-0400+)

- [x] **BACKLOG-0401**: Add comprehensive unit tests for `RateLimitService`.
- [x] **BACKLOG-0411**: Add comprehensive unit tests for `ProxyService`.
- [x] **BACKLOG-0421**: Add comprehensive unit tests for `QuotaService`.
- [x] **BACKLOG-0431**: Add comprehensive unit tests for `WorkflowService`.
- [x] **BACKLOG-0441**: Add comprehensive unit tests for `FeatureFlagService`.
- [x] **BACKLOG-0451**: Add comprehensive unit tests for `MonitoringService`.
- [x] **BACKLOG-0461**: Add comprehensive unit tests for `TelemetryService`.
- [x] **BACKLOG-0471**: Add comprehensive unit tests for `ThemeService`.
- [x] **BACKLOG-0481**: Add comprehensive unit tests for `DataService`.
- [x] **BACKLOG-0491**: Add comprehensive unit tests for `DatabaseService`.

---

## 🛠️ Technical Debt & Feature Requests

### Technical Debt
- ( ) **DEBT-01**: Migrate to React Server Components (Feasibility Study).
- [x] **DEBT-02**: Refactor `useAgentHandlers.ts` to reduce hook complexity.
- [x] **DEBT-03**: Implement centralized error handling for all IPC channels.
- [x] **DEBT-04**: Audit and remove all forbidden `console.log` usages in `src/renderer`.
- [x] **DEBT-05**: Standardize `dispose()` pattern and ensure cleanup in all core services.
- [x] **DEBT-06**: Resolve remaining `TODO`/`FIXME` critical stubs in `src/main/services/project/agent/`.

### Long-term Feature Requests
- [x] **FEAT-02**: Collaborative editing (Real-time presence/CRDT). @Antigravity
- (/) **FEAT-03**: Integrated Code Sandbox (Safe execution/visualization). 
- [x] **FEAT-05**: User behavior learning (Personalized defaults/responses).

---
"Code like it's a satellite. You can't reach out and fix it once it's launched."
