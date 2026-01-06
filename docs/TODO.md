# OMNI Project - Master Roadmap & TODOs

## â­  Upcoming Features (High Priority)

### Branding & Identity

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
  - [ ] Add support for saving/loading SSH connection profiles (encrypted).
  - [ ] Integrate with `ssh-agent` for key management on host OS.

## ðŸ§¥ Core Reliability & Backend

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

## ðŸŽ¨ Frontend & UI/UX

### Editor & Rendering

- [ ] **Monaco Editor Integration**
  - [ ] Fully integrate Monaco Editor (VS Code editor) for better code viewing/editing.
  - [ ] Add efficient diff view for code changes.
  - [ ] Implement minimap for long responses.
  - [ ] Add support for standard VS Code themes.
- [ ] **Markdown Rendering**
  - [ ] Improve math rendering (LaTeX/KaTeX support).
  - [ ] Add Mermaid.js diagram rendering support.
  - [ ] Fix flickers in streaming markdown responses.
  - [ ] Add "Copy as HTML/Markdown" context menu.

### Chat Interface

- [ ] **Organization**
  - [ ] Implement drag-and-drop ordering for pinned chats.
  - [ ] Add color-coding/tags for folders.
  - [ ] Add "Smart Folders" (auto-group by date, model, topic).
- [ ] **Input & Interactions**
  - [ ] Add multi-line input expansion improvements.
  - [ ] Implement "Edit Message" and branch chat from edit point.
  - [ ] Add "Regenerate with..." (select different model) option.
  - [ ] Add keyboard navigation for message list (J/K keys).

### Settings & Configuration

- [ ] **Theme Store**
  - [ ] Create a theme definition schema (JSON).
  - [ ] Build a community theme browser.
  - [ ] Allow CSS injection for power users (Custom CSS).
- [ ] **Accessibility**
  - [ ] Audit keyboard focus traps.
  - [ ] Improve screen reader (ARIA) labels throughout.
  - [ ] Add high-contrast mode.

## ðŸ§  AI & Intelligence features

### Context Management (RAG)

- [ ] **Vector Database**
  - [ ] Integrate a local vector DB (e.g., LanceDB or local Chroma/Qdrant).
  - [ ] Implement automatic embedding generation for chat history.
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
- [ ] **Autonomous Features**
  - [ ] Implement "Goal Mode": Give a high-level goal and let agent plan steps.
  - [ ] Add "Code Doctor": Auto-scan project for errors and propose fixes.
  - [ ] Add "Test Generator": Auto-generate unit tests for selected file.

## ðŸ› ï¸  DevOps & Testing

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

## ðŸ“• Documentation & Community

- [ ] **Developer Docs**
  - [ ] Generate comprehensive API documentation for internal services.
  - [ ] Create a "Contributing Guide" for open-source contributors.
  - [ ] Add architectural diagrams for IPC flow.
- [ ] **User Guides**
  - [ ] Create video tutorials for "Getting Started".
  - [ ] Write a detailed "Prompt Engineering Guide" for Orbit.
  - [ ] Add "Tip of the Day" dismissal modal.

## ðŸ§¹ Maintenance & Hygiene

- [ ] **Dependency Management**
  - [ ] Audit `package.json` for unused dependencies.
  - [ ] Automate dependency updates (Renovate/Dependabot).
  - [ ] Replace deprecated libraries.
- [ ] **Refactoring**
  - [ ] Refactor `App.tsx` global state into granular contexts or Redux/Zustand.
  - [ ] Standardize error handling patterns across `main` and `renderer`.
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
