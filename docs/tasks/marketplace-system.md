# Marketplace System (VSCode-style Extensions)

> Extracted from TODO.md — remaining tasks only

## Core Infrastructure & Centralization

- (x) **MKT-INFRA-09**: Implement Centralized Marketplace Indexer Service (VPS-side).

## Data Catalog Expansion (Marketplace)

- (x) **MKT-DATA-10**: Expand marketplace catalog with ready-to-use prompt packs and theme packs.
  - (x) Define DB schema additions for prompt pack metadata (category, language, tags, quality score, maintainer).
  - (x) Define DB schema additions for theme pack metadata (palette, contrast score, accessibility score, compatibility).
  - (x) Add curated seed data pipeline for initial prompt/theme inventory.
  - (x) Build ingestion validation for prompt/theme records (required fields, sanitization, dedupe).
  - (x) Add admin moderation flow for prompt/theme acceptance, rejection, and revision requests.
  - (x) Add prompt/theme versioning and changelog support in catalog records.
  - (x) Add prompt/theme compatibility labels for Tengra app versions.

- (x) **MKT-DATA-11**: Keep Hub system removed and streamline marketplace taxonomy.
  - (x) Remove/avoid Hub-specific navigation labels from marketplace context.
  - (x) Consolidate top-level content types into Models, Prompts, Themes, Workflows, Extensions.
  - (x) Update discovery heuristics to avoid Hub-specific grouping assumptions.

## UI Components

Location: `src/renderer/features/marketplace/`

### Marketplace Browser

### Extension Cards

### Search & Filter

### Advanced Filtering & Sorting (Next Iteration)
- (x) **MKT-DISC-20**: Add advanced multi-dimensional filters for marketplace browsing.
  - (x) Filter by content type (model, prompt, theme, workflow, extension).
  - (x) Filter by provider/source (huggingface, ollama, github, community).
  - (x) Filter by license family and commercial-usage eligibility.
  - (x) Filter by language and multilingual support.
  - (x) Filter by update recency windows (24h, 7d, 30d, 90d).
  - (x) Filter by quality/trust labels (verified, curated, security-scanned).
  - (x) Filter by size/runtime requirements for models.
  - (x) Add combinational filter chips with clear-all and saved views.

- (x) **MKT-DISC-21**: Extend sorting options with marketplace-relevant ranking signals.
  - (x) Sort by newest, recently updated, most downloaded, most liked, highest rated.
  - (x) Sort by trend score (short-term growth), not only cumulative popularity.
  - (x) Sort by quality score and trust/security score.
  - (x) Sort by install success rate and low failure rate.
  - (x) Support user-selectable default sort per content type.
  - (x) Add backend-supported stable sorting with deterministic tie-breakers.

### Extension Detail Page

### Installed Extensions Manager

### Installation Wizard

### Rating & Review System

### Comparison View

## Extension Types

### MCP Server Extensions

### Theme Extensions

### Command Extensions

### Language Extensions

### Agent Templates

### UI Extensions

### Integration Extensions

## Security

### Code Signing
- (x) Implement code signing for extensions
- (x) Verify signatures before installation
- (x) Add trusted publisher system
- (x) Create signing key management
- (x) Add signature revocation
- (x) Implement certificate pinning
- (x) Add signature timestamping

### Sandboxing
- (x) Isolate extension code from main process
- (x) Resource usage limits (CPU, memory, time)
- (x) Network request filtering
- (x) Add sandbox escape detection
- (x) Implement sandbox logging
- (x) Add sandbox configuration
- (x) Create sandbox testing tools

### Review Process
- (x) Report malicious extension
- (x) Add vulnerability database
- (x) Implement dependency scanning
- (x) Create security advisory system

### Trust & Verification
- (x) Verified purchase/download reviews
- (x) Rating aggregation and display
- (x) Review moderation
- (x) Add review helpfulness voting
- (x) Implement review spam detection
- (x) Add review response system
- (x) Create review analytics

## User Interaction Backlog (TODO)

- (x) **MKT-UX-30**: Add user interaction layer for marketplace entities.
  - (x) Ratings and text reviews for models/prompts/themes/extensions.
  - (x) Favorites/bookmarks and custom user collections.
  - (x) Follow publisher/maintainer and item update notifications.
  - (x) One-click feedback after install/use (success, issue type, satisfaction).
  - (x) "Helpful" voting and review quality scoring.
  - (x) Abuse/report workflow for malicious or low-quality content.
  - (x) Interaction analytics dashboard for admin moderation insights.

### Telemetry & Compliance
- (x) Optional usage analytics
- (x) Automatic crash report submission
- (x) Performance metrics collection
- (x) Add telemetry opt-out
- (x) Implement data anonymization
- (x) Add telemetry dashboard
- (x) Create compliance reporting

## Developer Experience

### Development Tools
- (x) Add development server with hot reload
- (x) Create extension testing framework
- (x) Add extension debugging tools
- (x) Implement extension profiling
- (x) Add extension documentation generator

- [x] **MKT-DEV-02**: Extension developer documentation
  - [x] Getting started guide
  - [x] API reference
  - [x] Best practices
  - [x] Example extensions
  - (x) Add video tutorials
  - (x) Create API playground
  - (x) Add interactive examples

- [/] **MKT-DEV-03**: Local extension development mode
  - [/] Hot reload for local extensions
  - [/] Debug logging and inspection
  - [/] Extension DevTools panel
  - (x) Add extension reload shortcut
  - (x) Implement extension state inspection
  - (x) Add performance profiling
  - (x) Create memory debugging

- (x) **MKT-DEV-04**: Extension publishing workflow
  - (x) CLI publish command
  - (x) Version validation
  - (x) Automated testing before publish
  - (x) Add publishing checklist
  - (x) Implement release notes generation
  - (x) Add publishing preview
  - (x) Create rollback capability

- (x) **MKT-DEV-05**: Extension analytics dashboard
  - (x) Download statistics
  - (x) User engagement metrics
  - (x) Error rate tracking
  - (x) Add revenue tracking
  - (x) Implement A/B testing
  - (x) Add user demographics
  - (x) Create custom reports
