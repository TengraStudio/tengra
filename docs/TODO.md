# Tandem Project - Comprehensive TODO List

Last updated: 2026-02-12

## Overview

This document contains a comprehensive list of tasks, improvements, and features for the Tandem project. Tasks are organized by priority and category.

**Total Tasks: 500+**

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


- [ ] **SEC-003**: Audit IPC handlers for input validation
  - Location: `src/main/ipc/*.ts`
  - Description: Ensure all IPC handlers validate input using Zod schemas
  - Impact: Prevents injection attacks and malformed data issues
  - Sub-tasks:
    - [ ] Create Zod schemas for all IPC payloads
    - [x] Add validation middleware to IPC wrapper
    - [x] Log validation failures for security auditing
    - [x] Add unit tests for validation edge cases
    - [x] Implement schema versioning
    - [x] Add schema documentation generation
    - [x] Create schema migration path
  - Progress: Added versioned `createValidatedIpcHandler` pipeline with validation-failure logging/callbacks, auth IPC schema coverage, schema docs generator (`npm run docs:ipc:schemas`), migration guide, and validation tests.

- [ ] **SEC-004**: Implement secure credential export
  - Description: Allow users to export their API keys securely
  - Sub-tasks:
    - [ ] Add password-protected export feature
    - [ ] Implement import with decryption
    - [ ] Add audit log for credential exports
    - [ ] Implement export expiration
    - [ ] Add export format versioning
    - [ ] Create export verification checksum

- [x] **SEC-005**: Add session timeout handling
  - Description: Implement secure session timeout with configurable duration
  - Sub-tasks:
    - [x] Add session timeout configuration
    - [x] Implement idle detection
    - [x] Add lock screen functionality
    - [x] Preserve state across lock/unlock
    - [x] Add biometric unlock support
    - [x] Implement session recovery
  - Progress: Added `security.session` settings, auth session timeout IPC (`set/get`), renderer idle lock hook, lock overlay, and auth session touch/end lifecycle.

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
    - [x] Log all authentication events
    - [ ] Log all API key accesses
    - [ ] Log all file system operations
    - [x] Add log tampering detection
    - [x] Implement log rotation
  - Progress: Added authentication event logging integration in auth IPC, hash-chained integrity fields (`prevHash/hash`), integrity verification API, and retention-based rotation/pruning.

- [x] **SEC-008**: Implement Content Security Policy
  - Location: `src/main/main.ts`
  - Sub-tasks:
    - [x] Define CSP headers
    - [x] Add nonce-based script loading
    - [x] Implement CSP violation reporting
    - [x] Test with strict CSP mode
  - Progress: Hardened CSP in startup window security with nonce-based script policy and runtime CSP violation logging; dev strictness supports controlled eval only in unpackaged mode.

- [ ] **SEC-009**: Add input sanitization for AI prompts
  - Location: `src/main/services/llm/`
  - Sub-tasks:
    - [ ] Implement prompt injection detection
    - [ ] Add HTML/JS sanitization
    - [ ] Create prompt length limits
    - [ ] Add suspicious pattern detection

- [x] **SEC-010**: Implement secure file operations
  - Location: `src/main/services/data/file.service.ts`
  - Sub-tasks:
    - [x] Add path traversal prevention
    - [x] Implement file type validation
    - [x] Add file size limits
    - [x] Create quarantine zone for suspicious files
  - Progress: Added safe path normalization, extension allow-list for edit operations, read/write/download size limits, and quarantine handling.

### Database & Persistence


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

- [x] **MDL-HF-01**: Add HuggingFace model scraper
  - [x] Location: `src/main/services/llm/huggingface.service.ts`
  - [x] Scrape model metadata from HF Hub API
  - [x] Cache results locally
  - [x] Handle API rate limits
  - [x] Add model categorization
  - [x] Implement model search
  - [x] Add model recommendations
  - [x] Create model watchlist

- [x] **MDL-HF-02**: Parse GGUF model files from HF Hub
  - [x] Implement GGUF header parser
  - [x] Extract model metadata (context length, quantization)
  - [x] Validate model compatibility
  - [x] Add model preview
  - [x] Implement model comparison
  - [x] Add model benchmark data
  - [x] Create model card renderer

- [x] **MDL-HF-03**: Add download manager for HF models
  - [x] Resume interrupted downloads
  - [x] Progress tracking and cancellation
  - [x] Disk space validation before download
  - [x] Parallel chunk downloads
  - [x] Add download queue
  - [x] Implement download scheduling
  - [x] Add download verification

- [x] **MDL-HF-04**: Integrate HF models into marketplace UI
  - Show in model selection dropdown
  - Display model cards with benchmarks
  - Add model comparison feature
  - Show model requirements
  - Add model installation wizard
  - Implement model configuration
  - Add model testing

- [x] **MDL-HF-05**: Add model conversion tools
  - [x] Convert PyTorch models to GGUF
  - [x] Quantization options UI
  - [x] Model optimization suggestions
  - [x] Add conversion progress tracking
  - [x] Implement conversion validation
  - [x] Add conversion presets
  - [x] Create conversion documentation

- [x] **MDL-HF-06**: Implement model versioning
  - [x] Track model versions
  - [x] Add version comparison
  - [x] Implement version rollback
  - [x] Add version pinning
  - [x] Create version notifications

