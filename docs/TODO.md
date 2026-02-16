# Tandem Project - Comprehensive TODO List

Last updated: 2026-02-16

## Overview

This document contains a comprehensive list of tasks, improvements, and features for the Tandem project. Tasks are organized by priority and category.

**Total Tasks: 500+**

## ⚡ Quick Wins (Fast-Makeable)

Selected 10 small/contained tasks that are realistic to ship quickly:

- [x] **SEC-015**: Make secret scanning resilient to large binary artifacts
- [x] **SEC-010**: Sanitize marketplace HTML before renderer injection
- [x] **SEC-013**: Harden archive extraction command execution
- [x] **SEC-012**: Remove `shell: true` command execution in AgentTestRunner
- [x] **UI-09**: Implement chat message regenerate action
- [x] **UI-03**: Implement Command Palette (finish remaining “coming soon” surface)
- [ ] **AGENT-03**: Persist rotation settings
- [x] **EXT-04**: Implement page actions (finish popup placeholder path)
- [x] **LLM-09**: Add LLM response streaming improvements (error recovery slice first)
- [x] **COPILOT-02**: Improve rate limit handling (notifications + basic queueing)
- [x] **TEST-UI-01**: Make renderer animation motion preference hook test-safe (`matchMedia` fallback)

---

## 🔴 Critical Priority

### Security & Authentication

- [ ] **SEC-001**: Implement token rotation mechanism for all OAuth providers
  - Location: `src/main/services/security/token.service.ts`
  - Description: Add automatic token refresh before expiration for GitHub, Google, and Anthropic
  - Impact: Prevents session timeouts during long-running agent tasks
  - Sub-tasks:
    - [ ] Add token expiration monitoring
    - [ ] Implement proactive refresh (5 minutes before expiry)
    - [ ] Handle refresh failures gracefully
    - [ ] Add event bus notifications for token state changes
    - [ ] Add per-provider refresh strategies
    - [ ] Implement exponential backoff for failed refreshes
    - [ ] Add token health check endpoint
  - Progress: Unified `TokenService` now performs proactive refresh checks (`ensureFreshToken`), provider-specific refresh flows, scheduler-based refresh/sync jobs, and emits token refresh/error events.


- [ ] **SEC-003**: Audit IPC handlers for input validation
  - Location: `src/main/ipc/*.ts`
  - Description: Ensure all IPC handlers validate input using Zod schemas
  - Impact: Prevents injection attacks and malformed data issues
  - Sub-tasks:
    - [x] Create Zod schemas for all IPC payloads (tools, usage, window/shell, proxy handlers)
  - Progress: Added versioned `createValidatedIpcHandler` pipeline with validation-failure logging/callbacks, auth IPC schema coverage, schema docs generator (`npm run docs:ipc:schemas`), migration guide, and validation tests. Added validation schemas for tools, usage tracking, window/shell, and proxy IPC handlers.

- [ ] **SEC-004**: Implement secure credential export
  - Description: Allow users to export their API keys securely
  - Sub-tasks:
    - [ ] Add password-protected export feature
    - [ ] Implement import with decryption
    - [ ] Add audit log for credential exports
    - [ ] Implement export expiration
    - [ ] Add export format versioning
    - [ ] Create export verification checksum

- [ ] **SEC-006**: Implement API key encryption at rest
  - Location: `src/main/services/security/security.service.ts`
  - Sub-tasks:
    - [ ] Use OS keychain for key storage
    - [ ] Implement key derivation function
    - [ ] Add key rotation mechanism
    - [ ] Create secure key backup

- [ ] **SEC-007**: Add security audit logging
  - Location: `src/main/services/analysis/audit-log.service.ts`
  - Sub-tasks:
    - [ ] Log all API key accesses
    - [ ] Log all file system operations
  - Progress: Added authentication event logging integration in auth IPC, hash-chained integrity fields (`prevHash/hash`), integrity verification API, and retention-based rotation/pruning.

- [ ] **SEC-009**: Add input sanitization for AI prompts
  - Location: `src/main/services/llm/`
  - Sub-tasks:
    - [ ] Implement prompt injection detection
    - [ ] Add HTML/JS sanitization
    - [ ] Create prompt length limits
    - [ ] Add suspicious pattern detection

- [x] **SEC-010**: Sanitize marketplace HTML before renderer injection
  - Location: `src/renderer/features/models/components/ModelDetailsPanel.tsx:446`
  - Description: `longDescriptionHtml` is injected via `dangerouslySetInnerHTML`; sanitize or convert to safe markdown renderer before display.
  - Impact: Prevents XSS via untrusted model metadata sources.
  - Sub-tasks:
    - [x] Sanitize `longDescriptionHtml` with DOMPurify allowlist profile
    - [x] Add protocol-safe link sanitization
    - [x] Add unit test for script/event-handler payload stripping
  - Progress: `ModelDetailsPanel` now sanitizes `longDescriptionHtml` with DOMPurify and URI protocol allowlist before `dangerouslySetInnerHTML`, and renderer test coverage validates script/event-handler stripping (`src/tests/renderer/ModelDetailsPanel.test.tsx`).

- [ ] **SEC-011**: Harden SystemService shell command construction
  - Location: `src/main/services/system/system.service.ts`
  - Description: Several methods interpolate user-provided values into shell command strings (`launchApp`, `setWallpaper`, etc.).
  - Impact: Prevents command injection and shell escape vulnerabilities.
  - Sub-tasks:
    - [ ] Replace string-based `exec` calls with `spawn/execFile` argument arrays where possible
    - [ ] Add strict input allowlist/escaping for app names and file paths
    - [ ] Add security tests for command injection payloads

- [x] **SEC-012**: Remove `shell: true` command execution in AgentTestRunner
  - Location: `src/main/services/project/agent/agent-test-runner.service.ts:141`
  - Description: Test command is built from dynamic string + filter and executed with `shell: true`.
  - Impact: Prevents command injection through test filter/command parameters.
  - Sub-tasks:
    - [x] Parse command safely into executable + args without shell interpolation
    - [x] Validate/escape filter arguments
    - [ ] Add red-team test cases for malicious test command payloads
  - Progress: `AgentTestRunnerService` now builds command/args explicitly, parses custom commands into tokenized args, and executes with `spawn(..., { shell: false })`.

