# ORBIT Project - Master Roadmap & TODOs

## Priority TODO List - 100 Focused Items

This document contains 100 actionable TODO items for improving the Orbit codebase, organized by category.

---

## 🏗️ Architecture & Infrastructure (1-15)

- [ ] 1. Implement dependency injection container with proper singleton lifecycle management
- [ ] 2. Create abstract base class for all services with common lifecycle hooks
- [ ] 3. Add circuit breaker pattern for external API calls
- [ ] 4. Implement event sourcing for chat history
- [x] 5. Create unified error handling middleware for IPC handlers
- [x] 6. Add request/response logging interceptor for all API calls
- [x] 7. Implement graceful shutdown with proper resource cleanup
- [ ] 8. Add health check endpoints for all critical services
- [ ] 9. Create service registry for dynamic service discovery
- [ ] 10. Implement feature flags system for gradual rollouts
- [ ] 11. Add telemetry collection with opt-in user consent
- [ ] 12. Create database migration system for schema updates
- [ ] 13. Implement connection pooling for SQLite
- [x] 14. Add automatic retry with exponential backoff for all network requests
- [ ] 15. Create unified configuration management system

---

## 🔒 Security (16-25)

- [ ] 16. Implement API key rotation mechanism
- [ ] 17. Add rate limiting per provider
- [ ] 18. Create audit log for sensitive operations
- [ ] 19. Implement CSP (Content Security Policy) for renderer
- [ ] 20. Add input sanitization for all user inputs
- [ ] 21. Implement secure credential storage with OS keychain
- [ ] 22. Add JWT validation for proxy authentication
- [ ] 23. Create permission system for MCP tool access
- [ ] 24. Implement request signing for API calls
- [ ] 25. Add vulnerability scanning in CI/CD pipeline

---

## 🧪 Testing (26-40)

- [ ] 26. Achieve 80% code coverage for main process
- [ ] 27. Add integration tests for all IPC handlers
- [ ] 28. Create E2E tests for critical user flows
- [ ] 29. Implement snapshot testing for UI components
- [ ] 30. Add performance benchmarks for LLM response times
- [ ] 31. Create mock providers for all external services
- [ ] 32. Add contract tests for API integrations
- [ ] 33. Implement chaos testing for error scenarios
- [ ] 34. Create test fixtures for database operations
- [ ] 35. Add visual regression tests for UI
- [ ] 36. Implement load testing for proxy service
- [ ] 37. Create test utilities for async operations
- [ ] 38. Add mutation testing to verify test quality
- [ ] 39. Implement property-based testing for parsers
- [ ] 40. Create test documentation with examples

---

## ⚡ Performance (41-55)

- [ ] 41. Implement lazy loading for all feature modules
- [ ] 42. Add virtual scrolling for long chat histories
- [ ] 43. Optimize bundle size with tree shaking analysis
- [ ] 44. Implement response streaming for all LLM providers
- [ ] 45. Add caching layer for embedding computations
- [ ] 46. Optimize database queries with proper indexing
- [ ] 47. Implement worker threads for CPU-intensive tasks
- [ ] 48. Add memory profiling and leak detection
- [ ] 49. Optimize React re-renders with proper memoization
- [ ] 50. Implement incremental search with debouncing
- [ ] 51. Add compression for large message payloads
- [ ] 52. Optimize image loading with progressive enhancement
- [ ] 53. Implement request deduplication
- [ ] 54. Add prefetching for predictable user actions
- [ ] 55. Optimize startup time with deferred initialization

---

## 🎨 UI/UX (56-70)

- [x] 56. Add keyboard shortcuts for common actions
- [ ] 57. Implement drag-and-drop for file attachments
- [x] 58. Create consistent loading states across app
- [x] 59. Add skeleton screens for async content
- [ ] 60. Implement undo/redo for chat operations
- [ ] 61. Add context menus for all interactive elements
- [ ] 62. Create onboarding flow for new users
- [x] 63. Implement accessibility (ARIA) labels
- [ ] 64. Add focus management for modal dialogs
- [ ] 65. Create high contrast theme option
- [ ] 66. Implement responsive design for all screen sizes
- [ ] 67. Add animation preferences (reduce motion)
- [ ] 68. Create tooltip system with consistent styling
- [ ] 69. Implement breadcrumb navigation
- [ ] 70. Add search/filter for settings page