- [x] **MDL-HF-07**: Add model fine-tuning support
  - [x] Create fine-tuning UI
  - [x] Add dataset preparation
  - [x] Implement training monitoring
  - [x] Add model evaluation
  - [x] Create model export

- [x] **MDL-HF-08**: Implement model caching
  - Add model cache management
  - Implement cache eviction
  - Add cache statistics
  - Create cache cleanup

### Agent System Enhancements

- [x] **AGENT-01**: Implement agent:create IPC handler
  - Location: `src/main/ipc/agent.ts:27`
  - Create new agent instances with custom configuration
  - Validate agent templates
  - Set up agent workspace
  - Add agent validation
  - Implement agent cloning
  - Add agent import/export
  - Create agent templates library

- [x] **AGENT-02**: Implement agent:delete IPC handler
  - Location: `src/main/ipc/agent.ts:27`
  - Clean up agent resources and state
  - Archive agent history
  - Remove agent checkpoints
  - Add deletion confirmation
  - Implement soft delete
  - Add agent backup before delete
  - Create agent recovery

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

- [ ] **AGENT-10**: Add agent tool execution improvements
  - Implement tool timeout handling
  - Add tool retry logic
  - Create tool execution queue
  - Add tool dependency resolution
  - Implement tool parallelization
  - Add tool result caching
  - Create tool execution logs

- [ ] **AGENT-11**: Implement agent context management
  - Add context window optimization
  - Implement context summarization
  - Add context prioritization
  - Create context visualization
  - Add context export
  - Implement context comparison
  - Add context templates

- [ ] **AGENT-12**: Add agent error recovery improvements
  - Implement automatic retry strategies
  - Add error classification
  - Create error recovery templates
  - Add error notification
  - Implement error analytics
  - Add error prediction
  - Create error documentation

### LLM Service Improvements

- [x] LLM-01: Streaming Response Cancellation
- [x] LLM-02: Model Fallback Chain
- [x] LLM-03: Response Caching
  - Clean up resources on cancellation
  - Add cancellation feedback UI
  - Implement partial response saving
  - Add cancellation analytics
  - Create cancellation policies
  - Add cancellation recovery

- [ ] **LLM-02**: Implement model fallback chain
  - Location: `src/main/services/llm/model-fallback.service.ts`
  - Configure fallback models per provider
  - Automatic failover on errors
  - Circuit breaker pattern
  - Add fallback analytics
  - Implement fallback testing
  - Add fallback configuration UI
  - Create fallback recommendations

- [ ] **LLM-03**: Add response caching
  - Cache identical requests
  - Configurable cache TTL
  - Cache invalidation on model change
  - Add cache statistics
  - Implement cache warming
  - Add cache sharing
  - Create cache management UI

- [x] **LLM-04**: Implement token counting accuracy
  - [x] Location: `src/main/services/llm/token-estimation.service.ts`
  - [x] Use tiktoken for accurate counting
  - [x] Handle special tokens correctly
  - [x] Add token count UI feedback
  - [x] Implement token budgeting
  - [x] Add token analytics
  - [x] Create token optimization
  - [x] Add token warnings

- [ ] **LLM-05**: Add multi-modal support improvements
  - Image input preprocessing
  - Audio transcription integration
  - Video frame extraction
  - Add file type detection
  - Implement size optimization
  - Add format conversion
  - Create multi-modal preview

- [ ] **LLM-06**: Implement context window optimization
  - Location: `src/main/services/llm/context-window.service.ts`
  - Smart context truncation
  - Important message preservation
  - Context compression
  - Add context preview
  - Implement context testing
  - Add context recommendations
  - Create context analytics

- [ ] **LLM-07**: Add LLM provider health monitoring
  - Location: `src/main/services/llm/ollama-health.service.ts`
  - Implement health check scheduling
  - Add provider status dashboard
  - Create health alerts
  - Add health history
  - Implement auto-recovery
  - Add health analytics
  - Create health reports

- [ ] **LLM-08**: Implement LLM request queuing
  - Location: `src/main/services/llm/multi-llm-orchestrator.service.ts`
  - Add priority queue
  - Implement request scheduling
  - Add queue management UI
  - Create queue analytics
  - Add queue alerts
  - Implement queue optimization
  - Add queue testing

- [ ] **LLM-09**: Add LLM response streaming improvements
  - Implement chunk buffering
  - Add streaming error recovery
  - Create streaming analytics
  - Add streaming preview
  - Implement streaming pause/resume
  - Add streaming throttling
  - Create streaming testing

- [ ] **LLM-10**: Implement LLM model registry improvements
  - Location: `src/main/services/llm/model-registry.service.ts`
  - Add model capability detection
  - Implement model comparison
  - Add model recommendations
  - Create model analytics
  - Add model alerts
  - Implement model testing
  - Add model documentation

---

## 🟡 Medium Priority

### Changelog System


- [x] **CLG-03**: Implement changelog search
  - [x] Add full-text search
  - [x] Implement date range filtering
  - [x] Add category filtering
  - [x] Create search suggestions
  - [x] Add search history
  - [x] Implement search export
  - [x] Add search analytics
  - Progress: Implemented in `TitleBar` changelog modal with locale-aware indexing, filters, suggestions, local history, JSON export, and analytics counters in local storage.