- [x] **SEC-013**: Harden archive extraction command execution
  - Location: `src/main/services/data/file.service.ts:101`
  - Description: `unzip()` builds shell strings with interpolated paths for `Expand-Archive`/`unzip`.
  - Impact: Prevents path/quote-based command injection in archive extraction flow.
  - Sub-tasks:
    - [x] Use non-shell process invocation with argument arrays
    - [x] Add robust path escaping for platform-specific extractors
    - [ ] Add malicious filename/path regression tests
  - Progress: `FileManagementService.unzip()` now runs PowerShell/`unzip` through non-shell argument arrays via `spawn`.

- [x] **SEC-014**: Add secure-by-default external dependency vulnerability gate
  - Location: `package.json` (`audit:deps`) + dependency pipeline
  - Description: `npm audit` currently reports high-severity vulnerability in transitive `axios` via `bundlewatch`.
  - Impact: Reduces supply-chain security risk from vulnerable transitive packages.
  - Sub-tasks:
    - [ ] Add explicit policy for dev-dependency CVE triage and acceptance
    - [x] Pin/override or replace vulnerable dependency path where possible
    - [ ] Add CI gate with documented exceptions list
  - Progress: Added dependency override for `axios` in `package.json` to force patched transitive resolution path.

- [x] **SEC-015**: Make secret scanning resilient to large binary artifacts
  - Location: `package.json` (`secrets:scan`) + scan config
  - Description: `secretlint "**/*"` fails on `release/win-unpacked/resources/app.asar` (>2GB), causing scan interruption.
  - Impact: Ensures secret scanning runs consistently in CI and local checks.
  - Sub-tasks:
    - [x] Exclude release artifacts/binaries from secret scan globs
    - [x] Add `.secretlintignore` (or equivalent) with rationale
    - [ ] Add CI step to enforce scan passes on clean checkout
  - Progress: `secrets:scan` now uses `.secretlintignore`, with release artifacts and large binaries excluded.

### Database & Persistence
- [x] **BUG-MODELS-01**: Fix "o is not iterable" crash in Marketplace and Model features
  - Path: `src/renderer/features/models/`
  - Resolved crashes in `MarketplaceGrid`, `InstalledModelsGrid`, `ModelSelectorModal`, and `ModelExplorer` hooks via defensive array checks.
- [x] **BUG-SDCPP-01**: Fix executable discovery for stable-diffusion.cpp (detect sd-cli.exe)
  - Path: `src/main/services/llm/local-image.service.ts`
  - Added support for multiple binary names (`sd.exe`, `sd-cli.exe`, `stable-diffusion.exe`) and improved recursive discovery logic.

---

## 🟠 High Priority

### Marketplace System (VSCode-style Extensions)

#### Infrastructure
- [ ] **MKT-INFRA-01**: Design marketplace architecture
  - Define manifest schema (extension.json format)
  - Design discovery API endpoints
  - Plan versioning strategy (semver compatibility)
  - Create extension capability declarations
  - Add extension dependency graph
  - Implement extension conflict detection
  - Create extension compatibility matrix

- [ ] **MKT-INFRA-02**: Create marketplace backend service
  - Location: `src/main/services/marketplace/`
  - Implement extension registry with search capability
  - Add version management and dependency resolution
  - Create extension storage and retrieval
  - Add extension statistics tracking
  - Implement extension rating aggregation
  - Add extension download tracking
  - Create extension update notification

- [ ] **MKT-INFRA-03**: Implement extension loader/unloader with sandboxing
  - Location: `src/main/services/extension/`
  - Create isolated execution context for extensions
  - Implement hot-reload capability for development
  - Add extension lifecycle hooks
  - Implement extension crash recovery
  - Add extension resource limits
  - Create extension debugging interface
  - Add extension performance monitoring

- [ ] **MKT-INFRA-04**: Add extension lifecycle management
  - Install/Update/Remove operations
  - Enable/Disable toggle per extension
  - Handle extension dependencies
  - Add extension conflict detection
  - Implement extension rollback
  - Add extension backup before update
  - Create extension migration path

- [ ] **MKT-INFRA-05**: Create extension permission system
  - File system access permissions
  - Network access permissions
  - IPC method whitelist
  - UI modification permissions
  - Add permission request UI
  - Implement permission revocation
  - Create permission audit log

- [ ] **MKT-INFRA-06**: Implement extension update mechanism
  - Automatic update checking
  - Background download and install
  - Update notification system
  - Rollback on failed update
  - Add update scheduling
  - Implement delta updates
  - Add update verification

- [ ] **MKT-INFRA-07**: Create extension storage service
  - Implement extension data isolation
  - Add extension storage quotas
  - Create extension data export
  - Add extension data migration

- [ ] **MKT-INFRA-08**: Implement extension configuration system
  - Add extension settings schema
  - Create settings UI generation
  - Implement settings validation
  - Add settings migration

#### UI Components
- [ ] **MKT-UI-01**: Design marketplace browser tab
  - Location: `src/renderer/features/marketplace/`
  - Create responsive grid layout
  - Add category navigation sidebar
  - Implement featured extensions carousel
  - Add trending extensions section
  - Create recently updated section
  - Add personalized recommendations
  - Implement search with filters

- [ ] **MKT-UI-02**: Implement extension card component
  - Display rating, download count, description
  - Add install/uninstall button states
  - Show compatibility indicators
  - Add screenshot preview gallery
  - Implement hover preview
  - Add quick actions menu
  - Show update available badge

- [ ] **MKT-UI-03**: Add search/filter functionality
  - Full-text search across extensions
  - Filter by categories and tags
  - Sort by popularity, rating, recent updates
  - Save search preferences
  - Add search suggestions
  - Implement search history
  - Add advanced search syntax

- [ ] **MKT-UI-04**: Create extension detail view
  - README rendering with markdown support
  - Reviews and ratings section
  - Version history and changelog
  - Related extensions suggestions
  - Add dependency tree view
  - Show permission requirements
  - Add installation statistics

- [ ] **MKT-UI-05**: Add installed extensions manager
  - List all installed extensions
  - Update all / update individual
  - Configure extension settings
  - View extension logs
  - Add extension diagnostics
  - Show extension resource usage
  - Implement extension profiles

- [ ] **MKT-UI-06**: Create extension installation wizard
  - Show installation progress
  - Display permission requests
  - Add configuration steps
  - Show installation summary

- [ ] **MKT-UI-07**: Implement extension rating UI
  - Add star rating component
  - Create review form
  - Show rating distribution
  - Add helpful vote system

- [ ] **MKT-UI-08**: Add extension comparison view
  - Side-by-side comparison
  - Feature matrix
  - Rating comparison
  - Download statistics