---

## 🤖 AI/LLM Features (71-85)

- [ ] 71. Implement multi-model comparison view
- [ ] 72. Add prompt templates library
- [ ] 73. Create conversation branching
- [ ] 74. Implement context window management
- [ ] 75. Add token usage estimation before sending
- [ ] 76. Create model performance analytics
- [ ] 77. Implement automatic model fallback
- [ ] 78. Add support for function calling
- [ ] 79. Create agent orchestration framework
- [ ] 80. Implement RAG (Retrieval Augmented Generation)
- [ ] 81. Add document ingestion pipeline
- [ ] 82. Create embedding visualization
- [ ] 83. Implement semantic search across chats
- [ ] 84. Add conversation summarization
- [ ] 85. Create custom instruction presets

---

## 📝 Code Quality (86-100)

- [ ] 86. Eliminate all remaining `any` types in production code
- [x] 87. Add JSDoc comments to all public APIs
- [ ] 88. Implement stricter ESLint rules
- [ ] 89. Create coding style guide document
- [x] 90. Add pre-commit hooks for linting
- [x] 91. Implement automatic code formatting
- [ ] 92. Create architectural decision records (ADRs)
- [ ] 93. Add dependency update automation
- [x] 94. Implement import sorting rules
- [ ] 95. Create module boundary enforcement
- [ ] 96. Add dead code detection
- [ ] 97. Implement cyclomatic complexity limits
- [ ] 98. Create documentation coverage report
- [ ] 99. Add breaking change detection
- [ ] 100. Implement semantic versioning automation

---

## Priority Legend

- 🔴 Critical - Must be done before next release
- 🟡 Important - Should be done soon
- 🟢 Nice to have - When time permits

---

*Last updated: 2026-01-11*

## ✅ Recently Completed (2026-01-11)

The following 20 TODO items have been completed:

