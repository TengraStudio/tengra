# Idea Creation System - TODO

This document tracks bugs, improvements, and feature enhancements for the AI-powered project idea generation system.

*Last Updated: January 23, 2026*

---

## Bugs

### Critical

- [x] **BUG-IDX-001**: Silent error handling in `IdeaDetailsModal.handleSelectFolder`
  - Location: `src/renderer/features/ideas/components/IdeaDetailsModal.tsx:45-47`
  - Issue: Empty catch block with `// Silent fail` comment swallows errors when selecting folder
  - Impact: Users get no feedback if folder selection fails
  - Fix: ~~Show toast notification or error message to user~~ Added console.warn for debugging

- [x] **BUG-IDX-002**: Workflow state can become out of sync with session status (REVIEWED - Pattern is correct)
  - Location: `src/renderer/features/ideas/IdeasPage.tsx:33-56`
  - Issue: `useWorkflowSync` uses render-time state adjustment which may cause race conditions
  - Impact: UI may show wrong workflow stage after rapid session changes
  - Resolution: The "adjustment during render" pattern is React's recommended approach for deriving state from props. The implementation correctly tracks previous values and only updates when session changes.

### High Priority

- [x] **BUG-IDX-003**: Hardcoded strings in `SessionSetup.tsx`
  - Location: `src/renderer/features/ideas/components/SessionSetup.tsx:61-62`
  - Issue: String "Use the model selector in the top bar to change the AI model" is hardcoded
  - Impact: Not translatable, violates i18n requirements
  - Fix: ~~Add to translation keys and use `t('ideas.modelSelectorHint')`~~ Done

- [x] **BUG-IDX-004**: Hardcoded strings in `SessionHistory.tsx`
  - Location: `src/renderer/features/ideas/components/SessionHistory.tsx:36-91`
  - Issue: Multiple hardcoded strings: "Yesterday", "days ago", "Approved", "Rejected", "Pending", "View Details", "No ideas generated yet", stat labels
  - Impact: Not translatable
  - Fix: ~~Use translation function for all user-facing text~~ Done

- [x] **BUG-IDX-005**: `useIdeaApproval` error state not surfaced to parent
  - Location: `src/renderer/features/ideas/hooks/useIdeaApproval.ts`
  - Issue: Hook has `error` state but it's not being used in `IdeasPage.tsx`
  - Impact: Approval/rejection errors are invisible to users
  - Fix: ~~Include approval errors in the combined error display~~ Done

- [x] **BUG-IDX-006**: Missing dependency in `toggleSession` useCallback (ALREADY FIXED)
  - Location: `src/renderer/features/ideas/components/SessionHistory.tsx:261-301`
  - Issue: `sessionsWithIdeas` dependency causes stale closure issues
  - Impact: Expanding sessions may show stale data
  - Fix: ~~Use functional state updates or refs~~ Already using functional updates with empty deps

### Medium Priority

- [x] **BUG-IDX-007**: Research pipeline uses artificial delays *(FIXED 2026-01-25)*
  - Location: `src/main/services/llm/idea-generator.service.ts:146-183`
  - Issue: `this.delay()` calls are used to simulate work instead of actual async operations
  - Impact: Unnecessary waiting, poor UX when research is actually fast
  - Fix: Made delays configurable via `IDEA_DELAY_MULTIPLIER` env var (default: 0.1 = 10% of original delays)

- [x] **BUG-IDX-008**: Type casting workaround for database access (Resolved: `getDatabase()` used) <!-- id: idea-crit-3 -->
  - Location: `src/main/services/llm/idea-generator.service.ts:733-737`
  - Issue: `getDb()` uses unsafe type casting to access private `ensureDb` method
  - Impact: Fragile code that could break if DatabaseService internals change
  - Fix: Expose proper database access method in DatabaseService