#### Extension Types
- [ ] **MKT-EXT-01**: MCP Server Extensions
  - Allow custom MCP server implementations
  - Provide SDK for MCP server development
  - Add MCP server configuration UI
  - Create MCP server templates
  - Add MCP server debugging
  - Implement MCP server testing
  - Add MCP server documentation generator

- [ ] **MKT-EXT-02**: Theme Extensions
  - Custom color schemes and UI themes
  - Icon packs and font options
  - Syntax highlighting themes
  - Add theme preview
  - Implement theme mixing
  - Add theme import/export
  - Create theme editor

- [ ] **MKT-EXT-03**: Command Extensions
  - Custom slash commands for chat
  - Keyboard shortcut bindings
  - Command palette integration
  - Add command autocomplete
  - Implement command chaining
  - Add command history
  - Create command builder UI

- [ ] **MKT-EXT-04**: Language Extensions
  - Language server protocol support
  - Custom syntax highlighting
  - Code formatter integration
  - Add language detection
  - Implement multi-language support
  - Add language-specific tools
  - Create language configuration

- [ ] **MKT-EXT-05**: Agent Template Extensions
  - Pre-configured agent personas
  - Custom tool configurations
  - Agent behavior modifiers
  - Add template marketplace
  - Implement template sharing
  - Add template versioning
  - Create template builder

- [ ] **MKT-EXT-06**: Widget Extensions
  - Custom dashboard widgets
  - Sidebar panels
  - Status bar items
  - Add widget configuration
  - Implement widget communication
  - Add widget theming
  - Create widget gallery

- [ ] **MKT-EXT-07**: Integration Extensions
  - External service integrations
  - Webhook handlers
  - API connectors
  - Add OAuth flow support
  - Implement credential management
  - Add integration testing
  - Create integration templates

#### Security
- [ ] **MKT-SEC-01**: Extension signing and verification
  - Implement code signing for extensions
  - Verify signatures before installation
  - Add trusted publisher system
  - Create signing key management
  - Add signature revocation
  - Implement certificate pinning
  - Add signature timestamping

- [ ] **MKT-SEC-02**: Sandboxed execution environment
  - Isolate extension code from main process
  - Resource usage limits (CPU, memory, time)
  - Network request filtering
  - Add sandbox escape detection
  - Implement sandbox logging
  - Add sandbox configuration
  - Create sandbox testing tools

- [ ] **MKT-SEC-03**: Malware scanning and code review flow
  - Automated security scanning
  - Manual review process for new extensions
  - Report malicious extension
  - Add vulnerability database
  - Implement dependency scanning
  - Add security score
  - Create security advisory system

- [ ] **MKT-SEC-04**: User reviews and rating system
  - Verified purchase/download reviews
  - Rating aggregation and display
  - Review moderation
  - Add review helpfulness voting
  - Implement review spam detection
  - Add review response system
  - Create review analytics

- [ ] **MKT-SEC-05**: Extension telemetry and crash reporting
  - Optional usage analytics
  - Automatic crash report submission
  - Performance metrics collection
  - Add telemetry opt-out
  - Implement data anonymization
  - Add telemetry dashboard
  - Create compliance reporting

#### Developer Experience
- [ ] **MKT-DEV-01**: Extension SDK/templates/CLI
  - Create extension scaffolding tool
  - Provide TypeScript types and utilities
  - Add development server with hot reload
  - Create extension testing framework
  - Add extension debugging tools
  - Implement extension profiling
  - Add extension documentation generator

- [ ] **MKT-DEV-02**: Extension developer documentation
  - Getting started guide
  - API reference
  - Best practices
  - Example extensions
  - Add video tutorials
  - Create API playground
  - Add interactive examples

- [ ] **MKT-DEV-03**: Local extension development mode
  - Hot reload for local extensions
  - Debug logging and inspection
  - Extension DevTools panel
  - Add extension reload shortcut
  - Implement extension state inspection
  - Add performance profiling
  - Create memory debugging

- [ ] **MKT-DEV-04**: Extension publishing workflow
  - CLI publish command
  - Version validation
  - Automated testing before publish
  - Add publishing checklist
  - Implement release notes generation
  - Add publishing preview
  - Create rollback capability

- [ ] **MKT-DEV-05**: Extension analytics dashboard
  - Download statistics
  - User engagement metrics
  - Error rate tracking
  - Add revenue tracking
  - Implement A/B testing
  - Add user demographics
  - Create custom reports

### Model Marketplace (HuggingFace Integration)

### Agent System Enhancements

- [ ] **AGENT-03**: Persist rotation settings
  - Location: `src/main/services/project/agent/agent-provider-rotation.service.ts:526`
  - Save model rotation preferences per project
  - Restore settings on app restart
  - Add rotation strategy configuration
  - Implement rotation analytics
  - Add rotation recommendations
  - Create rotation presets
  - Add rotation testing

- [ ] **AGENT-04**: Add agent checkpoint compression
  - Compress old checkpoints to save disk space
  - Implement incremental checkpoint storage
  - Add checkpoint cleanup policy
  - Create checkpoint browser
  - Add checkpoint diff view
  - Implement checkpoint merge
  - Add checkpoint export

- [ ] **AGENT-05**: Implement agent collaboration voting UI
  - Display voting sessions in real-time
  - Allow manual override of consensus decisions
  - Show model disagreement details
  - Add voting history
  - Implement voting analytics
  - Add voting configuration
  - Create voting templates

- [ ] **AGENT-06**: Add agent task templates
  - Pre-defined task templates for common operations
  - Custom template creation
  - Template sharing between projects
  - Add template marketplace
  - Implement template versioning
  - Add template validation
  - Create template builder

- [ ] **AGENT-07**: Implement agent memory persistence
  - Long-term memory storage
  - Cross-session memory retrieval
  - Memory importance scoring
  - Add memory decay
  - Implement memory consolidation
  - Add memory search
  - Create memory visualization

- [ ] **AGENT-08**: Add agent performance metrics
  - Task completion rate tracking
  - Average execution time
  - Error rate monitoring
  - Resource usage tracking
  - Add performance alerts
  - Implement performance comparison
  - Create performance reports

- [ ] **AGENT-09**: Implement agent state machine visualization
  - Location: `src/main/services/project/agent/agent-state-machine.ts`
  - Create state transition diagram
  - Add real-time state updates
  - Show state history
  - Implement state debugging
  - Add state rollback
  - Create state export