- [x] **CLG-04**: Add changelog RSS feed
  - [x] Implement RSS generation
  - [x] Add feed customization
  - [x] Create feed analytics
  - [x] Add feed validation
  - [x] Implement feed scheduling
  - [x] Add feed notifications
  - [x] Create feed testing
  - Progress: Added `changelog:rss` generator with locale/type/channel filters, analytics output, validation checks, scheduled regeneration mode, and `changelog:rss:test`.

### Terminal Improvements

- [x] **TERM-01**: Implement Ghostty socket/IPC input handling
  - Location: `src/main/services/terminal/backends/ghostty.backend.ts:99`
  - Add support for Ghostty terminal emulator
  - Handle socket communication
  - Implement connection recovery
  - Add session persistence
  - Create configuration UI
  - Add debugging tools
  - Implement testing
  - Progress: Implemented Ghostty IPC input bridge (`ghostty-ipc/*.commands`) with keystroke buffering, command flush on Enter, bridge write recovery, and external window/session lifecycle cleanup in `ghostty.backend.ts`.

- [x] **TERM-02**: Refactor TerminalPanel into smaller modules
  - Location: `src/renderer/features/terminal/TerminalPanel.tsx:1086`
  - Split into: TerminalManager, TerminalInstance, TerminalTabs
  - Improve maintainability and testability
  - Add module documentation
  - Create module tests
  - Add module examples
  - Implement module versioning
  - Progress: Modular terminal stack now covers extracted `TerminalInstance`, `TerminalContextMenu`, `TerminalEmptyState`, and `TerminalTabsBar`, with shared helpers moved into `src/renderer/features/terminal/utils/*` (`split-config`, `shortcut-config`, `session-registry`, `terminal-search`). Added module versioning in `src/renderer/features/terminal/utils/module-version.ts` (exposed via `data-terminal-module-version` on the manager root), module docs in `src/renderer/features/terminal/README.md`, module examples in `src/renderer/features/terminal/examples/module-usage.md`, and renderer test coverage via `terminal-session-registry.test.ts` + `terminal-module-version.test.ts`.
  - This pass completed 20 terminal jobs: split/shortcut utility extraction, split preset persistence normalization, split analytics normalization, split layout restore normalization, split analytics increment helper wiring, custom split preset factory wiring, sync-input preference persistence, multi-target input routing for split panes, synchronized paste, synchronized paste-history apply, synchronized command-history execute, synchronized task-runner execute, synchronized AI-fix apply, toolbar sync toggle, context-menu sync toggle, shortcut export JSON, shortcut import JSON, shortcut share-code generation, shortcut share-code apply, split preset rename/delete controls.

- [x] **TERM-03**: Add terminal session persistence
  - Save terminal state on app close
  - Restore sessions on app reopen
  - Preserve command history
  - Add session naming
  - Implement session export
  - Add session sharing
  - Create session templates
  - Progress: Implemented persisted snapshots (`terminal-sessions.json`), command history persistence (`terminal-command-history.json`), snapshot listing/restore IPC (`terminal:getSnapshotSessions`, `terminal:restoreSnapshotSession`, `terminal:restoreAllSnapshots`), session naming API (`terminal:setSessionTitle`), renderer auto-restore + rename-on-double-click flow, plus session export/import/share (`terminal:exportSession`, `terminal:importSession`, `terminal:createSessionShareCode`, `terminal:importSessionShareCode`) and template lifecycle APIs (`terminal:getSessionTemplates`, `terminal:saveSessionTemplate`, `terminal:deleteSessionTemplate`, `terminal:createFromSessionTemplate`).

- [x] **TERM-04**: Implement terminal split view
  - Horizontal and vertical splits
  - Drag and drop tab reordering
  - Synchronized input mode
  - Add split presets
  - Implement split saving
  - Add split analytics
  - Create split testing
  - Progress: Added split preset manager in `src/renderer/features/terminal/TerminalPanel.tsx` with built-in + custom presets, persisted split layout restore (`terminal.split-layout.v1`), local split analytics counters (`terminal.split-analytics.v1`), split preset rename/delete controls, and synchronized-input mode for split panes (toolbar + context menu + command/paste fan-out). Added split-config unit tests in `src/tests/renderer/terminal-split-config.test.ts`.

- [x] **TERM-05**: Add terminal profile management
  - Location: `src/main/services/terminal/terminal-profile.service.ts`
  - Custom shell configurations
  - Environment variable presets
  - Profile import/export
  - Add profile templates
  - Implement profile sharing
  - Add profile validation
  - Create profile testing
  - Progress: Added profile validation + templates + import/export in `TerminalProfileService`, expanded templates with env presets, implemented share-code export/import (`terminal:exportProfileShareCode`, `terminal:importProfileShareCode`), and exposed IPC channels with integration test coverage.