- [x] **BUG-IDX-009**: Project return type inconsistency (Resolved: Unified `Project` return type) <!-- id: idea-crit-4 -->
  - Location: `src/main/services/llm/idea-generator.service.ts:646-650`
  - Issue: Manual date conversion with `as unknown as Project` type assertion
  - Impact: Type safety issue, potential runtime errors
  - Fix: Properly type the project creation response

- [x] **BUG-IDX-010**: Missing displayName for functional components
  - Location: `src/renderer/features/ideas/components/SessionHistory.tsx:93, 126`
  - Issue: `IdeaRow` and `SessionRow` components lack displayName
  - Impact: ESLint warnings, harder debugging in React DevTools
  - Fix: ~~Add displayName to components~~ Done

---

## Enhancements

### UX Improvements

- [x] **ENH-IDX-001**: Add confirmation dialog before rejecting ideas *(COMPLETED 2026-01-25)*
  - Location: `IdeaDetailsModal.tsx`
  - Description: Show "Are you sure?" dialog with reason input before rejecting
  - Implementation: Added modal with optional reason text field, cancel/confirm buttons
  - Priority: High

- [x] **ENH-IDX-002**: Add ability to edit/rename generated ideas *(COMPLETED 2026-01-25)*
  - Description: Allow users to modify title and description before approval
  - Implementation: Title already editable, added editable textarea for description in overview tab
  - Shows "Reset" button when description is modified
  - Priority: Medium

- [ ] **ENH-IDX-003**: Add idea comparison view
  - Description: Side-by-side comparison of multiple ideas from same session
  - Priority: Medium

- [x] **ENH-IDX-004**: Add search and filter for session history *(COMPLETED 2026-01-25)*
  - Location: `SessionHistory.tsx`
  - Description: Filter by category, status, date range; search by title
  - Implementation: Added search input, status filter dropdown, category filter dropdown with active filters indicator
  - Priority: High → COMPLETED

- [x] **ENH-IDX-005**: Add keyboard shortcuts for workflow *(COMPLETED 2026-01-25)*
  - Description: Arrow keys to navigate ideas, Enter to approve, Escape to close modal
  - Implementation: Added Escape to close modal, Ctrl+Enter to approve, Ctrl+Backspace to reject
  - Priority: Medium

- [ ] **ENH-IDX-006**: Add drag-and-drop reordering of ideas *(MEDIUM - Upgraded from LOW, UX enhancement)*
  - Description: Allow prioritizing ideas within a session
  - Priority: Medium

### Feature Additions

- [ ] **ENH-IDX-007**: Add idea templates/presets
  - Description: Save frequently used category+model combinations as presets
  - Priority: Medium

- [ ] **ENH-IDX-008**: Add collaborative features *(MEDIUM - Upgraded from LOW, team features)*
  - Description: Share ideas with team members, collect votes
  - Priority: Medium

- [x] **ENH-IDX-009**: Add export functionality *(COMPLETED 2026-01-25)*
  - Description: Export ideas to Markdown or JSON
  - Implementation: Added export dropdown in review stage header with Markdown and JSON formats
  - Priority: Medium → COMPLETED

- [ ] **ENH-IDX-010**: Add idea versioning *(MEDIUM - Upgraded from LOW, data integrity)*
  - Description: Track changes when ideas are enriched or modified
  - Priority: Medium

- [x] **ENH-IDX-011**: Add regenerate single idea *(COMPLETED 2026-01-25)*
  - Description: Button to regenerate just one idea if it's not good
  - Implementation: Added "Regenerate" button in IdeaDetailsModal, runs full 9-stage pipeline with same category, replaces existing idea
  - Priority: High → COMPLETED

- [x] **ENH-IDX-012**: Add custom prompt input for idea generation *(COMPLETED 2026-01-25)*
  - Description: Let users provide additional context/constraints for generation
  - Implementation: Added optional custom prompt textarea in SessionSetup, stored in database, incorporated into seed generation prompts
  - Priority: High → COMPLETED

- [x] **ENH-IDX-013**: Add market research preview in session setup *(COMPLETED 2026-01-25)*
  - Description: Show quick market analysis before committing to full research
  - Implementation: Added "Preview Market" button that shows quick overview (summary, key trends, market size, competition level) for each category using gpt-4o-mini
  - Priority: Medium → COMPLETED