- [x] **AGENT-10**: Add agent tool execution improvements
  - Implement tool timeout handling
  - Add tool retry logic
  - Create tool execution queue
  - Add tool dependency resolution
  - Implement tool parallelization
  - Add tool result caching
  - Create tool execution logs
  - Completed: Added tool timeouts, caching for idempotent tools, semi-parallel tool execution (3 concurrent calls), and retry logic in `ToolExecutor` and `AgentTaskExecutor`.

- [x] **AGENT-11**: Implement agent context management
  - Add context window optimization
  - Implement context summarization
  - Add context prioritization
  - Create context visualization
  - Add context export
  - Implement context comparison
  - Add context templates
  - Completed: Integrated `ContextWindowService` for real-time monitoring, implemented automated history pruning/optimization, and added LLM-based summarization of truncated history.

- [x] **AGENT-12**: Add agent error recovery improvements
  - Implement automatic retry strategies
  - Add error classification
  - Create error recovery templates
  - Add error notification
  - Implement error analytics
  - Add error prediction
  - Create error documentation
  - Completed: Added error categorization (timeout, rate-limit, permissions, etc.) in `ToolExecutor`, implemented exponential backoff retries, and added specific recovery advice injection for agents.

### LLM Service Improvements

- [x] **LLM-02**: Implement model fallback chain
  - Location: `src/main/services/llm/model-fallback.service.ts`
  - Configure fallback models per provider
  - Automatic failover on errors
  - Circuit breaker pattern
  - Add fallback analytics
  - Implement fallback testing
  - Add fallback configuration UI
  - Create fallback recommendations
  - Completed: `ModelFallbackService` implemented and wired into `LLMService` (`executeWithFallback`), including failover attempts, retry/backoff, circuit breaker state, attempt history/analytics, and unit tests (`src/tests/main/services/llm/model-fallback.service.test.ts`).

- [x] **LLM-03**: Add response caching
  - Cache identical requests
  - Configurable cache TTL
  - Cache invalidation on model change
  - Add cache statistics
  - Implement cache warming
  - Add cache sharing
  - Create cache management UI
  - Completed: `ResponseCacheService` integrated in `LLMService.chat` with request-hash keys, TTL support, model-aware keys, and cache stats APIs.

- [ ] **LLM-05**: Add multi-modal support improvements
  - Image input preprocessing
  - Audio transcription integration
  - Video frame extraction
  - Add file type detection
  - Implement size optimization
  - Add format conversion
  - Create multi-modal preview

- [x] **LLM-06**: Implement context window optimization
  - Location: `src/main/services/llm/context-window.service.ts`
  - Smart context truncation
  - Important message preservation
  - Context compression
  - Add context preview
  - Implement context testing
  - Add context recommendations
  - Create context analytics
  - Completed: `ContextWindowService` provides token-fit checks, utilization metrics, truncation strategies, system/recent message preservation, and recommendation settings; used by LLM request flow.

- [x] **LLM-07**: Add LLM provider health monitoring
  - Location: `src/main/services/llm/ollama-health.service.ts`
  - Implement health check scheduling
  - Add provider status dashboard
  - Create health alerts
  - Add health history
  - Implement auto-recovery
  - Add health analytics
  - Create health reports
  - Completed: `OllamaHealthService` includes scheduled checks, online/offline status transitions, emitted health events/alerts, force-check support, and IPC integration for provider status.

- [x] **LLM-08**: Implement LLM request queuing
  - Location: `src/main/services/llm/multi-llm-orchestrator.service.ts`
  - Add priority queue
  - Implement request scheduling
  - Add queue management UI
  - Create queue analytics
  - Add queue alerts
  - Implement queue optimization
  - Add queue testing
  - Completed: `MultiLLMOrchestrator` implements provider queues, priority sorting, concurrency scheduling, cancellation paths, and provider queue/latency/error stats.

- [x] **LLM-09**: Add LLM response streaming improvements
  - Implement chunk buffering
  - Add streaming error recovery
  - Create streaming analytics
  - Add streaming preview
  - Implement streaming pause/resume
  - Add streaming throttling
  - Create streaming testing
  - Progress: Stream error chunks now preserve partial output and append a recovery suffix instead of hard-failing; generator error fallback also preserves partial assistant content before interruption text.

- [x] **LLM-10**: Implement LLM model registry improvements
  - Location: `src/main/services/llm/model-registry.service.ts`
  - Add model capability detection
  - Implement model comparison
  - Add model recommendations
  - Create model analytics
  - Add model alerts
  - Implement model testing
  - Add model documentation
  - Completed: `ModelRegistryService` aggregates providers, infers/normalizes model capabilities, refreshes cache on schedule, emits registry update events, and has service tests.

---

## 🟡 Medium Priority

### Changelog System


### Terminal Improvements

### UI/UX Improvements

- [x] **UI-01**: Reimplement keyboard focus in MessageList
  - Location: `src/renderer/features/chat/components/MessageList.tsx:73`
  - Add arrow key navigation between messages
  - Implement focus indicators
  - Add message selection for actions
  - Create focus persistence
  - Add focus analytics
  - Implement focus testing
  - Add focus documentation
  - Progress: `MessageList` now supports keyboard navigation (`ArrowUp/ArrowDown/Home/End`), focus indicators, Enter-based message selection, session focus persistence by message id, and keyboard regenerate (`R`) for focused assistant messages.

- [x] **UI-02**: Split ModelSelectorModal into smaller subcomponents
  - Location: `src/renderer/features/models/components/ModelSelectorModal.tsx:56`
  - Create: ModelList, ModelFilters, ModelDetails
  - Improve performance with virtualization
  - Add component documentation
  - Create component tests
  - Add component examples
  - Implement component versioning
  - Progress: `ModelSelectorModal` has been split into dedicated subcomponents (`ModelSelectorHeader`, `ModelSelectorModeTabs`, `ModelSelectorSearch`, `ModelSelectorCategoryList`) under `components/model-selector/`, and category rendering now supports virtualization via `react-virtuoso`.

- [x] **UI-03**: Implement Command Palette
  - Currently shows "coming soon"
  - Add keyboard shortcut (Ctrl+Shift+P)
  - Index all available commands
  - Add recent commands history
  - Implement command search
  - Add command categories
  - Create command favorites
  - Progress: Global Command Palette is implemented (`src/renderer/components/layout/CommandPalette.tsx`) and wired in `App.tsx` with keyboard shortcut handling (`Ctrl/Cmd+K`). Project workspace `CommandStrip` now opens it via `app:open-command-palette` event.

