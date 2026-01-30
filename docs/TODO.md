# Orbit Project - Task Tracking

This document serves as the central index for project tasks. Tasks are categorized by domain.

## Category Indexes

- **[Internationalization (i18n)](./TODO/i18n.md)** (Critical Priority)
    - Hardcoded string removal
    - Turkish translation completion
    - Language infrastructure

- **[Security](./TODO/security.md)**
    - Vulnerability fixes
    - Authentication migration
    - Access control

- **[Features](./TODO/features.md)**
    - Core system extensions (Memory, Council)
    - UI Enhancements (Gallery, Statistics)
    - Project management improvements

- **[Architecture](./TODO/architecture.md)**
    - Service layer standardization
    - Event bus implementation
    - Plugin system design
    - Model Context Protocol (MCP) organization

- **[Code Quality and Debt](./TODO/quality.md)**
    - Type safety and strict mode enforcement
    - Comprehensive testing coverage
    - Performance optimization

- **[Ideas System](./TODO/ideas.md)** (New)
    - Bug fixes (10 items)
    - UX improvements
    - Feature additions
    - Technical improvements

## Status Overview

| Category | Status | Blocking Items |
|----------|--------|----------------|
| **i18n** | Completed | None |
| **Security** | Completed | None |
| **Features** | In Backlog | Memory and RAG system |
| **Architecture** | Refactoring | Event Bus implementation |
| **Quality** | Stable | Test coverage improvements |
| **Ideas** | Completed | None |

## project Roadmap

### Immediate Tasks
- [x] Resolution of hardcoded strings (i18n)
- [x] Completion of Turkish localizations
- [x] Fix TS5076 error in PromptTemplatesService
- [x] Accessibility audit and ARIA compliance
- [x] Fix immediate account UI refresh bug and refactor Auth IPC

### Short-Term Goals
- [x] Authentication database migration
- [x] Service layer standardization
- [x] Theme System Migration (Settings, Project, Ideas, Onboarding)
- [x] Exportable Research Briefs (PDF/Markdown)

### Autonomous Project System (New)
Implement the "Project System" for long-running autonomous tasks (replacing `build_project_system_prompt.md`).

#### Backend Service (`ProjectAgentService`)
- [x] Create `src/main/services/project/project-agent.service.ts` extending `BaseService`.
- [x] Implement `Think -> Plan -> Act -> Observe` loop.
- [x] **State Persistence**: Save `currentTask`, `plan`, `history` to `project-state.json`.
- [x] **Tools**: Wrap `run_command`, `read_file`, etc.
- [x] **Resilience**:
    - [x] Intercept 429/Quota errors.
    - [x] Auto-rotate accounts via `AuthService`.
    - [x] Retry 5xx errors with exponential backoff.

| Project System | [x] Critical Fixes, [ ] Phase 2 | [x] High | 2026-02-15 |
| UI/UX | [x] Accessibility, [x] Themes | [x] High | 2026-01-30 |
| i18n | [x] Core Fixes, [ ] More Langs | [ ] Med | 2026-03-01 |
| Infrastructure | [x] Strict TS, [x] CI/CD | [x] High | 2026-01-25 |

#### User Interface (`src/renderer/features/project/`)
- [x] Create Project View.
- [x] **Mission Input**: Large text area.
- [x] **Live Dashboard**:
    - [x] Activity Stream (scrolling logs).
    - [x] Planner View (checklist).
- [x] **Controls**: Start, Pause, Stop.

#### Integration
- [x] Register IPC: `project:start`, `project:stop`, `project:update`.
- [x] Inject System Prompt from `docs/prompts/project_agent_system_prompt.md`.

### Medium-Term Goals
- Development of the Statistics dashboard
- [ ] Implementation of the "Thinking" mode for agents
- [ ] Design and development of a plugin system
- [x] Refactor high complexity methods (>10) in `SettingsService`
- [x] Refactor database system to a Windows service (Rust-based standalone project)
- [ ] **Database Service Finalization**:
    - [ ] Perform end-to-end migration testing (PGlite -> Rust SQLite)
    - [ ] Remove legacy dependencies (`@electric-sql/pglite`, `better-sqlite3`)
    - [ ] Integrate service installer into the production build pipeline
    - [ ] Clean up legacy migration and PGlite code
- [ ] Local AI Hardware Optimization & Management UI
- [ ] Local Hugging Face Model Support (Inference API & Local GGUF/Transformers.js)

- [x] Theme System Migration (Settings, Project, Ideas, Onboarding)
- [x] Turkish localizations completed for migrated modules
- [x] Project path migration from `project_id` to `project_path` (Backend & Frontend)
- [x] Refactor ModelSelector.tsx and ProjectWizardModal.tsx to reduce complexity and line counts
- [x] Build and lint verification passed (Reduced warnings and resolved all critical ref access errors)
*Last Updated: January 30, 2026 (Batch 13 Complete)*