### Technical Improvements

- [ ] **ENH-IDX-014**: Add proper state machine for workflow stages
  - Location: `IdeasPage.tsx`
  - Description: Use XState or similar library for predictable state transitions
  - Priority: High

- [x] **ENH-IDX-015**: Add optimistic UI updates *(COMPLETED 2026-01-25)*
  - Description: Update UI immediately on approve/reject, rollback on error
  - Implementation: UI updates instantly, rollsback if API fails
  - Priority: Medium

- [x] **ENH-IDX-016**: Add caching for session history *(COMPLETED 2026-01-25)*
  - Description: Cache loaded ideas per session to avoid repeated fetches
  - Implementation: Added useMemo for ideas and sessions with formatted metadata
  - Priority: Medium

- [x] **ENH-IDX-017**: Add retry logic for LLM failures *(COMPLETED 2026-01-25)*
  - Location: `idea-generator.service.ts`
  - Description: Exponential backoff retry for transient failures
  - Implementation: Added retryLLMCall() wrapper with max 3 retries, exponential backoff (1s, 2s, 4s...), retries on rate limits, timeouts, network errors
  - Priority: High → COMPLETED

- [ ] **ENH-IDX-018**: Add streaming for idea generation
  - Description: Stream idea content as it's generated for faster UX
  - Priority: Medium

- [ ] **ENH-IDX-019**: Add unit tests for IdeaGeneratorService
  - Description: Test session management, idea deduplication, parsing logic
  - Priority: High

- [ ] **ENH-IDX-020**: Add integration tests for idea workflow
  - Description: End-to-end tests for complete idea generation flow
  - Priority: Medium

### Performance

- [ ] **ENH-IDX-021**: Virtualize session history list
  - Location: `SessionHistory.tsx`
  - Description: Use react-window for large session lists
  - Priority: Low

- [ ] **ENH-IDX-022**: Add pagination for ideas
  - Description: Lazy load ideas instead of fetching all at once
  - Priority: Low

- [ ] **ENH-IDX-023**: Optimize similarity checking algorithm
  - Location: `idea-generator.service.ts:217-250`
  - Description: Use Levenshtein distance or TF-IDF for better deduplication
  - Priority: Medium

- [ ] **ENH-IDX-024**: Export Project Brief
  - Description: Multi-format export (PDF, Markdown, JSON) for the complete 12-stage analysis, SWOT, and GTM plans.
  - Priority: High

- [ ] **ENH-IDX-025**: Research-to-Code Scaffolding
  - Description: Automatically generate a `project.md` and `architecture.md` when approving an idea, populated with GTM insights.
  - Priority: Medium

- [ ] **ENH-IDX-026**: Interactive Research RAG
  - Description: Allow the Research Assistant to browse and cite raw web search results stored in the vector cache.
  - Priority: High

- [ ] **ENH-IDX-027**: Persistent Research History
  - Description: Save and restore research interview chats within the idea records.
  - Priority: Medium

---

## Architecture Considerations

- [ ] **ARCH-IDX-001**: Extract idea workflow into separate state machine
  - Consider migrating workflow logic to a dedicated hook or XState machine

- [ ] **ARCH-IDX-002**: Create IdeaRepository abstraction
  - Separate database operations from business logic in IdeaGeneratorService

- [ ] **ARCH-IDX-003**: Add event sourcing for idea history
  - Track all modifications as events for better auditability

- [x] **ARCH-IDX-004**: Make IdeaGeneratorService modular
  - Extract sub-services: ResearchPipelineService, IdeaEnrichmentService, LogoGenerationService
  - Created: `DeepResearchService` for advanced multi-source research
  - Created: `IdeaScoringService` for AI-powered idea scoring/ranking
  - Each module should be independently testable and replaceable
  - Use dependency injection for all sub-services
  - Priority: High