- [x] **UI-04**: Implement list view for projects
  - Currently shows "coming soon"
  - Add toggle between grid and list views
  - Include sortable columns
  - Add bulk selection
  - Implement list filtering
  - Add list export
  - Create list presets
  - Progress: Projects page now supports real grid/list toggle with list-mode sortable columns (name/updated), existing bulk selection controls, shared search filtering, CSV export, and persistent list presets/sort/view settings.

- [x] **UI-05**: Implement logs viewer
  - Currently shows "coming soon"
  - Real-time log streaming
  - Filter by log level and source
  - Export logs feature
  - Add log search
  - Implement log highlighting
  - Add log analytics
  - Progress: Project logs tab now includes live terminal-backed logs, text + level + source filtering, export to `.txt`, term highlighting, clear, auto-scroll, and level analytics counters (`ProjectLogsTab`).

- [x] **UI-06**: Add keyboard shortcuts panel
  - Display all available shortcuts
  - Allow customization of shortcuts
  - Import/export shortcut configurations
  - Add shortcut categories
  - Implement shortcut search
  - Add shortcut testing
  - Create shortcut documentation
  - Progress: Keyboard shortcuts modal is fully wired and now supports searchable shortcut catalog, per-action remapping, per-action reset, full reset, JSON import/export, and runtime propagation of updated bindings through `useKeyboardShortcuts` + localStorage sync.

- [x] **UI-09**: Implement chat message regenerate action
  - Location: `src/renderer/features/chat/components/MessageActions.tsx:249`
  - Wire regenerate button to actual retry/regenerate flow
  - Preserve message context and selected model/provider
  - Add loading/error state for regenerate action
  - Add analytics event for regenerate usage
  - Remove "coming soon" placeholder logger call
  - Progress: Message bubble actions now include regenerate in active chat UI path, wired through `useChatManager.regenerateMessage` to resend the prior user prompt with current chat context.

- [x] **UI-08**: Add drag and drop file support
  - Drag files into chat input
  - Drag projects to folders
  - Drag images for multi-modal input
  - Add drop preview
  - Implement drop validation
  - Add drop analytics
  - Create drop testing
  - Completed: Chat input drag/drop with visual drop preview (`ChatInput` + `useChatInputController` + `useAttachments`), project tree drag-to-folder move in workspace explorer (`ProjectWorkspace`), and file validation (type/size + dangerous extension checks).

### Image Generation

- [ ] **IMG-01**: Implement ComfyUI integration
  - Location: `src/main/services/llm/local-image.service.ts:407`
  - Add WebSocket connection to ComfyUI
  - Implement workflow execution
  - Handle workflow templates
  - Add workflow editor
  - Implement workflow sharing
  - Add workflow testing
  - Create workflow documentation

- [ ] **IMG-02**: Add image generation history
  - Store generated images with metadata
  - Allow regeneration with same parameters
  - Image comparison view
  - Add image search
  - Implement image export
  - Add image analytics
  - Create image testing

- [ ] **IMG-03**: Implement image editing capabilities
  - Inpainting/outpainting support
  - Image-to-image transformation
  - Style transfer
  - Add editing presets
  - Implement editing history
  - Add editing analytics
  - Create editing testing

- [ ] **IMG-04**: Add image gallery improvements
  - Location: `src/renderer/features/chat/components/GalleryView.tsx`
  - Masonry layout
  - Image zoom and pan
  - Batch download
  - Add gallery search
  - Implement gallery filtering
  - Add gallery analytics
  - Create gallery testing

- [ ] **IMG-05**: Implement Stable Diffusion optimizations
  - Location: `src/main/ipc/sd-cpp.ts`
  - Memory optimization for large models
  - Batch generation
  - Model switching without restart
  - Add performance monitoring
  - Implement model caching
  - Add generation queue
  - Create generation testing

- [ ] **IMG-06**: Add image generation presets
  - Style presets
  - Size presets
  - Quality presets
  - Add preset sharing
  - Implement preset validation
  - Add preset analytics
  - Create preset testing

- [ ] **IMG-07**: Implement image generation scheduling
  - Queue management
  - Priority scheduling
  - Resource allocation
  - Add scheduling UI
  - Implement scheduling analytics
  - Add scheduling alerts
  - Create scheduling testing

- [ ] **IMG-08**: Add image generation comparison
  - Side-by-side comparison
  - Parameter comparison
  - Quality metrics
  - Add comparison export
  - Implement comparison sharing
  - Add comparison analytics
  - Create comparison testing

### SSH & Remote Development

- [ ] **SSH-01**: Add SSH key management UI
  - Generate new SSH keys
  - Import existing keys
  - Manage known hosts
  - Key passphrase handling
  - Add key rotation
  - Implement key backup
  - Create key testing

- [ ] **SSH-02**: Implement SSH tunnel support
  - Local and remote port forwarding
  - Dynamic SOCKS proxy
  - Tunnel status monitoring
  - Add tunnel presets
  - Implement tunnel sharing
  - Add tunnel analytics
  - Create tunnel testing

- [ ] **SSH-03**: Add remote file search
  - Search files on remote servers
  - Index remote directories
  - Content search with grep
  - Add search history
  - Implement search export
  - Add search analytics
  - Create search testing

- [ ] **SSH-04**: Implement remote terminal improvements
  - Location: `src/main/services/project/ssh.service.ts`
  - Better reconnection handling
  - Connection keep-alive
  - Multi-hop SSH support
  - Add connection pooling
  - Implement connection testing
  - Add connection analytics
  - Create connection documentation

- [ ] **SSH-05**: Add SFTP improvements
  - Parallel file transfers
  - Transfer queue management
  - Conflict resolution UI
  - Add transfer scheduling
  - Implement transfer resume
  - Add transfer analytics
  - Create transfer testing

- [ ] **SSH-06**: Implement remote development containers
  - Dev container support
  - Container lifecycle management
  - Environment synchronization
  - Add container templates
  - Implement container sharing
  - Add container analytics
  - Create container testing

- [ ] **SSH-07**: Add SSH connection profiles
  - Profile management
  - Profile templates
  - Profile sharing
  - Add profile validation
  - Implement profile testing
  - Add profile analytics
  - Create profile documentation

- [ ] **SSH-08**: Implement SSH session recording
  - Session recording
  - Session playback
  - Session export
  - Add session search
  - Implement session sharing
  - Add session analytics
  - Create session testing

