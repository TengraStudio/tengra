
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
- [x] **UI-ACC-01**: Add title attributes to all sidebar interactive elements (DONE - verification needed)
- [x] **CHAT-CLR-01**: Implement 'Clear All Chats' with confirmation (DONE)
- [x] **MKT-UI-03.6**: Implement search history for marketplace
- [ ] **SSH-07.5**: Implement profile testing for SSH
- [x] **MEM-06.4**: Add search suggestions for memory search
- [x] **IMG-02.1**: Store generated images with metadata
- [x] **IMG-04.5**: Add gallery search
- [x] **DOC-09**: Create `.codex` directory and mirror core documentation
- [x] **DOC-10**: Harden AI rules and MASTER_COMMANDMENTS with termination warnings
- [x] **DOC-11**: Fix broken absolute paths in documentation hub
- [x] **DOC-12**: Create `LINT_ISSUES.md` for tech debt tracking


---

---

## 🔴 Critical Priority

### Security & Authentication

- [x] **SEC-004**: Implement secure credential export
  - Description: Allow users to export their API keys securely
  - Sub-tasks:
    - [x] Add password-protected export feature
    - [x] Implement import with decryption
    - [x] Add audit log for credential exports
    - [x] Implement export expiration
    - [x] Add export format versioning
    - [x] Create export verification checksum

- [x] **SEC-006**: Implement API key encryption at rest
  - Location: `src/main/services/security/security.service.ts`
  - Sub-tasks:
    - [x] Use OS keychain for key storage
    - [x] Implement key derivation function
    - [x] Add key rotation mechanism
    - [x] Create secure key backup

---

## 🟠 High Priority

### Marketplace System (VSCode-style Extensions)

#### Infrastructure
- [x] **MKT-INFRA-01**: Design marketplace architecture
  - Define manifest schema (extension.json format)
  - Design discovery API endpoints
  - Plan versioning strategy (semver compatibility)
  - Create extension capability declarations
  - Add extension dependency graph
  - Implement extension conflict detection
  - Create extension compatibility matrix

- [x] **MKT-INFRA-02**: Create marketplace backend service
  - Location: `src/main/services/marketplace/`
  - Implement extension registry with search capability
  - Add version management and dependency resolution
  - Create extension storage and retrieval
  - Add extension statistics tracking
  - Implement extension rating aggregation
  - Add extension download tracking
  - Create extension update notification

- [x] **MKT-INFRA-03**: Implement extension loader/unloader with sandboxing
  - Location: `src/main/services/extension/`
  - Create isolated execution context for extensions
  - Implement hot-reload capability for development
  - Add extension lifecycle hooks
  - Implement extension crash recovery
  - Add extension resource limits
  - Create extension debugging interface
  - Add extension performance monitoring

- [x] **MKT-INFRA-04**: Add extension lifecycle management
  - Install/Update/Remove operations
  - Enable/Disable toggle per extension
  - Handle extension dependencies
  - Add extension conflict detection
  - Implement extension rollback
  - Add extension backup before update
  - Create extension migration path

- [x] **MKT-INFRA-05**: Create extension permission system
  - File system access permissions
  - Network access permissions
  - IPC method whitelist
  - UI modification permissions
  - Add permission request UI
  - Implement permission revocation
  - Create permission audit log

- [x] **MKT-INFRA-06**: Implement extension update mechanism
  - Automatic update checking
  - Background download and install
  - Update notification system
  - Rollback on failed update
  - Add update scheduling
  - Implement delta updates
  - Add update verification

- [x] **MKT-INFRA-07**: Create extension storage service
  - Implement extension data isolation
  - Add extension storage quotas
  - Create extension data export
  - Add extension data migration

- [x] **MKT-INFRA-08**: Implement extension configuration system
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

- [x] **AGENT-04**: Add agent checkpoint compression
  - Compress old checkpoints to save disk space
  - Implement incremental checkpoint storage
  - Add checkpoint cleanup policy
  - Create checkpoint browser
  - Add checkpoint diff view
  - Implement checkpoint merge
  - Add checkpoint export