- [x] **ARCH-IDX-005**: Create dedicated IdeaStorageService
  - Handle all CRUD operations for ideas in a separate service
  - ~~Support soft-delete with restore capability~~ Done (archiveIdea, restoreIdea)
  - ~~Add bulk operations (delete multiple, archive session)~~ Partial (deleteSession added)
  - Priority: High

---

## Data Management

- [x] **DATA-IDX-001**: Add idea deletion functionality
  - Location: `idea-generator.service.ts`, `IdeasPage.tsx`, `IdeaDetailsModal.tsx`
  - Description: Allow users to permanently delete individual ideas
  - ~~Add confirmation dialog with "Are you sure?"~~ Backend ready, UI pending
  - ~~Consider soft-delete first (archive) with permanent delete option~~ Done
  - Priority: High

- [x] **DATA-IDX-002**: Add session deletion functionality
  - Description: Allow deleting entire sessions with all their ideas
  - ~~Add cascade delete for all associated ideas~~ Done (deleteSession method)
  - Preserve audit log of deleted sessions
  - Priority: High

- [x] **DATA-IDX-003**: Add idea archiving
  - Description: Archive ideas instead of rejecting (keep for later review)
  - ~~Add "Archive" button alongside Approve/Reject~~ Backend ready
  - ~~Add filter to show/hide archived ideas~~ getArchivedIdeas method added
  - Priority: Medium

- [ ] **DATA-IDX-004**: Add batch operations
  - Description: Select multiple ideas for bulk approve/reject/delete/archive
  - Add checkbox selection in review view
  - Add "Select All" / "Deselect All" controls
  - Priority: Medium

- [x] **DATA-IDX-005**: Add idea restore functionality
  - Description: Restore deleted/archived ideas
  - ~~Add "Trash" section in session history~~ Backend ready (restoreIdea method)
  - Auto-purge after 30 days (configurable)
  - Priority: Low

---

## Advanced Research System (NEW)

- [x] **ADV-IDX-001**: Deep Research Service
  - Location: `src/main/services/external/deep-research.service.ts`
  - Description: Multi-source research with citations and credibility scoring
  - Features:
    - 13 different research queries per topic (trends, competitors, market size, user needs, etc.)
    - Credibility scoring for sources (0-100 based on domain authority)
    - Full content fetching for top sources
    - AI-powered synthesis of findings with citations
    - Research caching (30 min TTL) to avoid redundant queries
    - Metrics: trend momentum, competitor density, opportunity score
  - IPC Handlers: `ideas:deepResearch`, `ideas:validateIdea`, `ideas:clearResearchCache`
  - Priority: High

- [x] **ADV-IDX-002**: Idea Scoring Service
  - Location: `src/main/services/llm/idea-scoring.service.ts`
  - Description: AI-powered scoring and ranking of project ideas
  - Features:
    - 6-dimension scoring (innovation, market need, feasibility, business potential, target clarity, competitive moat)
    - Detailed breakdown with strengths, weaknesses, improvements
    - Quick score mode for fast evaluation
    - Idea comparison (head-to-head)
    - Batch ranking of multiple ideas
  - IPC Handlers: `ideas:scoreIdea`, `ideas:rankIdeas`, `ideas:compareIdeas`, `ideas:quickScore`
  - Priority: High

- [ ] **ADV-IDX-003**: Research Quality Improvements
  - Add Tavily "advanced" search depth mode (deeper content)
  - Add source validation with fact-checking
  - Add trend momentum scoring based on search volume
  - Implement RAG with vector storage for research data
  - Priority: Medium

- [ ] **ADV-IDX-004**: Feasibility Analysis Stage
  - Add technical feasibility assessment
  - Add resource requirement estimation
  - Add timeline estimation based on tech stack
  - Add team size recommendations
  - Priority: Medium

## Next-Generation Features (NEW)

### AI & Machine Learning Enhancements

