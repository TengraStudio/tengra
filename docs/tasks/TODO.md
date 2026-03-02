# 👑 Tengra Strategic Roadmap

> **Current Focus**: Secure Social Gateway & Technical Debt Reduction
> **Last Updated**: 2026-03-02
> **Project Health**: 🟡 Medium (High Tech Debt, Strong Foundation)

---

## 📍 Execution Roadmap

### 📦 v1.3.0 - Foundation & Marketplace (Q2 2026)
| ID | Task | Priority | Difficulty | Status |
|---|---|---|---|---|
| **SEC-H-002** | IPC Response Validation (Zod) | 🔴 P0 | 💪 High | [ ] |
| **GATEWAY-001** | Secure Social Gateway Phase 1 (Relay MVP) | 🔴 P0 | 🧠 Epic | [ ] |
| **PERF-001** | MessageList Virtualization | 🟡 P1 | ⚡ Med | [ ] |
| **MKT-001** | Marketplace system MVP (C++ Backend) | 🟢 P1 | 💪 High | [/] |

### 🚀 v1.4.0 - Connectivity & Modularization (Q3 2026)
| ID | Task | Priority | Difficulty | Status |
|---|---|---|---|---|
| **SEC-H-004** | Strict `spawn`/`exec` Validation | 🔴 P0 | 🛡️ High | [ ] |
| **DEBT-002** | Modular Refactor: `MessageBubble.tsx` | 🟡 P1 | 💪 High | [ ] |
| **DEBT-005** | Modular Refactor: `IdeaGeneratorService.ts` | 🟡 P1 | 💪 High | [ ] |
| **CONN-001** | SSH Tunneling Core | 🟢 P2 | ⚡ Med | [ ] |

---

## 🛡️ Security & Infrastructure (SEC/GATEWAY)

### 🔐 Security Hardening
- [ ] **SEC-H-002**: Audit 70+ raw `ipcMain.handle` calls for Zod `responseSchema`.
- [ ] **SEC-H-004**: End-to-end injection audit for all `child_process` and `shell` usage. **(CRITICAL)**
- [ ] **SEC-H-006**: Implement strict Content Security Policy (CSP) for Renderer.
- [ ] **SEC-PROT-001**: Harden `ExtensionService` sandboxing for 3rd-party code.

### 🌐 Secure Social Gateway
- [ ] **GATEWAY-001**: Phased Gateway/Relay Implementation:
  - [ ] **Phase 1**: C++ Relay Server (Drogon) in `website/tengra-backend`.
  - [ ] **Phase 2**: E2EE tunnel launcher in Main process (outbound only).
  - [ ] **Phase 3**: Social Media Webhook integration (Twitter, Telegram).
  - [ ] **Phase 4**: Self-hosting Docker orchestration.

---

## 🧹 Technical Debt & Architecture (DEBT)

### 🏛️ Monolith Deconstruction (NASA Rule #3)
- [ ] **DEBT-MON-01**: Partition services exceeding 1000 lines:
  - [ ] `IdeaGeneratorService.ts` (~2750 lines) -> `IdeaRepository`, `IdeaSessionManager`.
  - [ ] `AgentTaskExecutor.ts` (~2100 lines) -> `TaskStateMachine`, `ToolInvocationManager`.
  - [ ] `SSHService.ts` (~2200 lines) -> `SSHKeyManager`, `SSHTunnelManager`.
  - [ ] `AdvancedMemoryService.ts` (~2500 lines) -> `ConsolidationLogic`, `EmbeddingRetriever`.
- [ ] **DEBT-LEAK-02**: Memory Leak Audit:
  - [x] `AgentTaskExecutor.ts`: Verify `setupEventListeners` listener cleanups. (Fixed 'project:plan-revised' leak)
  - [ ] Global Audit: Ensure every `initialize()` has a matching `dispose()`.
- [ ] **DEBT-TYPE-03**: Eliminate unsafe type debt (`as any`, `as unknown as`) in `src/main/services`.

---

## ⚡ Performance & UX (PERF/FEAT)

### 🚀 Optimization
- [ ] **PERF-001**: Implement Virtualization for `MessageList` (react-window).
- [ ] **PERF-004**: Batch IPC updates for streaming logs/terminals (Max 20Hz).

### ✨ New Capabilities
- [ ] **FEAT-006**: **Agent Execution Trace**: Visual timeline of agent logic.
- [ ] **FEAT-007**: **Multi-Agent Collaboration**: Parallel LLM execution mode.
- [ ] **FEAT-009**: **Advanced Quota Dashboard**: Real-time spending visualization.

---

## ✅ Completed Archive
- [x] **PERF-005**: Move hardcoded models in `AdvancedMemoryService.ts` to user settings.
- [x] **SEC-H-005**: Re-verify `dangerouslySetInnerHTML` in `MessageBubble.tsx` and `MarkdownRenderer.tsx`. (Verified: Sanitized with DOMPurify)
- [x] **PERF-003**: Refactor Multi-Model Collaboration component (memoized components + hook).
- [x] **CHG-001**: Fix changelog sync and quality validation issues.
- [x] **AUD-ARCH-001**: Initial codebase scan for TODO/FIXME comments and technical debt.

---

"Code like it's a satellite. You can't reach out and fix it once it's launched."
 