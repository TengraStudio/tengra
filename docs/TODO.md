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
| **Security** | Under Review | Authentication Migration |
| **Features** | In Backlog | Memory and RAG system |
| **Architecture** | Refactoring | Event Bus implementation |
| **Quality** | Stable | Test coverage improvements |
| **Ideas** | Completed | None |

## project Roadmap

### Immediate Tasks
- [x] Resolution of hardcoded strings (i18n)
- [x] Completion of Turkish localizations
- [x] Fix TS5076 error in PromptTemplatesService
- Accessibility audit and ARIA compliance

### Short-Term Goals
- Authentication database migration
- [ ] Gallery prompt storage implementation
- [ ] Service layer standardization
- [x] Theme System Migration (Settings, Project, Ideas, Onboarding)
- [ ] Exportable Research Briefs (PDF/Markdown)

### Autonomous Project System (New)
Implement the "Project System" for long-running autonomous tasks (replacing `build_project_system_prompt.md`).

#### Backend Service (`ProjectAgentService`)
- [ ] Create `src/main/services/project/project-agent.service.ts` extending `BaseService`.
- [ ] Implement `Think -> Plan -> Act -> Observe` loop.
- [ ] **State Persistence**: Save `currentTask`, `plan`, `history` to `project-state.json`.
- [ ] **Tools**: Wrap `run_command`, `read_file`, etc.
- [ ] **Resilience**:
    - [ ] Intercept 429/Quota errors.
    - [ ] Auto-rotate accounts via `AuthService`.
    - [ ] Retry 5xx errors with exponential backoff.

#### User Interface (`src/renderer/features/project/`)
- [ ] Create Project View.
- [ ] **Mission Input**: Large text area.
- [ ] **Live Dashboard**:
    - [ ] Activity Stream (scrolling logs).
    - [ ] Planner View (checklist).
- [ ] **Controls**: Start, Pause, Stop.

#### Integration
- [ ] Register IPC: `project:start`, `project:stop`, `project:update`.
- [ ] Inject System Prompt from `docs/prompts/project_agent_system_prompt.md`.

### Medium-Term Goals
- Development of the Statistics dashboard
- [ ] Implementation of the "Thinking" mode for agents
- [ ] Design and development of a plugin system
- [ ] Refactor database system to a Windows service (Rust-based standalone PGlite host)
- [ ] Local AI Hardware Optimization & Management UI
- [ ] Local Hugging Face Model Support (Inference API & Local GGUF/Transformers.js)

- [x] Theme System Migration (Settings, Project, Ideas, Onboarding)
- [x] Turkish localizations completed for migrated modules
- [x] Build and lint verification passed
*Last Updated: January 23, 2026*
