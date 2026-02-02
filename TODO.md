# Tandem Project - Task Tracking (Consolidated)

This is the central source of truth for all project tasks, merged from various domain-specific TODO files.

## 📊 Status Overview

| Category | Status | Notes |
|----------|--------|-------|
| **i18n** | Completed | Turkish support & hardcoded string removal done |
| **Security** | Completed | Encryption, tool sandboxing, and IPC hardening done |
| **Features** | In Progress | Implementing Custom Agent System (1.2) |
| **Architecture** | Refactoring | Transitioning to EventBus & Rust-based DB Service |
| **Code Quality** | Stable | Active lint & type safety enforcement |
| **Ideas System** | Stable | Major bugs resolved, UX enhancements done |

---

## 🔴 CRITICAL PRIORITY

### Core System & Architecture
- [ ] **Memory/RAG management**: UI and Backend integration <!-- id: feat-crit-1 -->
- [ ] **Database Service Finalization**:
    - [ ] Perform end-to-end migration testing (PGlite -> Rust SQLite)
    - [ ] Remove legacy dependencies (`@electric-sql/pglite`, `better-sqlite3`)
    - [ ] Integrate service installer into the production build pipeline
    - [ ] Clean up legacy migration and PGlite code
- [ ] **Type Safety**: Enable `strict` mode in `tsconfig.json` and fix remaining 700+ warnings <!-- id: qual-crit-1 -->
- [ ] **CI/CD Enrichment**: Add coverage enforcement and Playwright E2E tests for project management <!-- id: qual-crit-2 -->

### Project System
- [ ] **Fix type safety**: Unsafe `as unknown as Project` casting in creation <!-- id: proj-crit-1 -->
- [ ] **Confirmation Dialogs**: Add for destructive operations (delete, archive) <!-- id: proj-crit-2 -->
- [ ] **Race Conditions**: Implement proper state management for project list <!-- id: proj-crit-3 -->

---

## 🟠 HIGH PRIORITY

### Agent System (Feature 1.2)
- [ ] **Custom Agent System**: Implement agent profiles (roles, prompts, skills) <!-- id: feat-1.2-1 -->
- [ ] **Advanced Workflow Engine**: Parallel execution, voting, or consensus <!-- id: feat-1.2-2 -->
- [ ] **Enhanced UI**: Pause/resume, step-through, and manual intervention controls <!-- id: feat-1.2-3 -->
- [ ] **Tool Output Virtualization**: Handle long outputs better in the console <!-- id: feat-1.2-4 -->

### Project Improvements
- [ ] **Batch Operations**: Multi-select for bulk delete/archive <!-- id: proj-high-1 -->
- [ ] **Custom Templates**: Library for project scaffolding <!-- id: proj-high-2 -->
- [ ] **Export System**: PDF, Markdown, and JSON project briefs <!-- id: proj-high-3 -->

### Security & Quality
- [ ] **Test Coverage**: Increase threshold from 30% to 75% <!-- id: qual-high-1 -->
- [ ] **Renderer Testing**: Setup RTL for React components <!-- id: qual-high-2 -->

---

## 🟡 MEDIUM PRIORITY

### Features & UI
- [ ] **Onboarding Flow**: Complete remaining 50%
- [ ] **Settings UI**: Add Model parameters and Token limits panels
- [ ] **Gallery overhaul**: Hover details and prompt metadata storage
- [ ] **Statistics Dashboard**: Usage analytics and productivity metrics
- [ ] **Thinking UI**: Collapsible reasoning blocks for agents

### Architecture
- [ ] **IPC Migration**: Move remaining ~300 handlers to Central Event Bus
- [ ] **Plugin Extraction**: Move OpenAI/Anthropic logic into separate plugins
 