- [x] **TERM-06**: Implement terminal search
  - Search within terminal output
  - Regex support
  - Highlight all matches
  - Add search history
  - Implement search export
  - Add search suggestions
  - Create search analytics
  - Progress: Added scrollback search IPC (`terminal:searchScrollback`) with plain/regex + case-sensitive options and limit control, search analytics endpoint (`terminal:getSearchAnalytics`), search suggestions (`terminal:getSearchSuggestions`), search export (`terminal:exportSearchResults`), search UI history persistence, and in-panel match indexing with preview list/jump navigation in `TerminalPanel.tsx`. Added renderer utility coverage in `src/tests/renderer/terminal-search-utils.test.ts`.

- [x] **TERM-07**: Add terminal keyboard shortcuts
  - Customizable shortcuts
  - Vim mode support
  - Emacs keybindings
  - Add shortcut presets
  - Implement shortcut sharing
  - Add shortcut validation
  - Create shortcut testing
  - Progress: Added preset-based shortcut system (`default`/`vim`/`emacs`) with persisted bindings (`terminal.shortcuts.v1`), shortcut validation/sanitization utilities, and global action dispatch (toggle panel/new tab/close/search/split/detach) in `src/renderer/features/terminal/TerminalPanel.tsx`; added shortcut sharing via export/import JSON and share-code copy/apply plus unit tests in `src/tests/renderer/terminal-shortcut-config.test.ts`.

- [x] **TERM-08**: Implement terminal theming
  - Custom color schemes
  - Font configuration
  - Cursor styles
  - Add theme presets
  - Implement theme sharing
  - Add theme validation
  - Create theme testing
  - Progress: Complete terminal theming system with cursor styles (block/underline/bar), cursor blink toggle, font size/line height controls, custom theme color pickers (background/foreground/cursor/selection), theme validation for imports, and live theme preview panel. All preferences persisted via localStorage in `src/renderer/features/terminal/TerminalPanel.tsx`.

- [x] **TERM-09**: Add terminal copy/paste improvements
  - Multi-line paste handling
  - Copy with formatting
  - Paste history
  - Add copy filters
  - Implement paste preview
  - Add paste confirmation
  - Create paste testing
  - Progress: Complete copy/paste system with copy-with-formatting (HTML+plain text), copy-strip-ANSI filter, paste test functionality (shows line count, char count, special chars, ANSI detection), multi-line paste preview+confirmation, and persisted paste history (`terminal.paste-history.v1`) in context menu.

- [x] **TERM-10**: Implement terminal scrollback buffer
  - Configurable buffer size
  - Search in scrollback
  - Export scrollback
  - Add scrollback markers
  - Implement scrollback filtering
  - Add scrollback analytics
  - Create scrollback testing
  - Progress: Configurable scrollback already supported in terminal settings/xterm config; added scrollback export (`terminal:exportScrollback`), analytics (`terminal:getSessionAnalytics`), marker APIs (`terminal:addScrollbackMarker`, `terminal:listScrollbackMarkers`, `terminal:deleteScrollbackMarker`), filter API (`terminal:filterScrollback`), plus IPC integration tests.

### UI/UX Improvements

- [ ] **UI-01**: Reimplement keyboard focus in MessageList
  - Location: `src/renderer/features/chat/components/MessageList.tsx:73`
  - Add arrow key navigation between messages
  - Implement focus indicators
  - Add message selection for actions
  - Create focus persistence
  - Add focus analytics
  - Implement focus testing
  - Add focus documentation

- [ ] **UI-02**: Split ModelSelectorModal into smaller subcomponents
  - Location: `src/renderer/features/models/components/ModelSelectorModal.tsx:56`
  - Create: ModelList, ModelFilters, ModelDetails
  - Improve performance with virtualization
  - Add component documentation
  - Create component tests
  - Add component examples
  - Implement component versioning

- [ ] **UI-03**: Implement Command Palette
  - Currently shows "coming soon"
  - Add keyboard shortcut (Ctrl+Shift+P)
  - Index all available commands
  - Add recent commands history
  - Implement command search
  - Add command categories
  - Create command favorites

- [ ] **UI-04**: Implement list view for projects
  - Currently shows "coming soon"
  - Add toggle between grid and list views
  - Include sortable columns
  - Add bulk selection
  - Implement list filtering
  - Add list export
  - Create list presets

- [ ] **UI-05**: Implement logs viewer
  - Currently shows "coming soon"
  - Real-time log streaming
  - Filter by log level and source
  - Export logs feature
  - Add log search
  - Implement log highlighting
  - Add log analytics

- [ ] **UI-06**: Add keyboard shortcuts panel
  - Display all available shortcuts
  - Allow customization of shortcuts
  - Import/export shortcut configurations
  - Add shortcut categories
  - Implement shortcut search
  - Add shortcut testing
  - Create shortcut documentation

- [x] **UI-07**: Improve accessibility (a11y)
  - Add ARIA labels to all interactive elements
  - Implement focus trapping in modals
  - Add screen reader announcements
  - High contrast mode support
  - Add keyboard navigation
  - Implement voice control
  - Add accessibility testing
  - Progress: Created comprehensive accessibility utilities in `src/renderer/utils/accessibility.tsx` including `useA11ySettings`, `useScreenReaderAnnounce`, `useFocusTrap`, `useRovingTabIndex`, `useKeyboardShortcuts` hooks. Added high contrast mode CSS with `.high-contrast` class and `prefers-contrast` media query support. Created `AccessibilitySettings.tsx` panel for user configuration. Added `sr-only`, `skip-link`, `enhanced-focus`, and `reduced-motion` CSS utilities. Focus trapping already implemented in `GlassModal.tsx` and `modal.tsx`. Added accessibility tests in `src/tests/renderer/accessibility.test.ts`. Voice control deferred as it requires platform-specific integration.

