# Tandem Project - Task Tracking (Consolidated)

This is the central source of truth for all project tasks, merged from roadmap items and deep technical debt.

## 📊 Status Overview

| Category | Status | Notes |
|----------|--------|-------|
| **i18n** | Completed | Turkish support & hardcoded string removal done |
| **Security** | In Progress | Implementation of rate limiting and path validation |
| **Features** | Completed | Implementing Custom Agent System (1.2) |
| **Architecture** | Refactoring | Transitioning to EventBus & Rust-based DB Service |
| **Code Quality** | Stable | Active lint & type safety enforcement |
| **Ideas System** | Stable | Major bugs resolved, UX enhancements done |

---

## 🔴 CRITICAL PRIORITY

### Core System & Architecture
- [ ] **Memory/RAG management**: UI and Backend integration <!-- id: feat-crit-1 -->
- [ ] **Database Service Finalization**:
    - [ ] Perform end-to-end migration testing (PGlite -> Rust SQLite)
    - [x] Remove legacy dependencies (`@electric-sql/pglite`, `better-sqlite3`)
    - [ ] Integrate service installer into the production build pipeline
    - [x] Clean up legacy migration and PGlite code
- [ ] **Type Safety**: Enable `strict` mode in `tsconfig.json` and fix remaining 700+ warnings <!-- id: qual-crit-1 -->
- [ ] **CI/CD Enrichment**: Add coverage enforcement and Playwright E2E tests for project management <!-- id: qual-crit-2 -->
- [x] **Fix type safety**: Unsafe `as unknown as Project` casting in creation <!-- id: proj-crit-1 -->

### Security (High Stakes)
- [ ] **SEC-004**: Insecure CSP & Electron Configuration (Unsafe-eval for Monaco) <!-- severity: critical -->
- [ ] **SEC-007**: Weak Cryptography & Token Generation <!-- severity: critical -->
- [ ] **SEC-011**: Implement Missing Rate Limiting for file operations and LLM calls <!-- severity: high -->
- [x] **SEC-015**: Add prompt template escaping for user inputs <!-- severity: medium -->

---

## 🟠 HIGH PRIORITY

### Agent System & Features
- [x] **Project Agent State Resumption**: Load active task from DB on startup <!-- id: agent-high-1 -->
- [x] **Custom Agent System**: Implement agent profiles (roles, prompts, skills) <!-- id: feat-1.2-1 -->
- [x] **Advanced Workflow Engine**: Parallel execution, voting, or consensus <!-- id: feat-1.2-2 -->
- [ ] **Thinking UI**: Collapsible reasoning blocks for agents <!-- id: feat-1.2-3 -->
- [ ] **Tool Output Virtualization**: Handle long outputs better in the console <!-- id: feat-1.2-4 -->

### Reliability & Code Health
- [x] **CLEAN-001-5**: Add bounded size to active processes map in `command.service.ts` <!-- severity: low -->
- [x] **CLEAN-002-2**: Clean up terminal references after component unmount <!-- severity: medium -->
- [x] **CLEAN-002-3**: Add cleanup to global keyboard shortcut listeners <!-- severity: low -->
- [x] **TODO-001-6**: Implement provider stats in `agent-provider-rotation.service.ts` <!-- severity: low -->
- [x] **PERF-001-3**: Add virtualization to `WorkspaceExplorer.tsx` tree structure <!-- severity: medium -->

---

## 🟡 MEDIUM PRIORITY

### Features & UI
- [ ] **Onboarding Flow**: Complete remaining 50%
- [ ] **Settings UI**: Add Model parameters and Token limits panels
- [ ] **Gallery overhaul**: Hover details and prompt metadata storage
- [ ] **Statistics Dashboard**: Usage analytics and productivity metrics
- [ ] **Batch Operations**: Multi-select for bulk delete/archive <!-- id: proj-high-1 -->

### Architecture
- [ ] **IPC Migration**: Move remaining ~300 handlers to Central Event Bus
- [ ] **Plugin Extraction**: Move OpenAI/Anthropic logic into separate plugins
- [x] **PERF-003-4**: Add connection pooling in `database-client.service.ts` <!-- severity: medium -->
- [x] **PERF-005-2**: Cache directory listings in FileExplorer <!-- severity: medium -->

---

## 📋 DATA & TESTS (Backlog)

### Testing Roadmap
- [ ] Increase test coverage from 30% to 75%
- [ ] **TEST-004-P3**: Add tests for `project-agent.service.ts`
- [ ] **TEST-005-S8**: Add tests for `command.service.ts`
- [ ] **TEST-012-6**: Add concurrent operation tests for database service

### Technical Debt Items
- Multiple duplicate IPC handler registrations
- Standardized IPC return type contract implementation
- Error boundary strategy for React components

---
## 🔵 BATCH 4: TECHNICAL DEBT & MODERNIZATION (NEW)
- [x] **Type Safety Overhaul**:
    - [x] Enable `noUnusedLocals` and `noUnusedParameters` in `tsconfig.json` <!-- id: batch4-1 -->
    - [x] Resolve ~700 `any`/`unknown` instances in `src` <!-- id: batch4-2 -->
- [x] **Security Hardening**:
    - [x] **SEC-004**: Safter Monaco/CSP (Remove unsafe-eval dependency if possible) <!-- id: batch4-3 -->
    - [x] **SEC-007**: Replace `Math.random` with `crypto` for all ID generation <!-- id: batch4-4 -->
- [x] **Complexity Reduction**:
    - [x] Refactor `main.ts` (Complexity > 20) <!-- id: batch4-5 -->
    - [x] Refactor `ExternalMcpPlugin.ts` (Complexity > 10) <!-- id: batch4-6 -->
- [x] **Reliability**:
    - [x] Fix all Floating/Misused Promises in Main Process <!-- id: batch4-7 -->
    - [x] Purge redundant directive overrides (`eslint-disable`, `ts-ignore`) <!-- id: batch4-8 -->
    - [x] Final build/lint/type-check cycle

## Batch 5: Database Evolution & Memory Core (Current)
- [x] **Database Finalization**
    - [x] Remove legacy dependencies (`@electric-sql/pglite`, `better-sqlite3`) from `package.json`
    - [x] Clean up legacy migration code and PGlite/SQLite remnants
- [x] **Memory Core Integration**
    - [x] Consolidate `MemoryService` and `AdvancedMemoryService` roles
    - [x] Integrate RAG/Vector operations with Rust `db-service`
    - [x] Remove native `memory-service` dependency
- [x] **Type Safety & Tech Debt**
    - [x] Fix unsafe casts in `preload.ts` (`ProjectState`)
    - [x] Standardize memory/project types (100% type safety)
- [x] **Batch Finalization**
    - [x] Run `npm run build` and verify binaries
    - [x] Update documentation for Batch 5 completion

---
## Batch 6: Multi-Agent Orchestration v2 (Current)
- [x] **Persistent Agent Profiles**
    - [x] Implement database support in `SystemRepository`
    - [x] Refactor `AgentRegistryService` for persistence
- [x] **Orchestration Service**
    - [x] Create `MultiAgentOrchestratorService`
    - [x] Implement Planner/Worker phases with specialized roles
    - [x] Expose via IPC and finalize types
- [x] **Batch Finalization**
    - [x] Run `npm run build` and verify binaries
    - [x] Update documentation for Batch 6 completion

---
*Last updated: 2026-02-04 (Batch 6 Completed)*