- [x] **AGENT-05**: Implement agent collaboration voting UI
  - Display voting sessions in real-time
  - Allow manual override of consensus decisions
  - Show model disagreement details
  - Add voting history
  - Implement voting analytics
  - Add voting configuration
  - Create voting templates

- [x] **AGENT-06**: Add agent task templates
  - Pre-defined task templates for common operations
  - Custom template creation
  - Template sharing between projects
  - Add template marketplace
  - Implement template versioning
  - Add template validation
  - Create template builder

- [x] **AGENT-07**: Implement agent memory persistence
  - Long-term memory storage
  - Cross-session memory retrieval
  - Memory importance scoring
  - Add memory decay
  - Implement memory consolidation
  - Add memory search
  - Create memory visualization

- [x] **AGENT-08**: Add agent performance metrics
  - Task completion rate tracking
  - Average execution time
  - Error rate monitoring
  - Resource usage tracking
  - Add performance alerts
  - Implement performance comparison
  - Create performance reports

- [x] **AGENT-09**: Implement agent state machine visualization
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

### Infrastructure

- [ ] **DEBT-05**: Add monitoring and observability
  - Implement OpenTelemetry
  - Add performance tracing
  - Create health dashboards

- [ ] **DEBT-06**: Improve error tracking
  - Implement Sentry integration
  - Add error grouping
  - Create error analytics

---

## 🧪 Service-Specific TODOs

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

### 🔎 Newly Discovered Backlog (2026-02-17)

#### Security Follow-ups
- [x] **AUD-SEC-031**: Add defensive JSON parse + schema validation for API payload parsing (`src/main/api/api-server.service.ts`)
- [x] **AUD-SEC-032**: Add strict Content-Security-Policy headers on API responses (`src/main/api/api-server.service.ts`)
- [x] **AUD-SEC-033**: Restrict CORS origin handling to explicit allowlist (`src/main/api/api-server.service.ts`)
- [x] **AUD-SEC-034**: Enforce HTTPS-only policy for cookie-capture URL allowlist (`src/main/ipc/window.ts`)
- [x] **AUD-SEC-035**: Add per-IP + token combined rate limiting for local API (`src/main/api/api-server.service.ts`)
- [x] **AUD-SEC-036**: Add websocket max payload/frame validation to prevent oversized messages (`src/main/api/api-server.service.ts`)
- [x] **AUD-SEC-037**: Harden shell/spawn command validation in window shell actions (`src/main/ipc/window.ts`)
- [x] **AUD-SEC-038**: Enforce mandatory checksum verification for all remote model downloads (`src/main/services/llm/model-downloader.service.ts`)

#### Performance Follow-ups
- [x] **AUD-PERF-031**: Replace JSON.stringify deep-equality checks with cheaper comparison strategy (`src/renderer/store/settings.store.ts`)
- [x] **AUD-PERF-032**: Reduce repeated array lookups/find operations in terminal panel rendering (`src/renderer/features/terminal/components/TerminalPanelImplContent.tsx`)
- [x] **AUD-PERF-033**: Collapse repeated log-level filtering passes into a single aggregation pass (`src/renderer/features/projects/components/ProjectLogsTab.tsx`)
- [x] **AUD-PERF-034**: Batch and parallelize code-intelligence chunk embedding requests (`src/main/services/project/code-intelligence.service.ts`)
- [x] **AUD-PERF-035**: Batch/debounce localStorage writes for titlebar history and quick actions (`src/renderer/components/layout/TitleBar.tsx`)
- [x] **AUD-PERF-036**: Add bounded LRU/TTL policy for response cache growth control (`src/main/services/llm/response-cache.service.ts`)
- [x] **AUD-PERF-037**: Add lazy pagination for large file lists in project scan results (`src/main/services/project/project.service.ts`)
- [x] **AUD-PERF-038**: Use partial-failure tolerant parallel search strategy for context retrieval (`src/main/services/llm/context-retrieval.service.ts`)