- [ ] **UI-08**: Add drag and drop file support
  - Drag files into chat input
  - Drag projects to folders
  - Drag images for multi-modal input
  - Add drop preview
  - Implement drop validation
  - Add drop analytics
  - Create drop testing
  - Progress: Drag files into chat input already implemented via DragDropWrapper; added drop validation (`validateDroppedFile`) with file type whitelist, size limit (10MB), dangerous extension blocking, and toast error feedback.
  - Progress: Drag files into chat input implemented via DragDropWrapper + useAttachments; Added drop validation with file type/size checks and dangerous extension blocking.

- [x] **UI-09**: Implement notification center
  - Consolidate all notifications
  - Notification history
  - Notification preferences per type
  - Add notification actions
  - Implement notification scheduling
  - Add notification analytics
  - Create notification testing
  - Progress: Added a unified notification center store in `src/renderer/store/notification-center.store.ts` and consolidated app + workspace notifications into one pipeline. Implemented persisted history, per-type preferences, action buttons, scheduling (including snooze), analytics counters, and renderer tests in `src/tests/renderer/notification-center-store.test.ts`.

- [x] **UI-10**: Add window state persistence
  - Remember window position and size
  - Restore split panel sizes
  - Remember sidebar state
  - Add state export
  - Implement state migration
  - Add state validation
  - Create state testing
  - Progress: Window bounds persistence was already wired in startup window lifecycle; this pass added window-state validation/migration in `SettingsService` (legacy `window.bounds` migration + clamped dimensions), persisted sidebar/shell layout state with migration + export in `src/renderer/store/ui-layout.store.ts`, panel split-layout validation/migration helpers in `src/renderer/components/layout/panel-layout-persistence.ts`, UI state export from `DeveloperTab`, and tests in `src/tests/renderer/ui-layout-store.test.ts`, `src/tests/renderer/panel-layout-persistence.test.ts`, and `src/tests/main/services/settings.service.test.ts`.

- [x] **UI-11**: Implement toast notifications
  - Location: `src/renderer/components/layout/ToastsContainer.tsx`
  - Add toast queue with limits
  - Toast actions (undo, dismiss)
  - Toast categories (success, error, warning, info)
  - Add toast persistence
  - Implement toast stacking
  - Add toast analytics
  - Create toast testing
  - Progress: Added a consolidated toast/notification pipeline via `src/renderer/store/notification-center.store.ts` and upgraded `src/renderer/components/layout/ToastsContainer.tsx` with typed categories, queue limits, action buttons, snooze/dismiss behavior, persisted history/preferences, stacked rendering, and analytics counters. Added queue-limit coverage in `src/tests/renderer/notification-center-store.test.ts`.

- [x] **UI-12**: Add loading states and skeletons
  - Consistent loading indicators
  - Skeleton screens for all views
  - Progress indicators for long operations
  - Add loading cancellation
  - Implement loading estimation
  - Add loading analytics
  - Create loading testing
  - Progress: Extended `src/renderer/components/ui/LoadingState.tsx` with progress/estimation/cancel support, added view skeleton catalog in `src/renderer/components/ui/view-skeletons.tsx`, wired suspense and streaming-operation indicators in `src/renderer/views/ViewManager.tsx`, and added loading analytics persistence in `src/renderer/store/loading-analytics.store.ts`. Added tests in `src/tests/renderer/LoadingState.test.tsx` and `src/tests/renderer/loading-analytics.store.test.ts`. Documentation: `docs/UI_LOADING_STATES.md`.

- [x] **UI-13**: Implement responsive design improvements
  - Mobile-friendly layouts
  - Tablet optimization
  - Desktop enhancements
  - Add responsive testing
  - Implement breakpoint management
  - Add responsive analytics
  - Create responsive documentation
  - Progress: Added breakpoint utilities in `src/renderer/lib/responsive.ts`, responsive analytics tracking in `src/renderer/store/responsive-analytics.store.ts`, and applied breakpoint-aware behavior in `src/renderer/App.tsx`, `src/renderer/components/layout/LayoutManager.tsx`, and `src/renderer/components/layout/ToastsContainer.tsx`. Added tests in `src/tests/renderer/responsive.test.ts` and `src/tests/renderer/responsive-analytics.store.test.ts`. Documentation: `docs/UI_RESPONSIVE_GUIDE.md`.

- [x] **UI-14**: Add animation improvements
  - Consistent animation timing
  - Reduced motion support
  - Animation presets
  - Add animation testing
  - Implement animation debugging
  - Add animation analytics
  - Create animation documentation
  - Progress: Added centralized presets/reduced-motion helpers in `src/renderer/lib/animation-system.ts`, integrated page/tooltip animation timing in `src/renderer/views/ViewManager.tsx` and `src/renderer/components/ui/tooltip.tsx`, and added analytics/debug state in `src/renderer/store/animation-analytics.store.ts` with developer controls in `src/renderer/features/settings/components/DeveloperTab.tsx`. Added tests in `src/tests/renderer/animation-system.test.ts` and `src/tests/renderer/animation-analytics.store.test.ts`. Documentation: `docs/UI_ANIMATION_GUIDE.md`.