### Context & Memory System

- [ ] **MEM-01**: Improve embedding quality
  - Location: `src/main/services/llm/embedding.service.ts`
  - Add embedding model selection
  - Implement embedding caching
  - Handle dimension mismatches
  - Add embedding analytics
  - Implement embedding testing
  - Add embedding optimization
  - Create embedding documentation

- [ ] **MEM-02**: Enhance context retrieval
  - Location: `src/main/services/llm/context-retrieval.service.ts`
  - Add relevance scoring
  - Implement context deduplication
  - Add context summarization
  - Create context visualization
  - Add context export
  - Implement context testing
  - Add context analytics

- [ ] **MEM-03**: Implement advanced memory features
  - Location: `src/main/services/llm/advanced-memory.service.ts`
  - Memory confirmation workflow
  - Memory importance scoring
  - Memory expiration
  - Add memory search
  - Implement memory sharing
  - Add memory analytics
  - Create memory testing

- [ ] **MEM-04**: Add memory visualization
  - Memory graph view
  - Entity relationship diagram
  - Timeline view of memories
  - Add memory export
  - Implement memory filtering
  - Add memory analytics
  - Create memory testing

- [ ] **MEM-05**: Implement memory export/import
  - Export memories to JSON
  - Import from backup
  - Memory migration between projects
  - Add memory validation
  - Implement memory testing
  - Add memory analytics
  - Create memory documentation

- [ ] **MEM-06**: Add memory search improvements
  - Full-text search
  - Semantic search
  - Hybrid search
  - Add search suggestions
  - Implement search history
  - Add search analytics
  - Create search testing

- [ ] **MEM-07**: Implement memory categorization
  - Automatic categorization
  - Manual categorization
  - Category management
  - Add category analytics
  - Implement category testing
  - Add category sharing
  - Create category documentation

- [ ] **MEM-08**: Add memory versioning
  - Version tracking
  - Version comparison
  - Version rollback
  - Add version analytics
  - Implement version testing
  - Add version sharing
  - Create version documentation

### Git Integration

- [x] **GIT-01**: Add git conflict resolution UI
  - Location: `src/main/services/project/git.service.ts`
  - Visual diff for conflicts
  - Merge tool integration
  - Conflict markers explanation
  - Add conflict analytics
  - Implement conflict testing
  - Add conflict sharing
  - Create conflict documentation
  - Progress: Added advanced conflict resolution panel in `ProjectGitTab` with conflict list, status explanations, analytics summary, resolve actions (`ours`/`theirs`/manual), merge-tool launch, and JSON export path via new advanced git IPC handlers.

- [x] **GIT-02**: Implement git stash management
  - Stash list view
  - Stash apply/pop/drop
  - Stash with custom message
  - Add stash search
  - Implement stash export
  - Add stash analytics
  - Create stash testing
  - Progress: Implemented stash management UI + IPC for list/create/apply/pop/drop operations, stash search, and patch export from stash refs.

- [x] **GIT-03**: Add git blame integration
  - Inline blame information
  - Blame sidebar panel
  - Commit details on hover
  - Add blame analytics
  - Implement blame testing
  - Add blame sharing
  - Create blame documentation
  - Progress: Added blame tooling with file-path loading, inline line-level blame view, commit hover/details sidebar behavior, and commit detail fetch channel in advanced git panel.

- [x] **GIT-04**: Implement git rebase support
  - Interactive rebase UI
  - Rebase conflict resolution
  - Rebase abort/continue
  - Add rebase analytics
  - Implement rebase testing
  - Add rebase sharing
  - Create rebase documentation
  - Progress: Added rebase status/plan/start/continue/abort IPC + UI controls, including conflict-aware rebase status and commit-plan preview in the advanced git panel.

- [x] **GIT-05**: Add git submodule support
  - Submodule status display
  - Submodule update/init
  - Submodule management UI
  - Add submodule analytics
  - Implement submodule testing
  - Add submodule sharing
  - Create submodule documentation
  - Progress: Added submodule status display and management actions (init/update/update-remote/sync/add/remove) with `.gitmodules` metadata wiring.

- [x] **GIT-06**: Implement git flow support
  - Git flow templates
  - Branch management
  - Release management
  - Add flow analytics
  - Implement flow testing
  - Add flow sharing
  - Create flow documentation
  - Progress: Added git-flow style helpers (status by branch type, start flow branch, finish flow branch) with template-driven branch naming in the advanced panel.

- [x] **GIT-07**: Add git hooks management
  - Hook templates
  - Hook installation
  - Hook testing
  - Add hook analytics
  - Implement hook sharing
  - Add hook validation
  - Create hook documentation
  - Progress: Added hook management APIs/UI for listing installed hooks, installing templates/custom scripts, validation (shebang + executable), test execution, and hook export payload generation.

- [x] **GIT-08**: Implement git statistics
  - Commit statistics
  - Author statistics
  - File statistics
  - Add statistics export
  - Implement statistics sharing
  - Add statistics analytics
  - Create statistics testing
  - Progress: Added repository statistics APIs/UI (total commits, author stats, file stats, activity map) plus CSV export for author statistics.

### Code Intelligence

- [x] **CODE-01**: Improve code symbol parsing
  - Location: `src/main/services/project/code-intelligence.service.ts`
  - Add more language support
  - Improve parsing accuracy
  - Add symbol relationships
  - Implement symbol testing
  - Add symbol analytics
  - Create symbol documentation
  - Add symbol visualization
  - Progress: `CodeIntelligenceService` indexes symbols/chunks, supports TS/JS, Python, and Go parsing, and now exposes symbol analytics + relationship graph primitives (`code:getSymbolAnalytics`, `code:getSymbolRelationships`) for richer symbol intelligence.

- [x] **CODE-02**: Implement code navigation
  - Go to definition
  - Find references
  - Go to implementation
  - Add navigation history
  - Implement navigation testing
  - Add navigation analytics
  - Create navigation documentation
  - Progress: Added `code:findDefinition`, `code:findReferences`, `code:findImplementations`, `code:getFileOutline`, plus navigation history controls (back/forward) in `ProjectCodeTab`.

- [x] **CODE-03**: Add code refactoring support
  - Rename symbol
  - Extract method
  - Move symbol
  - Add refactoring preview
  - Implement refactoring testing
  - Add refactoring analytics
  - Create refactoring documentation
  - Progress: Added concrete rename-symbol refactor primitives with preview/apply flows (`code:previewRenameSymbol`, `code:applyRenameSymbol`) plus dashboard UI actions for safe preview-before-apply workflow.

