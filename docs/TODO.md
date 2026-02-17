
# 🚀 Tandem Project - Comprehensive TODO List

> Last updated: 2026-02-17
> **Total Tasks: 520+** | **Status: In Development**

## 📑 Table of Contents
1. [📊 Project Overview](#-project-overview)
2. [📅 Release Milestones](#-release-milestones)
3. [⚡ Quick Wins](#-quick-wins)
4. [🔴 Critical Priority](#-critical-priority)
5. [🟠 High Priority](#-high-priority)
6. [🟡 Medium Priority](#-medium-priority)
7. [🟢 Low Priority / Future](#-low-priority--future)
8. [📊 Code Quality & Tech Debt](#-code-quality--tech-debt)
9. [🐛 Known Issues](#-known-issues)
10. [💡 New Ideas & Experimental](#-new-ideas--experimental)
11. [✅ Completed Tasks](#-completed-tasks)
12. [🤝 Contributing](#-contributing)

## 📊 Project Overview

This document contains a comprehensive list of tasks, improvements, and features for the Tandem project. Tasks are organized by priority and category.


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

## ⚡ Quick Wins (Fast-Makeable)

Selected small/contained tasks that are realistic to ship quickly:

### ⏳ Pending Quick Wins
- [ ] **UI-ACC-01**: Add title attributes to all sidebar interactive elements (DONE - verification needed)
- [ ] **CHAT-CLR-01**: Implement 'Clear All Chats' with confirmation (DONE)
- [x] **LLM-09.2**: Add HTML/JS sanitization for AI prompts
  - [x] Added `prompt-sanitizer.util.ts`
- [x] **LLM-09.3**: Implement strict prompt length limits (128,000 characters) to prevent large payload attacks.
- [x] **LLM-09.4**: Implement suspicious pattern detection (roleplay, instruction overrides, PII, shell prompts).
- [x] **LLM-05.4**: Add file type detection
  - [x] Added `file-type.util.ts` with magic number checks
  [x] Updated `useAttachments` to use robust detection
- [x] **LLM-05.5**: Implement size optimization for image inputs
- [ ] **MKT-UI-03.6**: Implement search history for marketplace
- [x] **DEBT-01**: Clean up obsolete feature flags from `feature-flag.service.ts`.
- [x] **DEBT-02**: Improve test coverage for core services
- [x] **DEBT-03**: Audit and remove unused dependencies
  - [x] Removed `cheerio`
  - [x] Consolidated error utilities
- [x] **DEBT-06**: Implement lazy loading for identified heavy UI components in `App.tsx`.
- [x] **DEBT-07**: Standardize error handling patterns
  - [x] Merged `src/main/utils/error.util.ts` into shared utility
  - [x] Updated all imports to use `@shared/utils/error.util`
- [ ] **SSH-07.5**: Implement profile testing for SSH
- [ ] **MEM-06.4**: Add search suggestions for memory search
- [ ] **IMG-02.1**: Store generated images with metadata
- [ ] **IMG-04.5**: Add gallery search
- [x] **AGENT-08.3**: Error rate monitoring for agents
- [x] **AGENT-08.4**: Resource usage tracking for agents


---

---

## 🔴 Critical Priority

### Security & Authentication

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

### MCP Tools (Model Context Protocol)

- [ ] **MCP-WORKFLOW-01**: Workflow automation tools (6 tools)
  - workflow_create - Create workflows with triggers/actions
  - workflow_execute - Execute workflows with context
  - workflow_list - List all workflows with filtering
  - workflow_get - Get workflow details by ID
  - workflow_update - Update existing workflows
  - workflow_delete - Delete workflows

- [ ] **MCP-AI-01**: AI/ML operations tools (8 tools)
  - model_benchmark - Benchmark models on tasks
  - model_compare - Compare model outputs
  - embedding_generate - Generate text/code embeddings
  - embedding_search - Search using embeddings
  - prompt_optimize - Optimize prompts
  - context_compress - Compress long context
  - token_estimate - Estimate token counts
  - model_fallback - Auto-fallback on failure

- [ ] **MCP-DEV-01**: Development & code tools (10 tools)
  - code_refactor - Suggest refactoring
  - code_review - Automated code review
  - dependency_analyze - Analyze dependencies
  - test_generate - Generate unit tests
  - docs_generate - Generate documentation
  - api_scaffold - Scaffold API endpoints
  - migration_create - Create DB migrations
  - lint_fix - Auto-fix linting errors
  - type_infer - Infer TypeScript types
  - dead_code_detect - Find unused code

- [ ] **MCP-MONITOR-01**: System monitoring tools (7 tools)
  - performance_profile - Profile performance
  - memory_analyze - Analyze memory usage
  - cpu_monitor - Monitor CPU usage
  - network_trace - Trace network requests
  - log_analyze - Analyze logs
  - health_check - Run health checks
  - resource_alert - Set resource alerts

- [ ] **MCP-SECURITY-01**: Security & audit tools (6 tools)
  - security_scan - Scan for vulnerabilities
  - secret_detect - Detect hardcoded secrets
  - permission_audit - Audit permissions
  - dependency_audit - Audit dependencies
  - compliance_check - Check compliance
  - encryption_manage - Manage encryption

- [ ] **MCP-DATA-01**: Data processing tools (8 tools)
  - csv_parse - Parse CSV files
  - json_transform - Transform JSON data
  - xml_convert - Convert XML/JSON
  - data_validate - Validate against schema
  - data_merge - Merge data sources
  - data_deduplicate - Remove duplicates
  - data_export - Export in formats
  - regex_test - Test regex patterns

- [ ] **MCP-COLLAB-01**: Collaboration tools (5 tools)
  - issue_create - Create issues
  - pr_create - Create pull requests
  - comment_add - Add comments
  - notification_send - Send notifications
  - meeting_schedule - Schedule meetings

- [ ] **MCP-DB-01**: Database & storage tools (6 tools)
  - db_query - Execute queries safely
  - db_backup - Backup database
  - db_restore - Restore from backup
  - db_migrate - Run migrations
  - cache_clear - Clear caches
  - storage_optimize - Optimize storage

- [ ] **MCP-DEVOPS-01**: DevOps & deployment tools (7 tools)
  - docker_build - Build Docker images
  - docker_deploy - Deploy containers
  - k8s_deploy - Deploy to Kubernetes
  - env_manage - Manage env variables
  - secret_rotate - Rotate secrets
  - rollback_execute - Rollback deployment
  - pipeline_trigger - Trigger CI/CD

- [ ] **MCP-MEDIA-01**: Content & media tools (5 tools)
  - image_optimize - Optimize images
  - image_resize - Batch resize images
  - pdf_generate - Generate PDFs
  - markdown_convert - Convert markdown
  - screenshot_capture - Capture screenshots

- [ ] **MCP-DOMAIN-01**: Specialized domain tools (8 tools)
  - blockchain_query - Query blockchain
  - crypto_price - Get crypto prices
  - weather_get - Get weather info
  - translate_text - Translate text
  - sentiment_analyze - Analyze sentiment
  - ocr_extract - Extract text from images
  - speech_to_text - Convert speech
  - text_to_speech - Convert text

- [ ] **MCP-AGENT-01**: Agent & workflow integration (5 tools)
  - agent_create - Create agent profile
  - agent_execute - Execute agent task
  - agent_status - Get task status
  - workflow_from_task - Convert task to workflow
  - workflow_schedule - Schedule workflow


### LLM Service Improvements


- [ ] **LLM-05**: Add multi-modal support improvements
  - Image input preprocessing
  - Audio transcription integration
  - Video frame extraction
  - Add file type detection ✅
  - Implement size optimization ✅
  - Add format conversion
  - Create multi-modal preview




---

## 🟡 Medium Priority

### Changelog System


### Terminal Improvements

### UI/UX Improvements








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


---

## 🟢 Low Priority / Future Enhancements

### Test Coverage Improvements

### Performance Optimizations

### Internationalization

- [ ] **I18N-01**: Complete translations for all locales
  - Audit missing keys in all language files
  - Add context comments for translators
  - Implement translation memory

- [ ] **I18N-05**: Add locale-specific AI behavior
  - Model prompts in user's language
  - Locale-aware responses
  - Regional model preferences 

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


## 🔧 Technical Debt

### Architecture

- [ ] **DEBT-01**: Migrate to React Server Components
  - Evaluate feasibility for Electron
  - Identify components for migration
  - Performance benchmarking

- [x] **DEBT-03**: Refactor IPC communication
  - Create type-safe IPC client
  - Add request/response validation
  - Implement retry logic
  - Progress: Extended renderer IPC client with contract-based typed invocation (`invokeTypedIpc` in `src/renderer/lib/ipc-client.ts`), strengthened retry policy with exponential backoff + jitter and non-retryable validation/auth classifications, migrated theme + MCP marketplace typed clients (`src/renderer/utils/theme-ipc.util.ts`, `src/renderer/lib/mcp-marketplace-client.ts`) to the typed path, and migrated project-agent/project renderer callsites from raw invoke to schema-validated typed IPC (`src/renderer/features/projects/hooks/converters/asyncHandlers.ts`, `src/renderer/features/projects/hooks/converters/startTaskHandler.ts`, `src/renderer/features/projects/hooks/useAgentEvents.ts`, `src/renderer/features/projects/components/ProjectEnvironmentTab.tsx`). Added renderer tests in `src/tests/renderer/ipc-client.test.ts`.

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
  - Progress: Extracted command history/task-runner state, loading effects, and execution flows into `useTerminalCommandTools` (`src/renderer/features/terminal/hooks/useTerminalCommandTools.ts`), moved command-history/task-runner UI into `src/renderer/features/terminal/components/TerminalCommandPanels.tsx`, moved search overlay into `src/renderer/features/terminal/components/TerminalSearchOverlay.tsx`, moved recordings overlay into `src/renderer/features/terminal/components/TerminalRecordingPanel.tsx`, moved multiplexer overlay into `src/renderer/features/terminal/components/TerminalMultiplexerPanel.tsx`, moved split presets/controls into `src/renderer/features/terminal/components/TerminalSplitControls.tsx`, and moved semantic issues overlay into `src/renderer/features/terminal/components/TerminalSemanticPanel.tsx`.

---

## 🧪 Service-Specific TODOs

### Copilot Service
- [x] **COPILOT-01**: Move Copilot token refresh into Rust token service
  - Location: `src-tauri/services/token-service` + `src/main/services/security/token.service.ts`
  - Move refresh orchestration from Electron to Rust service
  - Keep Electron side as bridge (status/trigger)
  - Add compatibility checks for existing auth/settings flow


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

## 🚀 Extended AI Systems (New Ideas Added 2026-02-17)

### Voice & Speech AI

- [ ] **VOICE-01**: Add voice command wake-word detection
  - Implement local wake-word model (Porcupine/precise)
  - Background listening when app minimized
  - Custom wake-word training option
  - Add voice command quick actions
  - Implement voice activity detection
  - Add continuous voice mode for extended conversation
  - Create voice settings calibration UI
  - Add multi-language wake-word support

- [ ] **VOICE-02**: Implement real-time speech-to-speech conversation
  - Low-latency voice input processing
  - Real-time voice synthesis with voice cloning
  - Conversation turn-taking detection
  - Add interrupt handling during speech
  - Implement voice emotion detection
  - Add custom voice profile selection
  - Create voice quality settings
  - Add ambient noise cancellation

- [ ] **VOICE-03**: Add AI voice note transcription and summarization
  - Automatic transcription of voice memos
  - Key point extraction from recordings
  - Meeting notes AI assistant
  - Add speaker diarization
  - Implement timestamped highlights
  - Create voice memo search
  - Add automatic follow-up task creation

### Advanced Agent Capabilities

- [ ] **AGENT-13**: Implement multi-agent debate system
  - Multiple AI agents debating topics
  - Arguments pro/con visualization
  - Consensus detection algorithm
  - Add human moderator role
  - Debate history and replay
  - Argument quality scoring
  - Create debate summary generator
  - Add source citation tracking

- [ ] **AGENT-14**: Add cross-project agent memory sharing
  - Shared memory namespace for related projects
  - Memory access control per project
  - Selective memory sync options
  - Add memory merge conflict resolution
  - Implement memory versioning
  - Create memory analytics dashboard
  - Add memory search across projects

- [ ] **AGENT-15**: Implement agent teamwork analytics
  - Task completion metrics per agent
  - Collaboration pattern analysis
  - Agent efficiency scoring
  - Add team resource allocation insights
  - Implement agent health monitoring
  - Create agent comparison reports
  - Add productivity recommendations

### Development Tools AI

- [ ] **DEV-01**: Add AI-powered code review system
  - Pre-commit code analysis
  - Style violation detection
  - Security vulnerability identification
  - Add performance regression warnings
  - Implement architectural suggestions
  - Create review comment generation
  - Add custom rule configuration
  - Integrate with git workflow

- [ ] **DEV-02**: Implement automated bug detection and fixing
  - Static analysis bug patterns
  - Runtime error prediction
  - Auto-generate fix suggestions
  - Add test case generation
  - Implement fix confidence scoring
  - Create bug classification system
  - Add regression test suggestions
  - Integrate with debugging workflow

- [ ] **DEV-03**: Add performance optimization AI suggestions
  - CPU/memory profiling analysis
  - Database query optimization
  - Bundle size analysis
  - Add caching recommendations
  - Implement lazy loading suggestions
  - Create performance budgets
  - Add build time optimization
  - Monitor runtime performance

### Cloud & Infrastructure

- [ ] **CLOUD-01**: Add multi-cloud AI assistant
  - AWS service integration
  - Azure service integration
  - GCP service integration
  - Add cloud cost optimization
  - Implement resource monitoring
  - Create deployment automation
  - Add security compliance checks
  - Multi-cloud comparison insights

- [ ] **CLOUD-02**: Implement database AI assistant
  - Natural language query generation
  - Query performance analysis
  - Schema optimization suggestions
  - Add data anomaly detection
  - Implement predictive indexing
  - Create data migration assistant
  - Add backup strategy recommendations
  - Database health monitoring

### Collaboration Features

- [ ] **COLLAB-01**: Add shared AI sessions
  - Real-time collaborative AI chats
  - Shared context and memory
  - Presence indicators
  - Add cursor-based highlighting
  - Implement change annotations
  - Create session recording
  - Add session sharing links
  - Guest access controls

- [ ] **COLLAB-02**: Implement team knowledge base
  - AI-powered documentation search
  - Auto-generated summaries
  - Knowledge graph creation
  - Add Q&A from documentation
  - Implement team learning system
  - Create knowledge suggestions
  - Add content recommendations
  - Version-controlled wiki

### UI/UX Enhancements

- [ ] **UI-11**: Implement voice-first interface option
  - Hands-free navigation
  - Voice shortcuts for common actions
  - Audio feedback for all actions
  - Add visual backup for voice
  - Implement gesture controls
  - Create custom voice commands
  - Add wake-word customization
  - Accessibility voice mode

### Data & Analytics

- [ ] **DATA-01**: Add AI-powered analytics dashboard
  - Usage pattern learning
  - Predictive resource allocation
  - Anomaly detection
  - Add trend visualization
  - Implement forecasting
  - Create custom metrics
  - Add alert automation
  - Export capabilities

- [ ] **DATA-02**: Implement user behavior learning
  - Learn from repeated actions
  - Predict next actions
  - Personalize AI responses
  - Add preference inference
  - Implement adaptive UI
  - Create smart defaults
  - Add learning transparency
  - Privacy controls

### Local AI Enhancements

- [ ] **LOCAL-01**: Add model fine-tuning interface
  - Upload training data
  - Configure training parameters
  - Progress monitoring
  - Add model evaluation
  - Implement model versioning
  - Create fine-tuned model registry
  - Add inference testing
  - Export fine-tuned models

- [ ] **LOCAL-02**: Implement custom embedding training
  - Domain-specific embeddings
  - Training data selection
  - Similarity search optimization
  - Add embedding comparison
  - Implement dimension reduction
  - Create embedding visualization
  - Add batch processing
  - Performance benchmarking

---

## 🔍 Audit Backlog (Generated 2026-02-17)

### 🔐 Security Audit TODOs
- [x] **AUD-SEC-001**: Restrict generic IPC invoke API exposure (`src/main/preload.ts`)
- [x] **AUD-SEC-002**: Remove generic IPC event subscription bridge (`src/main/preload.ts`)
- [ ] **AUD-SEC-003**: Add sender/origin verification to auth IPC handlers (`src/main/ipc/auth.ts`)
- [ ] **AUD-SEC-004**: Add sender/origin verification to files IPC handlers (`src/main/ipc/files.ts`)
- [ ] **AUD-SEC-005**: Add sender/origin verification to ssh IPC handlers (`src/main/ipc/ssh.ts`)
- [ ] **AUD-SEC-006**: Add sender/origin verification to process IPC handlers (`src/main/ipc/process.ts`)
- [ ] **AUD-SEC-007**: Add sender/origin verification to proxy IPC handlers (`src/main/ipc/proxy.ts`)
- [ ] **AUD-SEC-008**: Add sender/origin verification to mcp IPC handlers (`src/main/ipc/mcp.ts`)
- [ ] **AUD-SEC-009**: Add sender/origin verification to terminal IPC handlers (`src/main/ipc/terminal.ts`)
- [ ] **AUD-SEC-010**: Enforce allowed protocol allowlist for `openExternal` (`src/main/startup/window.ts`)
- [ ] **AUD-SEC-011**: Harden hidden cookie-capture BrowserWindow URL policy (`src/main/ipc/window.ts`)
- [ ] **AUD-SEC-012**: Enforce allowed roots before `shell.openPath` (`src/main/ipc/window.ts`)
- [ ] **AUD-SEC-013**: Redact sensitive URL query params in logs (`src/main/ipc/window.ts`)
- [ ] **AUD-SEC-014**: Fix allowed-root prefix confusion in safe-file protocol (`src/main/startup/protocols.ts`)
- [ ] **AUD-SEC-015**: Fix allowed-root prefix confusion in file system service (`src/main/services/data/filesystem.service.ts`)
- [ ] **AUD-SEC-016**: Add symlink/junction escape checks to filesystem operations (`src/main/services/data/filesystem.service.ts`)
- [ ] **AUD-SEC-017**: Validate path authorization in `fileExists` (`src/main/services/data/filesystem.service.ts`)
- [ ] **AUD-SEC-018**: Validate path authorization in `extractStrings` (`src/main/services/data/filesystem.service.ts`)
- [ ] **AUD-SEC-019**: Validate path authorization in `syncNote` (`src/main/services/data/filesystem.service.ts`)
- [ ] **AUD-SEC-020**: Add source allowlist + integrity checks for remote downloads (`src/main/services/data/filesystem.service.ts`)
- [ ] **AUD-SEC-021**: Replace shell-string git execution with argument-safe process APIs (`src/main/services/project/git.service.ts`)
- [ ] **AUD-SEC-022**: Harden git-advanced shell interpolation handling (`src/main/ipc/git-advanced.ts`)
- [ ] **AUD-SEC-023**: Protect `/api/auth/token` behind strict local auth (`src/main/api/api-server.service.ts`)
- [ ] **AUD-SEC-024**: Bind API server explicitly to loopback only (`src/main/api/api-server.service.ts`)
- [ ] **AUD-SEC-025**: Require auth for all WebSocket connections (`src/main/api/api-server.service.ts`)
- [ ] **AUD-SEC-026**: Enforce strict OAuth state validation in Antigravity callback (`src/main/utils/local-auth-server.util.ts`)
- [ ] **AUD-SEC-027**: Enforce strict OAuth state validation in Claude callback (`src/main/utils/local-auth-server.util.ts`)
- [ ] **AUD-SEC-028**: Remove plaintext master-key fallback (`src/main/services/security/security.service.ts`)
- [ ] **AUD-SEC-029**: Encrypt SSH private keys at rest (`src/main/services/project/ssh.service.ts`)
- [ ] **AUD-SEC-030**: Stop returning sensitive SSH fields to renderer (`src/main/ipc/ssh.ts`)

### ⚡ Performance Audit TODOs
- [x] **AUD-PERF-001**: Remove state updates in render path (`src/renderer/features/chat/components/MessageList.tsx`)
- [x] **AUD-PERF-002**: Move focus recovery scan out of per-render path (`src/renderer/features/chat/components/MessageList.tsx`)
- [x] **AUD-PERF-003**: Memoize message action callbacks to reduce child rerenders (`src/renderer/features/chat/components/MessageList.tsx`)
- [x] **AUD-PERF-004**: Replace sync layout scroll preservation with passive strategy (`src/renderer/components/layout/sidebar/SidebarChatList.tsx`)
- [x] **AUD-PERF-005**: Precompute folder-chat mappings (`src/renderer/components/layout/sidebar/SidebarChatList.tsx`)
- [x] **AUD-PERF-006**: Add chat list virtualization in sidebar (`src/renderer/components/layout/sidebar/SidebarChatList.tsx`)
- [x] **AUD-PERF-007**: Debounce + index chat search normalization (`src/renderer/components/layout/Sidebar.tsx`)
- [x] **AUD-PERF-008**: Cache pinned/recent derivations (`src/renderer/components/layout/Sidebar.tsx`)
- [x] **AUD-PERF-009**: Add project list virtualization (`src/renderer/features/projects/ProjectsPage.tsx`)
- [x] **AUD-PERF-010**: Cache project lowercase search keys (`src/renderer/features/projects/ProjectsPage.tsx`)
- [x] **AUD-PERF-011**: Avoid full clone/sort on each sort interaction (`src/renderer/features/projects/ProjectsPage.tsx`)
- [x] **AUD-PERF-012**: Virtualize confirmed memory cards (`src/renderer/features/memory/components/ConfirmedMemoriesList.tsx`)
- [x] **AUD-PERF-013**: Remove deep `JSON.stringify` prop comparators (`src/renderer/features/chat/components/MessageBubble.tsx`)
- [x] **AUD-PERF-014**: Parse think/plan tags once at ingestion (`src/renderer/features/chat/components/MessageBubble.tsx`)
- [x] **AUD-PERF-015**: Cache markdown render output for stable messages (`src/renderer/features/chat/components/MessageBubble.tsx`)
- [x] **AUD-PERF-016**: Lazy-load heavy markdown/code renderer stack (`src/renderer/features/chat/components/MessageBubble.tsx`)
- [x] **AUD-PERF-017**: Replace startup full-chat load with paged loading (`src/renderer/features/chat/hooks/useChatManager.ts`)
- [x] **AUD-PERF-018**: Use indexed/debounced message search in chat (`src/renderer/features/chat/hooks/useChatManager.ts`)
- [x] **AUD-PERF-019**: Reduce nested map updates on streaming ticks (`src/renderer/features/chat/hooks/process-stream.ts`)
- [x] **AUD-PERF-020**: Batch/coalesce DB writes during stream (`src/renderer/features/chat/hooks/process-stream.ts`)
- [x] **AUD-PERF-021**: Coalesce multi-model streaming state fanout (`src/renderer/features/chat/hooks/useChatGenerator.ts`)
- [x] **AUD-PERF-022**: Replace `setChats` callback state-read hack with refs/store (`src/renderer/features/chat/hooks/useChatGenerator.ts`)
- [x] **AUD-PERF-023**: Split root app subscriptions to reduce full-tree rerenders (`src/renderer/App.tsx`)
- [x] **AUD-PERF-024**: Defer non-critical startup initialization until after first paint (`src/main/main.ts`)
- [x] **AUD-PERF-025**: Offload PDF export to worker/background queue (`src/main/services/export/export.service.ts`)
- [x] **AUD-PERF-026**: Replace sync gallery stat scans with async batched scans (`src/main/ipc/gallery.ts`)
- [x] **AUD-PERF-027**: Remove sync log cleanup from startup/interval path (`src/main/logging/logger.ts`)
- [x] **AUD-PERF-028**: Convert sync data migrations to async chunked operations (`src/main/services/data/data.service.ts`)
- [x] **AUD-PERF-029**: Replace sync terminal backend detection command (`src/main/services/terminal/backends/windows-terminal.backend.ts`)
- [x] **AUD-PERF-030**: Replace unbounded SELECT + in-memory loops with pagination (`src/main/services/data/repositories/*.ts`)

### ♿ UI/UX & Accessibility Audit TODOs
- [x] **AUD-UX-001**: Add live region announcement for streaming/new messages (`src/renderer/features/chat/components/MessageList.tsx`)
- [x] **AUD-UX-002**: Fix selection semantics and roles in message list (`src/renderer/features/chat/components/MessageList.tsx`)
- [x] **AUD-UX-003**: Add in-UI keyboard help for message shortcuts (`src/renderer/features/chat/components/MessageList.tsx`)
- [x] **AUD-UX-004**: Add missing `chat-input-hint` description target (`src/renderer/features/chat/components/ChatInput.tsx`)
- [x] **AUD-UX-005**: Make attachment remove actions keyboard-visible without hover dependency (`src/renderer/features/chat/components/ChatInput.tsx`)
- [x] **AUD-UX-006**: Improve combobox/listbox semantics for prompt command menu (`src/renderer/features/chat/components/ChatInput.tsx`)
- [x] **AUD-UX-007**: Expose busy/loading state semantics on send/stop controls (`src/renderer/features/chat/components/ChatInput.tsx`)
- [x] **AUD-UX-008**: Turn command palette into strict modal dialog with focus trap (`src/renderer/components/layout/CommandPalette.tsx`)
- [x] **AUD-UX-009**: Add aria-label to command palette close control (`src/renderer/components/layout/command-palette/CommandHeader.tsx`)
- [x] **AUD-UX-010**: Expose selected result state semantically in command list (`src/renderer/components/layout/command-palette/ResultsList.tsx`)
- [x] **AUD-UX-011**: Use semantic headings for command categories (`src/renderer/components/layout/command-palette/ResultsList.tsx`)
- [x] **AUD-UX-012**: Narrow modal aria-describedby to concise summary region (`src/renderer/components/ui/modal.tsx`)
- [x] **AUD-UX-013**: Add consistent visible close affordance in base modal (`src/renderer/components/ui/modal.tsx`)
- [x] **AUD-UX-014**: Upgrade ErrorBoundary fallback with retry/navigation actions (`src/renderer/components/shared/ErrorBoundary.tsx`)
- [x] **AUD-UX-015**: Add operation-specific loading labels (`src/renderer/components/ui/LoadingState.tsx`)
- [x] **AUD-UX-016**: Localize and semantically structure session lock overlay (`src/renderer/components/layout/SessionLockOverlay.tsx`)
- [x] **AUD-UX-017**: Add initial focus + Escape behavior to session lock overlay (`src/renderer/components/layout/SessionLockOverlay.tsx`)
- [x] **AUD-UX-018**: Add aria-labels to title bar icon controls (`src/renderer/components/layout/TitleBar.tsx`)
- [x] **AUD-UX-019**: Add explicit labels for changelog filter fields (`src/renderer/components/layout/TitleBar.tsx`)
- [x] **AUD-UX-020**: Remove remaining hardcoded strings in changelog UI (`src/renderer/components/layout/TitleBar.tsx`)
- [x] **AUD-UX-021**: Add aria-labels to quick action icon buttons (`src/renderer/components/layout/QuickActionBar.tsx`)
- [x] **AUD-UX-022**: Add keyboard invocation/discoverability for quick actions (`src/renderer/components/layout/QuickActionBar.tsx`)
- [x] **AUD-UX-023**: Expose active-state semantics in activity bar (`src/renderer/components/layout/ActivityBar.tsx`)
- [x] **AUD-UX-024**: Add labels for sidebar collapse/expand chevrons (`src/renderer/components/layout/ActivityBar.tsx`)
- [x] **AUD-UX-025**: Implement roving keyboard navigation for sidebar entries (`src/renderer/components/layout/sidebar/SidebarNavigation.tsx`)

### 🧱 Architecture, Reliability & Testing Audit TODOs
- [x] **AUD-ARCH-001**: Split preload bridge into domain modules (`src/main/preload.ts`)
- [x] **AUD-ARCH-002**: Add preload contract regression tests (`src/tests/main/preload/**`)
- [x] **AUD-ARCH-003**: Break up service bootstrap composition (`src/main/startup/services.ts`)
- [x] **AUD-ARCH-004**: Add startup lifecycle/service-graph integration tests (`src/tests/main/startup/**`)
- [x] **AUD-ARCH-005**: Remove `as any` in chat IPC registration path (`src/main/ipc/chat.ts`)
- [x] **AUD-ARCH-006**: Replace permissive `z.any()` usage in chat IPC schemas (`src/main/ipc/chat.ts`)
- [x] **AUD-ARCH-007**: Replace permissive `z.any()` args schema in DB IPC (`src/main/ipc/db.ts`)
- [x] **AUD-ARCH-008**: Tighten decorator typing in rate limiter utilities (`src/main/utils/rate-limiter.util.ts`)
- [x] **AUD-ARCH-009**: Standardize IPC response envelope conventions (`src/main/utils/ipc-wrapper.util.ts`)
- [x] **AUD-ARCH-010**: Migrate legacy handlers to validated IPC wrapper (`src/main/ipc/*.ts`)
- [x] **AUD-ARCH-011**: Upgrade IPC coverage tests from regex to behavior assertions (`src/tests/main/ipc/ipc-handler-coverage.test.ts`)
- [x] **AUD-ARCH-012**: Replace smoke-only IPC tests with behavior-driven integration tests (`src/tests/main/ipc/test-gap-smoke.integration.test.ts`)
- [x] **AUD-ARCH-013**: Replace smoke-only service tests with functional assertions (`src/tests/main/services/test-gap-smoke.service.test.ts`)
- [x] **AUD-ARCH-014**: Add dedicated TerminalService unit/integration suite (`src/main/services/project/terminal.service.ts`)
- [x] **AUD-ARCH-015**: Remove silent catch in terminal cleanup paths (`src/main/services/project/terminal.service.ts`)
- [x] **AUD-ARCH-016**: Add crash/restart persistence tests for terminal sessions (`src/tests/main/services/project/**`)
- [x] **AUD-ARCH-017**: Remove silent catch in project scanning paths (`src/main/services/project/project.service.ts`)
- [x] **AUD-ARCH-018**: Add negative-path tests for scanning and permission failures (`src/tests/main/services/project.service.test.ts`)
- [x] **AUD-ARCH-019**: Surface stale-temp cleanup failures instead of swallowing (`src/main/services/llm/local-image.service.ts`)
- [x] **AUD-ARCH-020**: Add failure-path tests for image provider fallback chain (`src/tests/main/services/llm/local-image.service.test.ts`)

---
## ✅ Completed Tasks

Work that has been successfully implemented and verified.

### 🛡️ Security & Infrastructure
  - Progress: Unified `TokenService` performs proactive refresh checks with exponential backoff. Rust service hardened.
  - Progress: Added Zod validation pipeline for all IPC handlers; completed database/auth/shell audits.
  - Progress: `ModelDetailsPanel` now uses DOMPurify for `longDescriptionHtml`.
  - Progress: Replaced string-based `exec` with `spawn/execFile` argument arrays.
  - Progress: Command parsing now tokenizes args and uses `shell: false`.
  - Progress: PowerShell/`unzip` now run via non-shell argument arrays.
  - Progress: Integrated `vuln-gate.cjs` into CI pipeline.
  - Progress: Added `.secretlintignore` for release artifacts.

### 🤖 Agent & LLM Systems
  - Progress: Added timeouts, caching, semi-parallel execution, and retry logic.
  - Progress: Integrated `ContextWindowService` and LLM-based summarization.
  - Progress: Added error categorization and exponential backoff retries.
  - Progress: `ModelFallbackService` implements failover, retry/backoff, and circuit breakers.
  - Progress: `ResponseCacheService` integrated in `LLMService.chat`.
  - Progress: `ContextWindowService` provides smart truncation and preservation.
  - Progress: `OllamaHealthService` implements scheduled checks and auto-recovery.
  - Progress: `MultiLLMOrchestrator` manages priority queues and concurrency.
  - Progress: Partial output preservation on stream errors.
  - Progress: `ModelRegistryService` normalizes model capabilities and refreshes cache.
  - [x] **LLM-REF-01**: Refactor GitHub Copilot token refresh to use Rust-based `tandem-token-service` for improved reliability.
  - [x] **SEC-001**: Token Rotation Hardening (TokenService + Rust refresher) implemented.

### 🎨 UI & UX
  - Progress: Added arrow key navigation, focus indicators, and regenerate shortcut.
  - Progress: Modularized into `model-selector/` subcomponents with virtualization.
  - Progress: Fully implemented and accessible via `Ctrl/Cmd+K`.
  - Progress: Added grid/list toggle with sortable columns and CSV export.
  - Progress: Added live terminal-backed logs with filtering and analytics.
  - Progress: Fully interactive remap/import/export system implemented.
  - Progress: Implemented chat input attachments and project folder moves.
  - Progress: Wired through `useChatManager.regenerateMessage`.

### 📂 Git & Source Control
  - Progress: Advanced resolution panel with `ours`/`theirs`/manual actions.
  - Progress: Full stash lifecycle (create/apply/pop/drop) with search.
  - Progress: Inline and sidebar blame information implemented.
  - Progress: Interactive rebase UI with conflict awareness.
  - Progress: Full management (init/update/sync) actions added.
  - Progress: Added git-flow helpers and branch type templates.
  - Progress: Management APIs for hook templates and custom scripts.
  - Progress: Repository-level analytics (commits/author/file) with CSV export.

### 🧠 Code Intelligence
  - Progress: Added TS/JS, Python, and Go support with relationship graphs.
  - Progress: Definition, references, and implementions navigation added.
  - Progress: Rename symbol primitives with preview/apply workflow.
  - Progress: JSDoc and README generation for files and projects.
  - Progress: Complexity, code smell, and security-smell detection implemented.

### 🐛 Bugs & Resolved Issues
  - Progress: Resolved crashes in Marketplace and Model hooks via defensive array checks.
  - Progress: Added support for multiple binary names and improved recursive discovery.

### 🌐 Internationalization & Browser Extension
  - Progress: Implemented CSS logical properties and tested RTL layouts.
  - Progress: Date/time, number, and currency formatting added.
  - Progress: Detects system language and prompts user on first run.
  - Progress: Added plural rules and forms for all supported languages.
  - Progress: `FormIntelligence` implements field detection and profile-based autofill.
  - Progress: `MultiTabManager` handles batch operations and cross-tab search.

### � Documentation
  - Progress: Added Table of Contents, restructured Quick Wins, and archived completed tasks.

### �🛠️ Service-Specific & Other
  - Progress: Added bounded request queue with notifications and queue-full protection.

---

## 🤝 Contributing

When picking up a task from this list:
1. Create a branch with the task ID (e.g., `feature/MKT-INFRA-01`)
2. Update the task status in this file
3. Reference the task ID in your commit messages
4. Submit PR with checklist of completed items

---

*This document is automatically updated. Do not edit manually without updating the tracking system.*