- [x] **UI-15**: Implement tooltip improvements
  - Consistent tooltip styling
  - Rich tooltip content
  - Tooltip positioning
  - Add tooltip delays
  - Implement tooltip testing
  - Add tooltip analytics
  - Create tooltip documentation
  - Progress: Upgraded `src/renderer/components/ui/tooltip.tsx` to support consistent styling tokens, rich content fields (`title`, `description`, `shortcut`), configurable delays, adaptive placement, and analytics emission. Added positioning utilities in `src/renderer/components/ui/tooltip-utils.ts` and telemetry store in `src/renderer/store/tooltip-analytics.store.ts`. Added tests in `src/tests/renderer/tooltip-utils.test.ts` and `src/tests/renderer/tooltip-analytics.store.test.ts`. Documentation: `docs/UI_TOOLTIP_GUIDE.md`.

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

- [ ] **GIT-01**: Add git conflict resolution UI
  - Location: `src/main/services/project/git.service.ts`
  - Visual diff for conflicts
  - Merge tool integration
  - Conflict markers explanation
  - Add conflict analytics
  - Implement conflict testing
  - Add conflict sharing
  - Create conflict documentation

- [ ] **GIT-02**: Implement git stash management
  - Stash list view
  - Stash apply/pop/drop
  - Stash with custom message
  - Add stash search
  - Implement stash export
  - Add stash analytics
  - Create stash testing

- [ ] **GIT-03**: Add git blame integration
  - Inline blame information
  - Blame sidebar panel
  - Commit details on hover
  - Add blame analytics
  - Implement blame testing
  - Add blame sharing
  - Create blame documentation

- [ ] **GIT-04**: Implement git rebase support
  - Interactive rebase UI
  - Rebase conflict resolution
  - Rebase abort/continue
  - Add rebase analytics
  - Implement rebase testing
  - Add rebase sharing
  - Create rebase documentation

- [ ] **GIT-05**: Add git submodule support
  - Submodule status display
  - Submodule update/init
  - Submodule management UI
  - Add submodule analytics
  - Implement submodule testing
  - Add submodule sharing
  - Create submodule documentation

- [ ] **GIT-06**: Implement git flow support
  - Git flow templates
  - Branch management
  - Release management
  - Add flow analytics
  - Implement flow testing
  - Add flow sharing
  - Create flow documentation

- [ ] **GIT-07**: Add git hooks management
  - Hook templates
  - Hook installation
  - Hook testing
  - Add hook analytics
  - Implement hook sharing
  - Add hook validation
  - Create hook documentation

- [ ] **GIT-08**: Implement git statistics
  - Commit statistics
  - Author statistics
  - File statistics
  - Add statistics export
  - Implement statistics sharing
  - Add statistics analytics
  - Create statistics testing

### Code Intelligence

- [ ] **CODE-01**: Improve code symbol parsing
  - Location: `src/main/services/project/code-intelligence.service.ts`
  - Add more language support
  - Improve parsing accuracy
  - Add symbol relationships
  - Implement symbol testing
  - Add symbol analytics
  - Create symbol documentation
  - Add symbol visualization

- [ ] **CODE-02**: Implement code navigation
  - Go to definition
  - Find references
  - Go to implementation
  - Add navigation history
  - Implement navigation testing
  - Add navigation analytics
  - Create navigation documentation

- [ ] **CODE-03**: Add code refactoring support
  - Rename symbol
  - Extract method
  - Move symbol
  - Add refactoring preview
  - Implement refactoring testing
  - Add refactoring analytics
  - Create refactoring documentation

- [ ] **CODE-04**: Implement code documentation generation
  - JSDoc generation
  - README generation
  - API documentation
  - Add documentation templates
  - Implement documentation testing
  - Add documentation analytics
  - Create documentation sharing

- [ ] **CODE-05**: Add code quality analysis
  - Complexity analysis
  - Code smell detection
  - Security analysis
  - Add quality scoring
  - Implement quality testing
  - Add quality analytics
  - Create quality documentation

---

## 🟢 Low Priority / Future Enhancements

### Test Coverage Improvements

- [x] **TEST-01**: Add missing IPC handler tests
  - Files needing tests:
    - `advanced-memory.ts`
    - `auth.ts`
    - `brain.ts`
    - `code-intelligence.ts`
    - `db.ts`
    - `dialog.ts`
    - `extension.ts`
    - `file-diff.ts`
    - `files.ts`
    - `gallery.ts`
    - `git.ts`
    - `idea-generator.ts`
    - `mcp.ts`
    - `mcp-marketplace.ts`
    - `process.ts`
    - `project-agent.ts`
    - `proxy-embed.ts`
    - `proxy.ts`

- [x] **TEST-02**: Add E2E tests for critical flows
  - Account linking flow
  - Chat interaction with model switching
  - Project creation and management
  - SSH connection and file operations
  - Agent task execution

- [x] **TEST-03**: Add performance benchmarks
  - Startup time measurement
  - Memory usage profiling
  - IPC call latency tracking
  - Database query performance

