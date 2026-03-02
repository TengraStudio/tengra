# Tengra Project - TODO List

> Last updated: 2026-03-01
> **Status: In Development (Consolidated)**

## Release Milestones

### v1.3.0 (Target: Q2 2026)
- [/] Marketplace system MVP (C++ Backend initialized)
- [ ] **SEC-H-002**: Audit all IPC handlers for `responseSchema` validation (Zod).
- [ ] **GATEWAY-001**: Secure Social Gateway Phase 1 (Relay Server MVP).
- [ ] **PERF-001**: Virtualize `MessageList` for large conversation handling.

### v1.4.0 (Target: Q3 2026)
- ( ) Extension system beta
- ( ) ComfyUI integration
- ( ) SSH tunneling
- [ ] **SEC-H-004**: Implementation of strict validation for all `spawn`/`exec` calls.
- [ ] **DEBT-002**: Modular refactor of `MessageBubble.tsx` (~2150 lines).
- [ ] **DEBT-005**: Refactor `IdeaGeneratorService.ts` (~2750 lines) into focused sub-modules.

### v2.0.0 (Target: Q4 2026)
- ( ) Plugin ecosystem
- ( ) Collaborative sessions
- ( ) **FEAT-006**: Agent Execution Trace visualization.
- ( ) Mobile companion app

---

## 🛡️ Core Infrastructure & Security

### Security Hardening (SEC)
- [ ] **SEC-H-002**: Audit all IPC handlers for `responseSchema` validation (Zod). — 70 raw `ipcMain.handle` calls remain.
- [ ] **SEC-H-003**: Converge `VoiceService` and `ExtensionService` to `createValidatedIpcHandler`.
- [ ] **SEC-H-004**: Audit all `child_process` and `shell` usage for injection vulnerabilities (CRITICAL).
- [ ] **SEC-H-005**: Re-verify `dangerouslySetInnerHTML` sanitization across the renderer (MessageBubble SVG, MarkdownRenderer).
- [ ] **SEC-H-006**: Implement strict Content Security Policy (CSP) for Renderer.

### Secure Social Gateway (GATEWAY)
- [ ] **GATEWAY-001**: Secure Social Gateway/Relay implementation.
  - [ ] **Phase 1**: Build C++ Relay Server (Drogon) in `website/tengra-backend`.
  - [ ] **Phase 2**: E2EE tunnel launcher in Tengra Main process (outbound only).
  - [ ] **Phase 3**: Social Media Webhook integration (Twitter, Telegram).
  - [ ] **Phase 4**: Self-hosting guide and Docker orchestration.

---

## ⚡ Performance & Scalability (PERF)

- [ ] **PERF-001**: Implement Virtualization for `MessageList` (react-window or similar).
- [ ] **PERF-002**: Optimize `MessageBubble` rendering (memoization audit, selective updates).
- [ ] **PERF-003**: [DONE] Refactor Multi-Model Collaboration component (extracted memoized components and hook).
- [ ] **PERF-004**: Batch IPC updates for high-frequency events (Streaming logs, terminals).
- [ ] **PERF-005**: Extract hardcoded `PREFERRED_MODELS` from `AdvancedMemoryService.ts:89` to settings.

---

## 🧹 Technical Debt & Code Quality (DEBT)

- [ ] **DEBT-01**: Refactor monolith services (over 1000 lines) into modular sub-services:
  - [ ] `IdeaGeneratorService.ts` (~2750 lines) -> `IdeaRepository`, `IdeaSessionManager`, `IdeaPromptBuilder`.
  - [ ] `AgentTaskExecutor.ts` (~2100 lines) -> `TaskStateMachine`, `ToolInvocationManager`, `TaskHistoryManager`.
  - [ ] `SSHService.ts` (~2200 lines) -> `SSHKeyManager`, `SSHTunnelManager`, `SSHConnectionPool`.
  - [ ] `AdvancedMemoryService.ts` (~2500 lines) -> `MemoryConsolidation`, `EmbeddingRetriever`, `MemoryBuffer`.
  - [ ] `MessageBubble.tsx` (~2150 lines) -> Extract sub-components (Actions, Content, Metadata, Status).
- [ ] **DEBT-02**: Memory Leak Audit & Cleanup:
  - [ ] Audit `AgentTaskExecutor.ts` `setupEventListeners` (lines 165-268) for missing `removeListener` calls.
  - [ ] Audit all services with `initialize()` for corresponding `dispose()` logic (MANDATORY).
- [ ] **DEBT-03**: Split `ChatInput.tsx` (500+ lines) and `ProxyService.ts` (1100+ lines).
- [ ] **DEBT-04**: Eliminate remaining production `as unknown as` debt in `src/main/services`.
- [ ] **LINT-001**: Eliminate all `eslint-disable` and `console.log` instances.
  - [ ] Refactor `sanitize.util.ts` to avoid control regex lint errors.
  - [ ] Complete `eslint-plugin-tengra` for automated NASA Power of Ten enforcement.

---

## 🚀 New System Features (FEAT)

- [ ] **FEAT-006**: **Agent Execution Trace**: Visual timeline of agent thoughts, tool calls, and results.
- [ ] **FEAT-007**: **Multi-Agent Collaboration**: Parallel execution mode where multiple LLMs work on the same task.
- [ ] **FEAT-008**: **Context Pinning**: UI to explicitly pin specific code files or snippets to session context.
- [ ] **FEAT-009**: **Advanced Quota Dashboard**: Real-time spending and limit tracking across all providers.
- [ ] **FEAT-010**: **Voice-Enabled Autonomous Loops**: Hands-free agent control via voice commands.

---

"Code like it's a satellite. You can't reach out and fix it once it's launched."
 