- [x] **CODE-04**: Implement code documentation generation
  - JSDoc generation
  - README generation
  - API documentation
  - Add documentation templates
  - Implement documentation testing
  - Add documentation analytics
  - Create documentation sharing
  - Progress: Added `code:generateFileDocumentation` and project-level docs summary generation (`code:generateProjectDocumentation`) with dashboard UI actions for both file and project docs previews.

- [x] **CODE-05**: Add code quality analysis
  - Complexity analysis
  - Code smell detection
  - Security analysis
  - Add quality scoring
  - Implement quality testing
  - Add quality analytics
  - Create quality documentation
  - Progress: Added `code:analyzeQuality` metrics with complexity, long lines, TODO-like markers, console usage, plus security-smell detection (`eval`, `new Function`, `innerHTML`, `exec`, `shell: true`) and surfaced core metrics in the dashboard `code` tab.

---

## 🟢 Low Priority / Future Enhancements

### Test Coverage Improvements

### Performance Optimizations

### Internationalization

- [ ] **I18N-01**: Complete translations for all locales
  - Audit missing keys in all language files
  - Add context comments for translators
  - Implement translation memory

- [x] **I18N-02**: Add RTL support
  - Implement CSS logical properties
  - Test Arabic and Hebrew layouts
  - Add RTL-specific icons

- [x] **I18N-03**: Add locale-specific formatting
  - Date/time formatting
  - Number formatting
  - Currency display

- [x] **I18N-04**: Add language detection
  - Detect system language on first run
  - Prompt for language selection
  - Remember language preference

- [ ] **I18N-05**: Add locale-specific AI behavior
  - Model prompts in user's language
  - Locale-aware responses
  - Regional model preferences

- [x] **I18N-07**: Implement pluralization
  - Add plural rules for all languages
  - Test plural forms
  - Add plural documentation

- [ ] **I18N-08**: Add locale-specific validation
  - Phone number validation
  - Address validation
  - Name validation

### Browser Extension

- [ ] **EXT-01**: Add Firefox support
  - Location: `extension/`
  - Adapt manifest for Firefox
  - Handle Firefox-specific APIs
  - Test on Firefox

- [ ] **EXT-02**: Implement page summarization
  - Extract key content from pages
  - Generate summaries with AI
  - Cache summaries per URL
  - Progress: Popup suggestion flow can trigger page-content extraction and AI summary prompts (`extension/popup/popup.js`, `extension/content/content-script.js`); URL-level summary caching is not implemented yet.

- [x] **EXT-03**: Add form auto-fill
  - Detect form fields
  - AI-powered form filling
  - Form data templates
  - Completed: `FormIntelligence` implements field detection/classification, form analysis, profile-based autofill, validation extraction, and profile template storage in extension local storage.

- [x] **EXT-04**: Implement page actions
  - Quick actions menu
  - Custom action recording
  - Action sharing
  - Progress: Core page actions are implemented in the content script (`extract`, `click`, `fill`, `navigate`, `findElements`, highlighting, screenshot helpers), and popup `checkForPageActions` now dispatches real `PAGE_ACTION` click requests instead of placeholder messaging.

- [x] **EXT-05**: Add multi-tab operations
  - Location: `extension/features/multi-tab.js`
  - Batch operations across tabs
  - Tab group management
  - Cross-tab search
  - Completed: `MultiTabManager` implements batch open/execute flows, tab grouping lifecycle, cross-tab searching/filtering, shared context, and multi-tab aggregation utilities.

- [ ] **EXT-06**: Add extension synchronization
  - Sync settings across devices
  - Sync custom actions
  - Sync templates

- [ ] **EXT-07**: Implement extension analytics
  - Usage tracking
  - Performance metrics
  - Error reporting

- [ ] **EXT-08**: Add extension customization
  - Custom themes
  - Custom shortcuts
  - Custom actions

### MCP (Model Context Protocol)

---

## 📊 Code Quality Initiatives

### IPC Handler Coverage

**Current Status (as of 2026-02-12):**
- Total IPC handlers: 51 files
- Handlers with tests: 30 files (59%)
- Handlers without tests: 21 files (41%)

**Target: 80% coverage by end of Q1 2026**

### Code Refactoring


---

## 🐛 Known Issues

### Bugs to Fix


---

## 📅 Release Milestones

### v1.3.0 (Target: Q2 2026)
- Marketplace system MVP
- HuggingFace model integration
- Agent collaboration improvements
- Performance optimizations

### v1.4.0 (Target: Q3 2026)
- Extension system beta
- ComfyUI integration
- SSH tunneling
- Advanced memory features

### v2.0.0 (Target: Q4 2026)
- Plugin ecosystem
- Collaborative sessions
- Performance dashboard
- Mobile companion app

---

## 🔧 Technical Debt

### Architecture

- [ ] **DEBT-01**: Migrate to React Server Components
  - Evaluate feasibility for Electron
  - Identify components for migration
  - Performance benchmarking

- [ ] **DEBT-03**: Refactor IPC communication
  - Create type-safe IPC client
  - Add request/response validation
  - Implement retry logic

### Infrastructure

- [ ] **DEBT-05**: Add monitoring and observability
  - Implement OpenTelemetry
  - Add performance tracing
  - Create health dashboards

- [ ] **DEBT-06**: Improve error tracking
  - Implement Sentry integration
  - Add error grouping
  - Create error analytics

- [ ] **DEBT-07**: Refactor oversized TerminalPanel into smaller modules
  - Location: `src/renderer/features/terminal/TerminalPanel.tsx:566`
  - Extract panel state + command handling into focused hooks
  - Split view/layout sections into subcomponents
  - Remove temporary max-lines suppression after modularization
  - Add regression tests for terminal interactions
  - Progress: Extracted command history/task-runner state, loading effects, and execution flows into `useTerminalCommandTools` (`src/renderer/features/terminal/hooks/useTerminalCommandTools.ts`), moved command-history/task-runner UI into `src/renderer/features/terminal/components/TerminalCommandPanels.tsx`, moved search overlay into `src/renderer/features/terminal/components/TerminalSearchOverlay.tsx`, moved recordings overlay into `src/renderer/features/terminal/components/TerminalRecordingPanel.tsx`, moved multiplexer overlay into `src/renderer/features/terminal/components/TerminalMultiplexerPanel.tsx`, and moved split presets/controls into `src/renderer/features/terminal/components/TerminalSplitControls.tsx`.