- [ ] **ML-IDX-001**: Idea Success Prediction Model
  - Description: Train ML model on historical data to predict idea success probability
  - Features:
    - Analyze patterns from approved vs rejected ideas
    - Factor in user behavior, development time, project completion rates
    - Provide success probability score (0-100%)
    - Learn from user feedback and project outcomes
  - Priority: High

- [ ] **ML-IDX-002**: Personalized Idea Generation
  - Description: Learn from user preferences to generate more relevant ideas
  - Features:
    - Track which ideas users approve/reject and why
    - Analyze preferred categories, technologies, business models
    - Adapt generation prompts based on user profile
    - Suggest categories user is most likely to enjoy
  - Priority: Medium

- [ ] **ML-IDX-003**: Market Trend Prediction
  - Description: Use historical trend data to predict upcoming opportunities
  - Features:
    - Analyze 5+ years of tech trend data
    - Identify cyclical patterns in technology adoption
    - Predict emerging technologies 6-12 months early
    - Generate "future-ready" ideas based on predictions
  - Priority: Medium

### Advanced Research & Data Mining

- [ ] **RES-IDX-001**: Patent Analysis Integration
  - Description: Analyze patent filings to identify innovation gaps
  - Features:
    - Search patent databases for related technologies
    - Identify expired patents for potential revival
    - Find patent gaps that suggest opportunities
    - Warning system for heavily patented areas
  - Priority: Medium

- [ ] **RES-IDX-002**: Social Media Sentiment Analysis
  - Description: Analyze social platforms for pain points and needs
  - Features:
    - Monitor Twitter, Reddit, HN for user complaints
    - Identify trending frustrations and unmet needs
    - Track discussion volume around topics over time
    - Generate ideas based on community pain points
  - Priority: Medium

- [ ] **RES-IDX-003**: GitHub Activity Mining
  - Description: Analyze open source activity for emerging trends
  - Features:
    - Track new repository creation patterns
    - Identify rapidly growing programming languages/frameworks
    - Analyze issue reports for common developer problems
    - Suggest tooling ideas based on developer pain points
  - Priority: Low

- [ ] **RES-IDX-004**: Economic Data Integration
  - Description: Factor economic indicators into idea evaluation
  - Features:
    - Track GDP, employment rates, consumer spending
    - Identify recession-proof business models
    - Adjust idea scoring based on economic climate
    - Suggest timing for launching different types of products
  - Priority: Low

### Collaboration & Team Features

- [ ] **TEAM-IDX-001**: Multi-User Idea Sessions
  - Description: Allow teams to collaborate on idea generation
  - Features:
    - Real-time collaborative sessions with multiple participants
    - Voting system for ideas (like/dislike, star ratings)
    - Role-based permissions (generator, reviewer, approver)
    - Team decision tracking and consensus building
  - Priority: High

- [ ] **TEAM-IDX-002**: Expert Review Network
  - Description: Connect with domain experts for idea validation
  - Features:
    - Network of verified industry experts
    - Submit ideas for expert review (anonymous or credited)
    - Expert scoring and feedback integration
    - Reputation system for expert reviewers
  - Priority: Low

- [ ] **TEAM-IDX-003**: Idea Marketplace
  - Description: Platform for sharing and discovering ideas
  - Features:
    - Public idea sharing (with permission controls)
    - Browse ideas by category, technology, difficulty
    - Collaboration matching (find co-founders for ideas)
    - License framework for idea sharing/selling
  - Priority: Low

### Advanced Analytics & Insights

- [ ] **ANAL-IDX-001**: Idea Lifecycle Analytics
  - Description: Track ideas from generation to project completion
  - Features:
    - Success rate tracking by category, complexity, team size
    - Time-to-market analysis for different idea types
    - Abandonment pattern analysis
    - ROI prediction based on historical project data
  - Priority: Medium

- [ ] **ANAL-IDX-002**: Market Timing Optimization
  - Description: Analyze optimal timing for different types of ideas
  - Features:
    - Seasonal trend analysis (when to launch different products)
    - Technology maturity cycle tracking
    - Market saturation indicators
    - Competitive landscape evolution patterns
  - Priority: Medium