- [x] **TEST-04**: Add visual regression tests
  - Component screenshot tests
  - Theme consistency tests
  - Layout tests for different screen sizes

- [x] **TEST-05**: Add integration tests for services
  - Service lifecycle tests
  - Service interaction tests
  - Error handling tests

- [x] **TEST-06**: Add unit tests for utilities
  - Test all utility functions
  - Add edge case coverage
  - Test error handling

- [x] **TEST-07**: Add mutation testing
  - Configure mutation testing framework
  - Add mutation tests for critical code
  - Track mutation score

- [x] **TEST-08**: Add contract testing
  - API contract tests
  - IPC contract tests
  - Database contract tests


### Performance Optimizations

- [x] **PERF-01**: Implement lazy loading for services
  - Defer non-critical service initialization
  - Load services on first use
  - Add service loading indicators

- [x] **PERF-02**: Optimize bundle size
  - Analyze and reduce renderer bundle
  - Implement code splitting
  - Tree shaking optimization

- [x] **PERF-03**: Add memory management
  - Implement service cleanup on idle
  - Add memory pressure monitoring
  - Automatic garbage collection hints

- [x] **PERF-04**: Optimize database operations
  - Batch database operations
  - Implement connection pooling
  - Add query result caching

- [x] **PERF-05**: Improve startup time
  - Parallel service initialization
  - Defer non-essential UI rendering
  - Cache last used model/project

- [x] **PERF-06**: Add performance monitoring
  - Performance metrics collection
  - Performance alerts
  - Performance dashboard

- [x] **PERF-07**: Implement resource pooling
  - Connection pooling
  - Thread pooling
  - Object pooling

- [x] **PERF-08**: Add caching improvements
  - Multi-level caching
  - Cache warming
  - Cache analytics

### Internationalization

- [ ] **I18N-01**: Complete translations for all locales
  - Audit missing keys in all language files
  - Add context comments for translators
  - Implement translation memory

- [ ] **I18N-02**: Add RTL support
  - Implement CSS logical properties
  - Test Arabic and Hebrew layouts
  - Add RTL-specific icons

- [ ] **I18N-03**: Add locale-specific formatting
  - Date/time formatting
  - Number formatting
  - Currency display

- [ ] **I18N-04**: Add language detection
  - Detect system language on first run
  - Prompt for language selection
  - Remember language preference

- [ ] **I18N-05**: Add locale-specific AI behavior
  - Model prompts in user's language
  - Locale-aware responses
  - Regional model preferences

- [ ] **I18N-06**: Add translation management
  - Translation status dashboard
  - Translation quality metrics
  - Translation workflow

- [ ] **I18N-07**: Implement pluralization
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

- [ ] **EXT-03**: Add form auto-fill
  - Detect form fields
  - AI-powered form filling
  - Form data templates

- [ ] **EXT-04**: Implement page actions
  - Quick actions menu
  - Custom action recording
  - Action sharing

- [ ] **EXT-05**: Add multi-tab operations
  - Location: `extension/features/multi-tab.js`
  - Batch operations across tabs
  - Tab group management
  - Cross-tab search

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

- [x] **MCP-01**: Add more MCP server types
  - Location: `src/main/mcp/servers/`
  - Database MCP server
  - Cloud storage MCP server
  - CI/CD MCP server
  - Progress: added `database-admin.server.ts`, `cloud-storage.server.ts`, and `cicd.server.ts` and registered them in MCP registry

- [x] **MCP-02**: Implement MCP server marketplace
  - Browse available MCP servers
  - One-click installation
  - Server configuration UI
  - Progress: added marketplace config update flow (`mcp:marketplace:update-config`) and config modal in `MCPServersTab.tsx`

- [x] **MCP-03**: Add MCP server debugging
  - Server health monitoring
  - Request/response logging
  - Performance metrics
  - Progress: added dispatch metrics collection in `McpPluginService` + debug IPC endpoint `mcp:marketplace:debug`

- [x] **MCP-04**: Implement MCP server permissions
  - Fine-grained permission control
  - Permission request UI
  - Audit log for MCP actions
  - Progress: added per-action permission policies, pending request queue, and permission IPC endpoints (`mcp:permissions:*`)

- [x] **MCP-05**: Add MCP server templates
  - Template for new MCP servers
  - Common patterns library
  - Server generator CLI
  - Progress: added server template (`src/main/mcp/templates/server.template.ts`) and generator (`scripts/mcp/generate-server.cjs`)

- [x] **MCP-06**: Implement MCP server versioning
  - Version tracking
  - Version comparison
  - Version rollback
  - Progress: added version history persistence (`mcpServerVersionHistory`) and rollback endpoint (`mcp:marketplace:rollback-version`)

- [x] **MCP-07**: Add MCP server testing
  - Unit testing framework
  - Integration testing
  - Performance testing
  - Progress: added MCP registry coverage test for new server modules and renderer client tests (`mcp-marketplace-client.test.ts`)

- [x] **MCP-08**: Implement MCP server documentation
  - Auto-generated documentation
  - API reference
  - Usage examples
  - Progress: added MCP docs generator (`scripts/docs/generate-mcp-docs.cjs`) and updated `docs/MCP.md`