---

## 🧪 Service-Specific TODOs

### Copilot Service
- [ ] **COPILOT-01**: Move Copilot token refresh into Rust token service
  - Location: `src-tauri/services/token-service` + `src/main/services/security/token.service.ts`
  - Move refresh orchestration from Electron to Rust service
  - Keep Electron side as bridge (status/trigger)
  - Add compatibility checks for existing auth/settings flow

- [x] **COPILOT-02**: Improve rate limit handling
  - Add rate limit prediction
  - Implement request queuing
  - Add rate limit notifications
  - Progress: Added bounded in-service Copilot request queue with queued notifications and queue-full protection, plus low-remaining and exhausted rate-limit notifications.

---

## 📝 Feature Requests

### User-Requested Features

- [ ] **FEAT-01**: Add voice input support
  - Speech-to-text integration
  - Voice commands
  - Multi-language support
  - Progress: Speech-to-text and voice output foundations are implemented (`useSpeechRecognition`/`useVoiceInput`, `useTextToSpeech`, chat input/audio overlay wiring, and localized voice UI strings); explicit voice-command intent layer is still pending.

- [ ] **FEAT-02**: Add collaborative editing
  - Real-time collaboration
  - Presence indicators
  - Conflict resolution

- [ ] **FEAT-03**: Add code execution sandbox
  - Safe code execution
  - Multiple language support
  - Output visualization

- [ ] **FEAT-04**: Add custom model fine-tuning
  - Fine-tuning UI
  - Dataset preparation
  - Model evaluation

- [ ] **FEAT-05**: Add workflow automation
  - Custom workflows
  - Trigger conditions
  - Action templates

### New Ideas & Systems

- [ ] **AI-SYS-01**: Build a no-code "Create Your Own AI" Studio (local-first)
  - Create guided wizard: Goal -> Data -> Train -> Evaluate -> Deploy
  - Allow users to build assistants without writing code
  - Include template presets (Support bot, Research bot, Sales bot, Coding bot)
  - Add one-click local runtime setup (Ollama/llama.cpp profiles)
  - Save and version each user-created AI configuration

- [ ] **AI-SYS-02**: Add dataset onboarding and preparation pipeline
  - Upload files/folders/URLs and auto-ingest into a project dataset
  - Auto-cleaning and chunking pipeline with preview
  - PII/sensitive-data detection and redaction suggestions
  - Dataset quality score (coverage, duplicates, noise)
  - Dataset versioning and rollback

- [ ] **AI-SYS-03**: Add no-code training/fine-tuning workflows
  - Training mode selector (RAG, prompt-tuning, LoRA/fine-tune)
  - Hardware-aware profile picker (CPU/GPU/VRAM budget)
  - Estimated time/cost/resources before run
  - Start/pause/resume/cancel training jobs
  - Training artifacts registry and reproducibility metadata

- [ ] **AI-SYS-04**: Create evaluation and benchmark dashboard for custom AIs
  - Golden test set builder for user-defined tasks
  - Side-by-side model output comparison
  - Metrics: quality, latency, hallucination rate, cost
  - Regression alerts when performance drops
  - Exportable evaluation reports

- [ ] **AI-SYS-05**: Add AI deployment and packaging flow
  - Deploy custom AI as local app profile, API endpoint, or extension helper
  - Package/share AI bundles with dependencies and manifest
  - Environment checks before deployment (models, storage, permissions)
  - Rollback to previous deployed version
  - Health monitoring for deployed AIs

- [ ] **AI-SYS-06**: Build "AI Marketplace for User-Created AIs"
  - Publish private/public AI blueprints
  - Import community templates with compatibility checks
  - Rating/review and usage telemetry opt-in
  - Semantic search and category browsing
  - Trust/safety badges for verified templates

- [ ] **AI-SYS-07**: Add conversational AI builder assistant
  - User describes desired AI in plain language
  - Assistant generates full AI config + workflow automatically
  - Interactive refinement loop ("make it more strict/faster/cheaper")
  - Auto-generate starter evaluation suite and guardrails
  - Explainability panel: why each config choice was made

- [ ] **AI-SYS-08**: Add observability and feedback loop for created AIs
  - Session traces for prompts, retrieved context, and responses
  - Failure clustering (timeouts, low quality, unsafe responses)
  - User feedback capture ("good/bad answer") into retraining queue
  - Suggested fixes generated from telemetry
  - Continuous improvement cycle per AI version

- [ ] **AI-SYS-09**: Add safety and governance layer for user-created AIs
  - Prompt-injection and jailbreak protection presets
  - Content policy filters and blocked-topic controls
  - Permission scopes per AI (file/network/tool access)
  - Audit log for training/deployment/config changes
  - Compliance export for enterprise users

- [ ] **AI-SYS-10**: Add onboarding flow for non-technical users
  - "Build your first AI in 10 minutes" interactive tutorial
  - Plain-language explanations for all technical options
  - Automatic recommended defaults by goal
  - Built-in troubleshooting assistant for failed setup/training
  - Success checklist with next-step recommendations

- [ ] **AI-SYS-11**: Add autonomous "AI Architect" mode
  - User describes business/problem in plain language
  - System proposes end-to-end AI architecture (data, model, infra, eval)
  - Generates phased implementation plan with estimated effort
  - Creates one-click starter project scaffold + runbook
  - Provides tradeoff matrix (cost/latency/quality/privacy)

- [ ] **AI-SYS-12**: Build local "AI Red Team" simulator
  - Run jailbreak/prompt-injection/adversarial tests on created AIs
  - Generate exploit report with reproducible attack traces
  - Auto-suggest guardrail patches and policy updates
  - Track security score per AI version
  - Integrate pass/fail gate before deployment

- [ ] **AI-SYS-13**: Add continuous AI retraining autopilot
  - Collect low-rated conversations into retraining candidates
  - Periodic retrain jobs with canary evaluation
  - Automatic rollback if quality/security regress
  - Human approval checkpoints for high-impact updates
  - Drift monitoring and proactive retrain recommendations

---

## Contributing

When picking up a task from this list:
1. Create a branch with the task ID (e.g., `feature/MKT-INFRA-01`)
2. Update the task status in this file
3. Reference the task ID in your commit messages
4. Submit PR with checklist of completed items

---

*This document is automatically updated. Do not edit manually without updating the tracking system.*