- [ ] **ANAL-IDX-003**: Portfolio Optimization
  - Description: Help users balance their idea portfolio
  - Features:
    - Risk/reward analysis across multiple ideas
    - Diversification recommendations
    - Resource allocation suggestions
    - Timeline conflict detection and resolution
  - Priority: Low

### Integration & Ecosystem

- [ ] **INT-IDX-001**: No-Code Platform Integration
  - Description: Generate ideas specifically for no-code platforms
  - Features:
    - Bubble, Webflow, Zapier-specific idea templates
    - Feasibility analysis for no-code implementation
    - Template generation for popular no-code tools
    - Complexity scoring for no-code viability
  - Priority: Medium

- [ ] **INT-IDX-002**: Startup Ecosystem Integration
  - Description: Connect with startup tools and platforms
  - Features:
    - AngelList integration for team matching
    - ProductHunt submission automation
    - Y Combinator application helper
    - Pitch deck generation from idea data
  - Priority: Low

- [ ] **INT-IDX-003**: Development Tool Integration
  - Description: Generate project scaffolding and tooling
  - Features:
    - GitHub repository creation with README, issues, milestones
    - CI/CD pipeline templates based on tech stack
    - Docker configuration generation
    - Database schema suggestions and migration files
  - Priority: Medium

### Quality & Refinement

- [ ] **QUAL-IDX-001**: Idea Stress Testing
  - Description: Simulate various scenarios to test idea robustness
  - Features:
    - Economic downturn impact simulation
    - Technology disruption scenarios
    - Competitive response modeling
    - Scalability bottleneck identification
  - Priority: Medium

- [ ] **QUAL-IDX-002**: Regulatory Compliance Analysis
  - Description: Identify potential regulatory challenges early
  - Features:
    - GDPR, CCPA compliance requirements analysis
    - Industry-specific regulation identification
    - International market entry requirements
    - Legal risk assessment and mitigation suggestions
  - Priority: Low

- [ ] **QUAL-IDX-003**: Accessibility & Inclusion Scoring
  - Description: Evaluate ideas for accessibility and inclusivity
  - Features:
    - WCAG compliance requirements analysis
    - Diverse user group consideration scoring
    - Internationalization complexity assessment
    - Social impact potential evaluation
  - Priority: Medium

### Gamification & Motivation

- [ ] **GAME-IDX-001**: Achievement System
  - Description: Gamify the idea generation process
  - Features:
    - Badges for generating ideas, completing research, launching projects
    - Streak tracking for consistent idea generation
    - Leaderboards for most innovative ideas
    - Progress tracking toward personal goals
  - Priority: Low

- [ ] **GAME-IDX-002**: Idea Challenges
  - Description: Structured challenges to stimulate creativity
  - Features:
    - Weekly/monthly themed challenges (e.g., "Climate Tech Week")
    - Constraint-based challenges (build with specific tech stack)
    - Time-boxed rapid idea generation sessions
    - Community voting on challenge winners
  - Priority: Low

### Research Export & Documentation

- [ ] **DOC-IDX-001**: Executive Summary Generator
  - Description: Auto-generate professional summaries of ideas
  - Features:
    - One-page executive summary with key metrics
    - Investment pitch formatting
    - Technical specification documents
    - Market analysis reports
  - Priority: High

- [ ] **DOC-IDX-002**: Research Citation Management
  - Description: Proper academic-style citation of research sources
  - Features:
    - APA, MLA, Chicago style citation generation
    - Bibliography management for all research sources
    - Source credibility indicators in citations
    - Export to reference managers (Zotero, Mendeley)
  - Priority: Medium

---

## Notes

- The idea generation system is a key feature for project bootstrapping
- Logo generation requires Antigravity authentication
- Research pipeline integrates with MarketResearchService for real market data
- **New services created:**
  - `DeepResearchService` - Advanced research with citations, credibility scoring, and AI synthesis
  - `IdeaScoringService` - AI-powered idea evaluation and ranking
