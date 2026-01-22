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
| **Ideas** | In Review | i18n hardcoded strings |

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
- [ ] Exportable Research Briefs (PDF/Markdown)

### Medium-Term Goals
- Development of the Statistics dashboard
- [ ] Implementation of the "Thinking" mode for agents
- [ ] Design and development of a plugin system
- [ ] Refactor database system to a Windows service (Rust-based standalone PGlite host)
- [ ] Local AI Hardware Optimization & Management UI

*Last Updated: January 22, 2026*
