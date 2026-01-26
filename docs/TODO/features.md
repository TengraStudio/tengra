# Features Roadmap

## CRITICAL - Core Functionality

### 1.1 Missing Features
- [ ] Memory/RAG management: UI and Backend
- [x] **Agent Council: CRITICAL FIXES COMPLETED** (2026-01-25)
  - [x] **CRITICAL**: Fix hardcoded model/provider (now uses session config)
  - [x] **CRITICAL**: Implement tool security system (ToolPermissions + callSystem whitelist)
  - [x] **CRITICAL**: Add error recovery and retry mechanisms (exponential backoff, 3 retries)
- [ ] Onboarding Flow: Complete remaining 50%
- [ ] Settings UI: Add missing panels (Model parameters, Token limits)

### 1.2 Agent Council System
- [ ] **HIGH**: Custom agent system (only 3 hardcoded agents currently)
- [ ] **HIGH**: Advanced workflow engine (no parallel execution, voting, or consensus)
- [ ] **HIGH**: Enhanced UI and control system (pause/resume, step-through, manual intervention)
- [x] **HIGH**: Tool security and sandboxing (ToolPermissions system implemented)
- [ ] **HIGH**: Session management and templates (no reusable workflows)
- [ ] **MEDIUM**: Specialized agent library (research, testing, security, performance agents)
- [ ] **MEDIUM**: Advanced planning system (multi-level planning, dependency analysis)
- [ ] **MEDIUM**: Collaboration analytics (success tracking, performance metrics)

### 1.2 Project System
- [ ] **CRITICAL**: Fix type safety issues in project creation (unsafe `as unknown as Project` casting)
- [ ] **CRITICAL**: Add confirmation dialogs for destructive operations (delete, archive)
- [ ] **CRITICAL**: Implement proper state management to prevent race conditions
- [ ] **HIGH**: Batch operations system (multi-select, bulk delete/archive)
- [ ] **HIGH**: Custom project templates and template library
- [ ] **HIGH**: Project export system (PDF brief, Markdown, JSON)
- [x] Environment Variables Manager: UI for .env
- [ ] Dependency Analyzer: Visualization
- [ ] Project Settings Panel
- [ ] **NEW**: Advanced scaffolding engine with AI-driven project setup
- [ ] **NEW**: Project analytics dashboard with development metrics
- [ ] **NEW**: Advanced Git integration with visual branch management
- [ ] **NEW**: Project Dashboard Extensions (Detailed Specs):
    - [ ] **1. Insights / Architecture**:
        - [ ] AI-driven design pattern detection (Singleton, Factory, etc.).
        - [ ] Coupling & Cohesion analysis with modularity score.
        - [ ] Deep reasoning on "Why this architecture?" and suggested refactors.
    - [ ] **2. Tests**:
        - [ ] Integrated test explorer for Vitest, Jest, Pytest.
        - [ ] One-click visual test run with real-time pass/fail indicators.
        - [ ] Code coverage heatmaps overlay on the file tree.
    - [ ] **3. Dependency Graph**:
        - [ ] Interactive 2D/3D canvas visualizing file and module relationships.
        - [ ] "Impact Analysis": See which files are affected by changing a specific module.
        - [ ] Circular dependency detection and visualization.
    - [ ] **4. Documentation**:
        - [ ] Live auto-generation of docs from JSDoc/Docstrings.
        - [ ] Integrated Mermaid.js diagram support from code comments.
        - [ ] Searchable API reference with type definitions.
    - [ ] **8. Database (Universal & Modular)**:
        - [ ] **Visual Canvas (ERD)**: Interactive diagram where users see tables and their links (Foreign Keys).
        - [ ] **Multi-Dialect Support**: Modular drivers for MySQL, PostgreSQL, SQLite, MSSQL, MongoDB.
        - [ ] **Intelligent Query Runner**: SQL autocomplete with schema awareness.
        - [ ] **Schema Comparison**: Compare local schema with remote or previous versions.
        - [ ] **Data Modeler**: Visual UI to create tables and relations without writing SQL.
    - [ ] **11. Tasks / Kanban**:
        - [ ] Visual Kanban board synced bi-directionally with `TODO.md`.
        - [ ] Drag-and-drop task status updates.
        - [ ] AI task estimation and breakdown.
    - [x] **12. Logs**:
        - [x] Real-time log streamer with multi-channel support (Stdout, Stderr, Files).
        - [ ] Error aggregation and AI-powered log analysis (explaining "What went wrong?").
        - [ ] Log filtering and persistence for historical analysis.
    - [x] **13. Environment**:
        - [x] Visual `.env` manager with key/value validation.
        - [ ] Secure vault integration for secrets (AES-256 encryption at rest).
        - [ ] Multi-environment support (Dev, Staging, Prod).
    - [ ] **14. Health**:
        - [ ] Static analysis dashboard with Cyclomatic complexity and Maintainability index.
        - [ ] Real-time project "Pulse" (commit frequency, LOC growth).
        - [ ] Tech-debt estimation based on TODOs and code quality.
    - [ ] **15. PR / Reviews**:
        - [ ] Integrated Git Diff viewer tailored for code review.
        - [ ] AI-powered PR summaries and initial review comments.
        - [ ] Visual branch merging and conflict resolution canvas.
    - [ ] **16. Docker**:
        - [ ] Container management (Start/Stop/Restart/Logs) within the dashboard.
        - [ ] Docker Compose visualization (see service orchestration).
        - [ ] Image & Volume browser with cleanup tools.

## HIGH - UI Enhancements

### 2.1 Gallery System
- [ ] Store prompt metadata with images
- [ ] Gallery UI overhaul (Hover details, Regenerate)
- [ ] Database migration for Gallery Items
- [ ] Local Image Management UI: Integrated settings to download, bench, and switch between Ollama and SD models.
- [ ] Hardware-Aware Optimizer: Auto-configure generation parameters (steps, sampler) based on detected VRAM.
- [ ] ComfyUI Node Support: Integration for advanced users to use custom ComfyUI workflows for image generation.

### 2.2 Statistics Dashboard
- [ ] Usage Analytics (Model usage, Cost)
- [ ] Productivity Metrics (LOC generated)
- [ ] Conversation Analytics

### 2.3 Model Selector
- [ ] Redesign for capability filtering
- [ ] Show context window size and pricing
- [ ] Favorites/Pinned models

## MEDIUM - Thinking and Planning Mode

- [ ] Implement Thinking UI (collapsible reasoning)
- [ ] Implement Planning Mode (multi-step execution)
- [ ] Support model-specific thinking blocks (Claude, o1)

## MEDIUM - Quality of Life (Upgraded from LOW)

- [x] Chat Export/Import *(EXISTS - ExportModal.tsx for export, history-import.service.ts for ChatGPT/Claude import)*
- [ ] **Keyboard Shortcut Customization** *(MEDIUM - User productivity, requires Settings UI panel)*
- [ ] **Theme Creator** *(MEDIUM - User customization, complex UI builder)*
- [x] Log Viewer *(EXISTS - LoggingDashboard.tsx, accessible via Ctrl+L)*