---

## 📊 Code Quality Initiatives

### IPC Handler Coverage

**Current Status (as of 2026-02-12):**
- Total IPC handlers: 51 files
- Handlers with tests: 30 files (59%)
- Handlers without tests: 21 files (41%)

**Target: 80% coverage by end of Q1 2026**

### Code Refactoring


- [x] **REF-02**: Implement strict null checks
  - Enable `strictNullChecks` in tsconfig
  - Fix all resulting type errors
  - Add null guards where needed


- [x] **REF-04**: Standardize error handling
  - Create error type hierarchy
  - Implement error boundaries
  - Add error recovery strategies
  - Progress: applied shared `handleError` utility across chat hooks (`usePromptManager`, `useFolderManager`, `useSpeechRecognition`, `useVoiceInput`)

- [x] **REF-05**: Improve type safety
  - Remove `any` types
  - Add branded types for IDs
  - Implement type guards
  - Progress: added branded ID types + guards in `src/shared/types/ids.ts`; integrated `ChatId` into `useChatHistory`


- [x] **REF-07**: Add code documentation
  - JSDoc for all public functions
  - README for each module
  - Architecture documentation
  - Progress: added module READMEs for chat hooks and engineering reports (`src/renderer/features/chat/hooks/README.md`, `reports/engineering/README.md`)

- [x] **REF-08**: Implement code metrics
  - Cyclomatic complexity
  - Code coverage
  - Technical debt tracking
  - Progress: added metrics scripts (`npm run metrics:code`, `npm run metrics:debt`, `npm run metrics:all`)

---

## 🐛 Known Issues

### Bugs to Fix


- [x] **BUG-08**: Terminal font size persistence
  - Symptoms: Font size resets on app restart
  - Likely cause: Settings not persisted
  - Location: `src/main/services/terminal/`
  - Fixed: Added terminal settings to AppSettings type and settings.service.ts defaults; useTerminal.ts now reads from and updates settings

- [x] **BUG-09**: Brain service fact extraction
  - Symptoms: Non-user facts being stored
  - Likely cause: Validation regex too permissive
  - Location: `src/main/services/llm/brain.service.ts`
  - Fixed: Replaced permissive string matching with regex patterns using word boundaries for more accurate user fact validation

- [x] **BUG-10**: Agent state machine recovery
  - Symptoms: Agent stuck in recovering state
  - Likely cause: Recovery attempts exhausted
  - Location: `src/main/services/project/agent/agent-state-machine.ts`
  - Fixed: Added recovery attempt exhaustion check and RECOVERY_TIMEOUT_MS timeout to prevent stuck recovering state

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

- [x] **DEBT-02**: Implement proper state management
  - Evaluate Zustand/Jotai for global state
  - Migrate from Context where appropriate
  - Add state persistence
  - Progress: Implemented external store pattern using `useSyncExternalStore` (React 18 native API) instead of Zustand/Jotai to avoid additional dependencies. Created `theme.store.ts` (theme state with DOM sync), `sidebar.store.ts` (sidebar collapsed/width/activeSection), and `ui-layout.store.ts` (ActivityBar state). All stores include localStorage persistence, type-safe selectors, and proper hydration. Context providers remain for complex async state (Auth, Chat, Model, Project) while simple UI state uses stores.

- [ ] **DEBT-03**: Refactor IPC communication
  - Create type-safe IPC client
  - Add request/response validation
  - Implement retry logic

### Infrastructure

- [x] **DEBT-04**: Improve CI/CD pipeline
  - Add parallel test execution
  - Implement incremental builds
  - Add deployment previews
  - Progress: refactored `ci.yml` into parallel jobs with path-based incremental execution and PR preview artifacts

- [ ] **DEBT-05**: Add monitoring and observability
  - Implement OpenTelemetry
  - Add performance tracing
  - Create health dashboards

- [ ] **DEBT-06**: Improve error tracking
  - Implement Sentry integration
  - Add error grouping
  - Create error analytics

- [x] **DEBT-07**: Add automated backups
  - Database backup automation
  - Configuration backup
  - Disaster recovery
  - Progress: added disaster recovery bundle create/restore APIs and runbook (`docs/disaster-recovery.md`)

---

## 🧪 Service-Specific TODOs

### Copilot Service
- [ ] **COPILOT-01**: Move Copilot token refresh into Rust token service
  - Location: `src-tauri/services/token-service` + `src/main/services/security/token.service.ts`
  - Move refresh orchestration from Electron to Rust service
  - Keep Electron side as bridge (status/trigger)
  - Add compatibility checks for existing auth/settings flow

- [ ] **COPILOT-02**: Improve rate limit handling
  - Add rate limit prediction
  - Implement request queuing
  - Add rate limit notifications

---

## 📝 Feature Requests

### User-Requested Features

- [ ] **FEAT-01**: Add voice input support
  - Speech-to-text integration
  - Voice commands
  - Multi-language support

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

---

## Contributing

When picking up a task from this list:
1. Create a branch with the task ID (e.g., `feature/MKT-INFRA-01`)
2. Update the task status in this file
3. Reference the task ID in your commit messages
4. Submit PR with checklist of completed items

---

*This document is automatically updated. Do not edit manually without updating the tracking system.*
