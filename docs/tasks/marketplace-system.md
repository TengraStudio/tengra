# Marketplace System (VSCode-style Extensions)

> Extracted from TODO.md — remaining tasks only

## Core Infrastructure & Centralization

- ( ) **MKT-INFRA-09**: Implement Centralized Marketplace Indexer Service (VPS-side).
  - (x) Migrate HF/Ollama scraping from client-side to VPS for improved privacy and performance.
  - (x) Build automated metadata crawler for extensions, prompts, and model presets.
  - (x) Create secure REST API for model discovery and searching.
  - (x) Implement caching layer for fast search results across all clients.

## UI Components

Location: `src/renderer/features/marketplace/`

### Marketplace Browser
- (x) Create responsive grid layout
- (x) Add category navigation sidebar
- (x) Implement featured extensions carousel
- (x) Add trending extensions section
- (x) Create recently updated section
- (x) Add personalized recommendations
- (x) Implement search with filters

### Extension Cards
- (x) Display rating, download count, description
- (x) Add install/uninstall button states
- (x) Show compatibility indicators
- (x) Add screenshot preview gallery
- (x) Implement hover preview
- (x) Add quick actions menu
- (x) Show update available badge

### Search & Filter
- (x) Full-text search across extensions
- (x) Filter by categories and tags
- (x) Sort by popularity, rating, recent updates
- (x) Save search preferences
- (x) Add search suggestions
- (x) Implement search history
- (x) Add advanced search syntax

### Extension Detail Page
- (x) README rendering with markdown support
- (x) Reviews and ratings section
- (x) Version history and changelog
- (x) Related extensions suggestions
- (x) Add dependency tree view
- (x) Show permission requirements
- (x) Add installation statistics

### Installed Extensions Manager
- (x) List all installed extensions
- (x) Update all / update individual
- (x) Configure extension settings
- (x) View extension logs
- (x) Add extension diagnostics
- (x) Show extension resource usage
- (x) Implement extension profiles

### Installation Wizard
- (x) Show installation progress
- (x) Display permission requests
- (x) Add configuration steps
- (x) Show installation summary

### Rating & Review System
- (x) Add star rating component
- (x) Create review form
- (x) Show rating distribution
- (x) Add helpful vote system

### Comparison View
- (x) Side-by-side comparison
- (x) Feature matrix
- (x) Rating comparison
- (x) Download statistics

## Extension Types

### MCP Server Extensions
- (x) Allow custom MCP server implementations
- (x) Provide SDK for MCP server development
- (x) Add MCP server configuration UI
- (x) Create MCP server templates
- (x) Add MCP server debugging
- (x) Implement MCP server testing
- (x) Add MCP server documentation generator

### Theme Extensions
- (x) Custom color schemes and UI themes
- (x) Icon packs and font options
- (x) Syntax highlighting themes
- (x) Add theme preview
- (x) Implement theme mixing
- (x) Add theme import/export
- (x) Create theme editor

### Command Extensions
- (x) Custom slash commands for chat
- (x) Keyboard shortcut bindings
- (x) Command palette integration
- (x) Add command autocomplete
- (x) Implement command chaining
- (x) Add command history
- (x) Create command builder UI

### Language Extensions
- (x) Language server protocol support
- (x) Custom syntax highlighting
- (x) Code formatter integration
- (x) Add language detection
- (x) Implement multi-language support
- (x) Add language-specific tools
- (x) Create language configuration

### Agent Templates
- (x) Pre-configured agent personas
- (x) Custom tool configurations
- (x) Agent behavior modifiers
- (x) Add template marketplace
- (x) Implement template sharing
- (x) Add template versioning
- (x) Create template builder

### UI Extensions
- (x) Custom dashboard widgets
- (x) Sidebar panels
- (x) Status bar items
- (x) Add widget configuration
- (x) Implement widget communication
- (x) Add widget theming
- (x) Create widget gallery

### Integration Extensions
- (x) External service integrations
- (x) Webhook handlers
- (x) API connectors
- (x) Add OAuth flow support
- (x) Implement credential management
- (x) Add integration testing
- (x) Create integration templates

## Security

### Code Signing
- ( ) Implement code signing for extensions
- ( ) Verify signatures before installation
- ( ) Add trusted publisher system
- ( ) Create signing key management
- ( ) Add signature revocation
- ( ) Implement certificate pinning
- ( ) Add signature timestamping

### Sandboxing
- ( ) Isolate extension code from main process
- ( ) Resource usage limits (CPU, memory, time)
- ( ) Network request filtering
- ( ) Add sandbox escape detection
- ( ) Implement sandbox logging
- ( ) Add sandbox configuration
- ( ) Create sandbox testing tools

### Review Process
- (x) Automated security scanning
- (x) Manual review process for new extensions
- ( ) Report malicious extension
- ( ) Add vulnerability database
- ( ) Implement dependency scanning
- (x) Add security score
- ( ) Create security advisory system

### Trust & Verification
- ( ) Verified purchase/download reviews
- ( ) Rating aggregation and display
- ( ) Review moderation
- ( ) Add review helpfulness voting
- ( ) Implement review spam detection
- ( ) Add review response system
- ( ) Create review analytics

### Telemetry & Compliance
- ( ) Optional usage analytics
- ( ) Automatic crash report submission
- ( ) Performance metrics collection
- ( ) Add telemetry opt-out
- ( ) Implement data anonymization
- ( ) Add telemetry dashboard
- ( ) Create compliance reporting

## Developer Experience

### Development Tools
- ( ) Add development server with hot reload
- ( ) Create extension testing framework
- ( ) Add extension debugging tools
- ( ) Implement extension profiling
- ( ) Add extension documentation generator

- ( ) **MKT-DEV-02**: Extension developer documentation
  - ( ) Getting started guide
  - ( ) API reference
  - ( ) Best practices
  - ( ) Example extensions
  - ( ) Add video tutorials
  - ( ) Create API playground
  - ( ) Add interactive examples

- ( ) **MKT-DEV-03**: Local extension development mode
  - ( ) Hot reload for local extensions
  - ( ) Debug logging and inspection
  - ( ) Extension DevTools panel
  - ( ) Add extension reload shortcut
  - ( ) Implement extension state inspection
  - ( ) Add performance profiling
  - ( ) Create memory debugging

- ( ) **MKT-DEV-04**: Extension publishing workflow
  - ( ) CLI publish command
  - ( ) Version validation
  - ( ) Automated testing before publish
  - ( ) Add publishing checklist
  - ( ) Implement release notes generation
  - ( ) Add publishing preview
  - ( ) Create rollback capability

- ( ) **MKT-DEV-05**: Extension analytics dashboard
  - ( ) Download statistics
  - ( ) User engagement metrics
  - ( ) Error rate tracking
  - ( ) Add revenue tracking
  - ( ) Implement A/B testing
  - ( ) Add user demographics
  - ( ) Create custom reports