1. ✅ **Unified error handling middleware for IPC handlers (#5)** - Enhanced `createIpcHandler` with options and added `createSafeIpcHandler` for fallback values. Updated all IPC handlers to use unified error handling.

2. ✅ **Input sanitization for all user inputs (#20)** - Created comprehensive sanitization utilities and applied to all chat IPC handlers.

3. ✅ **Keyboard shortcuts for common actions (#56)** - Added global shortcuts (Ctrl+K, Ctrl+N, Ctrl+, Ctrl+B, Ctrl+1-4, etc.) with updated KeyboardShortcutsModal.

4. ✅ **Keyboard navigation for message list (J/K keys)** - Already implemented in MessageList.tsx.

5. ✅ **Search/filter for settings page (#70)** - Added search bar with filtering capabilities.

6. ✅ **JSDoc comments to public APIs (#87)** - Added comprehensive JSDoc to ElectronAPI interface and IPC utilities.

7. ✅ **Pre-commit hooks for linting (#90)** - Configured Husky with pre-commit hooks for linting and type checking.

8. ✅ **Automatic code formatting (#91)** - Added Prettier configuration.

9. ✅ **Request/response logging interceptor (#6)** - Enhanced HttpService with detailed request/response logging.

10. ✅ **Graceful shutdown with resource cleanup (#7)** - Enhanced shutdown handler with proper service cleanup.

11. ✅ **Automatic retry with exponential backoff (#14)** - Already implemented in HttpService.

12. ✅ **Consistent loading states (#58)** - Created LoadingState component with multiple variants.

13. ✅ **Skeleton screens for async content (#59)** - Enhanced skeleton components with specialized variants.

14. ✅ **Standardized Button and Input components (#14)** - Created standardized Input component with variants, Button already had variants.

15. ✅ **Import sorting rules (#94)** - Configured ESLint with simple-import-sort plugin.

16. ✅ **Improved logging levels (#13)** - Already implemented with DEBUG, INFO, WARN, ERROR.

17. ✅ **Accessibility (ARIA) labels (#63)** - Added ARIA labels throughout components.

18. ✅ **Screen reader improvements (#11)** - Enhanced ARIA labels and roles.

19. ✅ **Keyboard focus traps audit (#10)** - Verified and enhanced focus trap implementations.

20. ✅ **Standardized error handling patterns (#12)** - Created renderer error handling utilities matching main process patterns.

---

# ORBIT Project - Comprehensive Roadmap & TODOs

## ⭐ Upcoming Features (High Priority)

### Branding & Identity

- [ ] **UI Polish**
  - [ ] Fix "large gap" content issue on Welcome Screen for large displays (deferred).
- [ ] **AI Logo Generator System**
  - [ ] Implement backend service to analyze project `package.json` / metadata.
  - [ ] Create specialized prompt templates for logo generation (e.g., "minimalist tech", "cyberpunk", "playful").
  - [ ] Integrate with image generation model (DALL-E 3 / Stable Diffusion) via Antigravity or local.
  - [ ] build UI for selecting color palettes and style preferences.
  - [ ] Implement logo preview gallery with "Apply to Project" button.
  - [ ] Auto-resize and export favicon.ico / icon.png.

### SSH & Remote Deployment

- [ ] **Advanced SSH Manager**
  - [ ] Implement Nginx configuration wizard for reverse proxy setup.
  - [ ] Add "One-Click Deploy" for React/Node applications to remote VPS.
  - [ ] Add SSL Certificate management (Let's Encrypt automation) via SSH.
  - [ ] Implement real-time server stats dashboard (CPU/RAM/Disk) over SSH.
  - [ ] **Package Manager**: View installed packages (apt/npm/pip) and updates.
  - [ ] **Log Explorer**: Real-time view of system (syslog, auth) and app logs (nginx, pm2, docker).
  - [ ] Add support for saving/loading SSH connection profiles (encrypted).
  - [ ] Integrate with `ssh-agent` for key management on host OS.

## 🩹 Core Reliability & Backend

### Electron & Main Process

- [ ] **Auto-Update Mechanism**
  - [ ] Implement `electron-updater` integration.
  - [ ] Add update channels (Stable, Beta, Nightly).
  - [ ] Add "Check for Updates" UI in About section.
  - [ ] Implement rigorous signature verification for updates.
- [ ] **Crash Reporting & Telemetry**
  - [ ] Integrate Sentry for main and renderer processes.
  - [ ] Add opt-in mechanism for anonymous usage statistics.
  - [ ] Implement local crash dump analysis viewer.
- [ ] **Performance Optimization**
  - [ ] Profile startup time and optimize main process initialization.
  - [ ] Implement lazy loading for heavy node modules.
  - [ ] Optimize IPC message payloads (reduce serialization overhead).
  - [ ] Review and optimize memory usage of `llama-server` process management.

### Database & Persistence

- [ ] **Schema Migrations**
  - [ ] Implement strict migration system for SQLite database.
  - [ ] Add backup/restore verification tests.
  - [ ] Add database integrity check on startup.
- [ ] **Full Text Search (FTS)**
  - [ ] Optimize FTS5 queries for large chat histories.
  - [ ] Add FTS support for project files/codebase indexing.
  - [ ] Implement fuzzy search capabilities.

## 🎨 Frontend & UI/UX

### Editor & Rendering

- [x] **Monaco Editor Integration**
  - [x] Fully integrate Monaco Editor (VS Code editor) for better code viewing/editing.
  - [x] Add efficient diff view for code changes (Component created: `DiffViewer.tsx`).
  - [x] Implement minimap for long responses (Conditional in `MonacoBlock`).
  - [x] Add support for standard VS Code themes (Already in `CodeEditor`).
- [x] **Markdown Rendering**
  - [x] Improve math rendering (LaTeX/KaTeX support) - *Verified existing implementation*
  - [x] Add Mermaid.js diagram rendering support - *Verified existing implementation*
  - [x] Fix flickers in streaming markdown responses - *Handled by React state optimized in MessageBubble*
  - [x] Add "Copy as HTML/Markdown" context menu.

### Chat Interface

- [ ] **Organization**
  - [ ] Implement drag-and-drop ordering for pinned chats.
  - [ ] Add color-coding/tags for folders.
  - [ ] Add "Smart Folders" (auto-group by date, model, topic).
- [ ] **Input & Interactions**
  - [ ] Add multi-line input expansion improvements.
  - [ ] Implement "Edit Message" and branch chat from edit point.
  - [ ] Add "Regenerate with..." (select different model) option.
  - [x] Add keyboard navigation for message list (J/K keys).

### Settings & Configuration

- [ ] **Theme Store**
  - [ ] Create a theme definition schema (JSON).
  - [ ] Build a community theme browser.
  - [ ] Allow CSS injection for power users (Custom CSS).
- [ ] **Accessibility**
  - [x] Audit keyboard focus traps.
  - [x] Improve screen reader (ARIA) labels throughout.
  - [ ] Add high-contrast mode.

## 🧠 AI & Intelligence features

### Context Management (RAG)

- [ ] **Vector Database**
  - [ ] Integrate a local vector DB (e.g., LanceDB or local Chroma/Qdrant).
  - [x] Implement automatic embedding generation for chat history.
  - [ ] Add "Search with Context" feature using semantic search.
- [ ] **Project Indexing**
  - [ ] Implement AST-based code indexing for smarter codebase queries.
  - [ ] Add `.gitignore` respect for file indexing.
  - [ ] Implement background re-indexing on file changes.

### Agents & Tools (MCP)

- [ ] **MCP Ecosystem**
  - [ ] Fully implement Model Context Protocol (MCP) spec 1.0.
  - [ ] Create a "Tool Store" or registry for MCP servers.
  - [ ] Add UI for inspecting MCP server logs/traffic.
  - [ ] Implement "Auto-Approver" policies for trusted tools.
  - [ ] **Add PageSpeed API MCP**: Integrate Google PageSpeed Insights for performance analysis.
- [ ] **Autonomous Features**
  - [ ] Implement "Goal Mode": Give a high-level goal and let agent plan steps.
  - [ ] Add "Code Doctor": Auto-scan project for errors and propose fixes.
  - [ ] Add "Test Generator": Auto-generate unit tests for selected file.

## 🛠️ DevOps & Testing

### CI/CD

- [ ] **GitHub Actions**
  - [ ] Set up automated build pipelines for Windows/Linux/Mac.
  - [ ] Add automated linting and type-checking gates.
  - [ ] Implement automated release drafting.
- [ ] **Local Testing**
  - [ ] Add unit tests for all React components (Vitest/Jest).
  - [ ] Add integration tests for Electron IPC (Playwright/Electron).
  - [ ] Add E2E tests for critical user flows (Chat, Settings, Model D/L).

### Docker & Containerization

- [ ] **Docker Integration**
  - [ ] Add UI for managing Docker containers related to project.
  - [ ] Add support for "Dev Containers" configuration detection.
  - [ ] Allow running MCP servers inside isolated Docker containers.

## 📚 Documentation & Community

- [ ] **Developer Docs**
  - [ ] Generate comprehensive API documentation for internal services.
  - [ ] Create a "Contributing Guide" for open-source contributors.
  - [ ] Add architectural diagrams for IPC flow.
- [ ] **User Guides**
  - [ ] Create video tutorials for "Getting Started".
  - [ ] Write a detailed "Prompt Engineering Guide" for Orbit.
  - [ ] Add "Tip of the Day" dismissal modal.

## 🧹 Maintenance & Hygiene

- [ ] **Dependency Management**
  - [ ] Audit `package.json` for unused dependencies.
  - [ ] Automate dependency updates (Renovate/Dependabot).
  - [ ] Replace deprecated libraries.
- [ ] **Refactoring**
  - [ ] Refactor `App.tsx` global state into granular contexts or Redux/Zustand.
  - [x] Standardize error handling patterns across `main` and `renderer`.
  - [ ] Enforce stricter TypeScript types (no `any`).

---

## Technical Debt & Optimizations (Detailed)

### UI Components

- [ ] Refactor `Sidebar` to use composition pattern.
- [ ] Standardize `Button` and `Input` components variants.
- [ ] Replace ad-hoc Tailwind classes with design tokens/constants.
- [ ] Optimize `MessageList` rendering to prevent re-renders.

### Backend Services

- [ ] Decouple `LlamaService` from direct file system paths (DI).
- [ ] Implement service health checks/heartbeats.
- [ ] Add improved logging levels (DEBUG, INFO, WARN, ERROR).
- [ ] Secure `preload.ts` exposure (reduce API surface).

### AI Bridge

- [ ] Abstract provider implementations (`Ollama`, `OpenAI`, `Anthropic`) into a plugin system.
- [ ] Standardize "Stop" signal handling across all providers.
- [ ] Improve token counting accuracy for varying tokenizers.

### Security

- [ ] Audit `shell-quote` usage for command injection risks.
- [ ] Implement Content Security Policy (CSP) for renderer.
- [ ] Encrypt stored API keys using platform native keychains.

## 🧠 Advanced Memory System (Future Vision - ChatGPT Level & Beyond)

### 1. Auto-Analyst & Fact Extraction
- [ ] **Passive Chat Splitting**: Run an "Analyst Model" in background after every session to extract structured data provided by user.
- [ ] **User Profiling**:
  - [ ] Coding Style (concise vs explanatory, prefer typescript vs js).
  - [ ] Personal Context (location, hobbies, job title).
  - [ ] Project Context (current startup idea, main tech stack).
- [ ] **Entity-Relationship Mapping**: Store facts not just as list, but as small graphs (User -> Loves -> Python).

### 2. Explicit Control & Management
- [ ] **Memory Commands**: Support explicit instructions: "Orbit, remember that I hate PHP".
- [ ] **Memory Manager UI**:
  - [ ] A dedicated dashboard to view all "learned facts".
  - [ ] Search/Edit/Delete individual memory items.
  - [ ] "Forget Everything about Project X" bulk action.

### 3. Deep Contextual Recall
- [ ] **Temporal Awareness**: Understand "last week", "yesterday", "in 2024" relative to chat timestamp.
- [ ] **Cross-Project Pollination**: Remember that user used a specific library in Project A when suggesting code for Project B (if allowed).
- [ ] **Sentiment Tracking**: Track user mood over time (frustrated with bugs -> offer encouragement).

### 4. Integration
- [ ] **System Prompt Injection**: Dynamically pick top-5 most relevant facts to inject into system prompt for *every* new chat.
- [ ] **Conflict Resolution**: If user says "I love JS" then later "I hate JS", system should ask "Did you change your mind?" or update effectively.

## 🧩 Architecture & Modularity (New Vision)

### Layout System (VSCode-like)
- [ ] **Grid/Flex Layout Engine**
  - [ ] Rewrite main layout to support draggable/resizable panes.
  - [ ] Implement Golden Layout or React-Mosaic for window management.
  - [ ] Allow users to save/load workspace layouts.
  - [ ] "Move anything anywhere": Sidebar, Terminal, Chat, Agent Tab should be detachable/movable.
- [ ] **Component Decoupling**
  - [ ] Isolate `ModelSelector`, `ChatView`, `Terminal`, `Editor` into standalone widgets.
  - [ ] Ensure widgets manage their own internal state (e.g., Agent Tab has its own selected model, separate from Main Chat).

### Agent Tab & Terminal Redesign
- [ ] **Agent Tab Overhaul**
  - [ ] **Design**: Modular, dashboard-like view for active agents.
  - [ ] **Independent State**: Add dedicated Model Selector specific to Agent tasks (independent of Chat).
  - [ ] **Task View**: Visualize agent planning steps, tool usage, and thought process (chain-of-thought).
- [ ] **Terminal Information Architecture**
  - [ ] Redesign terminal tabs for clarity.
  - [ ] Add "Agent Output" vs "System Terminal" distinction.
  - [ ] Support split-terminal views.

---

## ✅ Completed Items Summary (2026-01-11)

**20 TODO items completed:**

1. ✅ Unified error handling middleware for IPC handlers (#5)
2. ✅ Input sanitization for all user inputs (#20)
3. ✅ Keyboard shortcuts for common actions (#56)
4. ✅ Keyboard navigation for message list (J/K keys)
5. ✅ Search/filter for settings page (#70)
6. ✅ JSDoc comments to public APIs (#87)
7. ✅ Pre-commit hooks for linting (#90)
8. ✅ Automatic code formatting (#91)
9. ✅ Request/response logging interceptor (#6)
10. ✅ Graceful shutdown with resource cleanup (#7)
11. ✅ Automatic retry with exponential backoff (#14)
12. ✅ Consistent loading states (#58)
13. ✅ Skeleton screens for async content (#59)
14. ✅ Standardized Button and Input components (#14)
15. ✅ Import sorting rules (#94)
16. ✅ Improved logging levels (DEBUG, INFO, WARN, ERROR) (#13)
17. ✅ Accessibility (ARIA) labels (#63)
18. ✅ Screen reader improvements (#11)
19. ✅ Keyboard focus traps audit (#10)
20. ✅ Standardized error handling patterns (#12)