#### Test Coverage Follow-ups
- [x] **AUD-TEST-001**: Add workflow service behavior tests for create/execute/delete lifecycle (`src/tests/main/services/workflow.service.test.ts`)
- [x] **AUD-TEST-002**: Add workflow runner step execution + branching tests (`src/tests/main/services/workflow-runner.test.ts`)
- [x] **AUD-TEST-003**: Add content service tests for scraping/search + error paths (`src/tests/main/services/external/content.service.test.ts`)
- [x] **AUD-TEST-004**: Add market-research pipeline tests for deep analysis outputs (`src/tests/main/services/external/market-research.service.test.ts`)
- [x] **AUD-TEST-005**: Add feature flag service tests for load/toggle/persist behavior (`src/tests/main/services/external/feature-flag.service.test.ts`)
- [x] **AUD-TEST-006**: Add logo generation service tests for provider/model fallback logic (`src/tests/main/services/external/logo.service.test.ts`)
- [x] **AUD-TEST-007**: Add pagespeed service tests for metric extraction and fallback behavior (`src/tests/main/services/analysis/pagespeed.service.test.ts`)
- [x] **AUD-TEST-008**: Add file-change-tracker tests for diff persistence and metadata integrity (`src/tests/main/services/data/file-change-tracker.service.test.ts`)

#### Reliability/Bug Follow-ups
- [x] **AUD-BUG-001**: Fix malformed git log command flag (`log -n`) and add guard checks (`src/main/services/project/git.service.ts`)
- [x] **AUD-BUG-002**: Add watcher cleanup lifecycle for filesystem watch handles (`src/main/services/data/file.service.ts`)
- [x] **AUD-BUG-003**: Implement timeout enforcement path in queued request utility (`src/main/utils/request-queue.util.ts`)
- [x] **AUD-BUG-004**: Add stream pipe error handling for file download writer failures (`src/main/services/data/file.service.ts`)
- [x] **AUD-BUG-005**: Guard provider-rotation fallback when chain arrays are empty (`src/main/services/project/agent/agent-provider-rotation.service.ts`)
- [x] **AUD-BUG-006**: Add robust queue error propagation in agent persistence write queue (`src/main/services/project/agent/agent-persistence.service.ts`)
- [x] **AUD-BUG-007**: Validate edit line-range bounds before file patch application (`src/main/services/data/file.service.ts`)
- [x] **AUD-BUG-008**: Enforce download state transition validation for active/persisted tasks (`src/main/services/llm/model-downloader.service.ts`)

#### UX/Architecture Follow-ups
- [x] **AUD-UX-026**: Add inline real-time validation feedback for project edit form (`src/renderer/features/projects/components/modals/EditProjectModal.tsx`)
- [x] **AUD-UX-027**: Standardize tooltip delay and behavior across interactive UI surfaces (`src/renderer/components`)
- [x] **AUD-UX-028**: Add highlighted match rendering for project/chat search result snippets (`src/renderer/features/projects/components`)
- [x] **AUD-UX-029**: Improve keyboard navigation/ARIA for message action controls (`src/renderer/features/chat/components/MessageBubble.tsx`)
- [x] **AUD-ARCH-021**: Reduce heavy callback prop drilling in project card surface via local context (`src/renderer/features/projects/components/ProjectCard.tsx`)
- [x] **AUD-ARCH-022**: Add IPC contract versioning strategy for renderer-main compatibility (`src/main/ipc`)
- [x] **AUD-ARCH-023**: Replace lazy service proxy hotspots with explicit dependency injection boundaries (`src/main/core/lazy-services.ts`)
- [x] **AUD-ARCH-024**: Define and enforce cache invalidation strategy for LLM response cache (`src/main/services/llm/response-cache.service.ts`)

### ⚡ Performance Audit TODOs
(All performance audit items completed)

### ♿ UI/UX & Accessibility Audit TODOs
(All UI/UX accessibility audit items completed)

### 🧱 Architecture, Reliability & Testing Audit TODOs
(All architecture audit items completed)

---
## ✅ Completed Tasks

All completed tasks have been archived. See git history for details.

---

## 🤝 Contributing

When picking up a task from this list:
1. Create a branch with the task ID (e.g., `feature/MKT-INFRA-01`)
2. Update the task status in this file
3. Reference the task ID in your commit messages
4. Submit PR with checklist of completed items

---

*This document is automatically updated. Do not edit manually without updating the tracking system.*


