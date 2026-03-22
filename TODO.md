# Tengra performance Optimization TODO

## Build-Time Optimizations
- [x] Configure Terser for production minification (2 passes, mangle toplevel)
- [x] Prune console logs and traces in production
- [x] Integrate SVGO-like minification for SVG's (Handled via Vite plugins if already present)

## Startup & Runtime Performance
- [x] Enable V8 Compile Cache for fast startup (Node 22+ switch)
- [x] Integrated lightweight CSS loading splash screen to index.html
- [x] Add app-ready class to dismiss splash after React hydration
- [x] Trigger memory cleanup on window blur for backgrounded instances
- [x] Add hardware acceleration toggle (TENGRA_LOW_RESOURCE_MODE)

## Architectural Offloading
- [x] Introduce `UtilityProcessService` for background worker management
- [x] Register UtilityProcessService in DI container and global services map
- [x] Migrate `AuditLogService` to UtilityProcess worker
- [x] Migrate `TelemetryService` to UtilityProcess worker
- [x] Prototype binary IPC transport for chat message payloads

## Workspace Explorer Modernization
- [x] Replace recursive workspace tree rendering with a flat visible-row explorer core
- [x] Move explorer selection/focus state into a dedicated external store
- [x] Add inline rename/create flows directly inside explorer rows
- [x] Add explorer search/filter with reveal-active-file support
- [x] Stop explorer render-loop/stale reveal reloads that caused scroll jumps and delayed file initialization
- [x] Decouple initial explorer row rendering from git decoration fetches

## Workspace Follow-up
- [x] Remove audit logging from hot-path workspace file reads/listing and stop duplicate watcher reinitialization causing explorer lag
- [x] Investigate missing in-editor code suggestion flow in workspace editors and restore suggestion provider wiring
- [x] Add file watcher patching for workspace trees to avoid full explorer refreshes
- [x] Add explorer diagnostics badges for TypeScript, lint, test, and agent issues
- [x] Add git-aware explorer decorations and actions for staged/unstaged/history workflows
- [x] Build workspace-wide fuzzy file, symbol, and content search with reveal-in-tree
- [x] Add Open Editors, Recent Files, and Pinned Files sections to workspace explorer
- [x] Add persisted per-workspace layout profiles for sidebar, terminal, and panel states
- [x] Add inline bulk actions for multi-rename, multi-delete, move, and copy workflows
- [x] Add smart exclude handling from .gitignore and custom workspace ignore rules
- [x] Add SSH/remote workspace metadata cache with lazy hydration for explorer performance
- [x] Add background indexing for semantic search, dependency graph, and code map generation
- [x] Add workspace health checks for runtimes, env issues, permissions, symlinks, and watch limits
- [x] Add collaboration primitives such as file locks, presence, and workspace change feed
- [x] Restore and extend editor intelligence bridge for suggestions, hover, references, and code actions
- [x] Add workspace session snapshot and restore for tabs, scroll state, and expanded tree state
- [x] Add task/run orchestration for per-workspace commands, dev servers, logs, and grouped processes
- [x] Add workspace security boundary checks for secrets, dangerous commands, writable paths, and remote trust levels
- [x] Reorganize workspace settings and add workspace-scoped Monaco editor controls
- [x] Add app/editor zoom controls via Ctrl/Cmd + plus, minus, and zero while removing appearance font controls
- [x] Fixed `SecurityScanService` ENOENT error on Windows by enabling shell for `npm audit`
- [x] Resolved application startup crash by removing duplicate Git IPC handler registrations for `git:getFileHistory` and `git:getLastCommit`
- [x] Enforce single-instance editor tabs, remove recent files explorer section, move terminal appearance controls into Settings > Appearance, add editor auto-save, and relocate workspace danger zone into settings
- [x] Fix workspace diagnostics/LSP integration regressions, stabilize Monaco file-model resolution, and restore the full Vitest suite to green
- [x] Respect `.gitignore` during workspace analysis, remove static/comment-based fake issues, and stop Monaco from surfacing false TS/JSX diagnostics
- [x] Route editor diagnostics through backend LSP sessions with project-root discovery so Monaco markers reflect real workspace TypeScript/JavaScript errors
- [x] Restore Monaco minimap visibility, surface unsaved-change markers in the overview/minimap, and add Ctrl+hover/Ctrl+click import navigation through backend definitions
- [x] Limit workspace storage breakdown to root-relative directories only and merge total-size plus largest-directories into a single dashboard section
- [x] Clarify workspace line-count labeling and extract website backend/frontend repos out of the main workspace after pushing pending frontend changes

## Provider Follow-up
- [ ] Research and prototype `groq` provider support, including OAuth flow validation and current API compatibility gaps
- [ ] Research `cursor` provider support, including reverse-engineering the auth flow and identifying implementation constraints
- [ ] Research `kimi` provider support, including reverse-engineering the auth flow and identifying implementation constraints
- [ ] Evaluate whether `gemini` should be added as a distinct Google provider alongside `antigravity`
- [x] Refined AI Assistant Sidebar UI: reduced composer height (h-11), implemented configurable message footers (timestamp and model only for sidebar), added dynamic context-aware header icons, and suppressed duplicate display of identical model variants.

- [x] Resolved Antigravity Gemini authentication issues by correcting provider settings key and hiding problematic/unsupported model versions (Gemini 2.5/3.1).

- [x] Refined internationalization (i18n) system: Removed all unsupported language files and directories (ar, de, es, fr, ja, zh), updated types and schemas to strictly support English and Turkish, and added missing translations for agent characteristics and workspace states.

- [x] Removed browser extension install modal and associated translations (Turkish and English) to simplify the core application interface and reduce unnecessary dependencies.

---
*Updated on 2026-03-22*
