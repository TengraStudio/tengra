# Idea Creation System - TODO

This document tracks bugs, improvements, and feature enhancements for the AI-powered project idea generation system.

*Last Updated: January 22, 2026*

---

## Bugs

### Critical

- [x] **BUG-IDX-001**: Silent error handling in `IdeaDetailsModal.handleSelectFolder`
  - Location: `src/renderer/features/ideas/components/IdeaDetailsModal.tsx:45-47`
  - Issue: Empty catch block with `// Silent fail` comment swallows errors when selecting folder
  - Impact: Users get no feedback if folder selection fails
  - Fix: ~~Show toast notification or error message to user~~ Added console.warn for debugging

- [ ] **BUG-IDX-002**: Workflow state can become out of sync with session status
  - Location: `src/renderer/features/ideas/IdeasPage.tsx:33-53`
  - Issue: `useWorkflowSync` uses render-time state adjustment which may cause race conditions
  - Impact: UI may show wrong workflow stage after rapid session changes
  - Fix: Use proper state machine or useEffect with cleanup

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

- [ ] **BUG-IDX-006**: Missing dependency in `toggleSession` useCallback
  - Location: `src/renderer/features/ideas/components/SessionHistory.tsx:242-283`
  - Issue: `sessionsWithIdeas` dependency causes stale closure issues
  - Impact: Expanding sessions may show stale data
  - Fix: Use functional state updates or refs

### Medium Priority

- [ ] **BUG-IDX-007**: Research pipeline uses artificial delays
  - Location: `src/main/services/llm/idea-generator.service.ts:146-183`
  - Issue: `this.delay()` calls are used to simulate work instead of actual async operations
  - Impact: Unnecessary waiting, poor UX when research is actually fast
  - Fix: Remove artificial delays or make them configurable

- [ ] **BUG-IDX-008**: Type casting workaround for database access
  - Location: `src/main/services/llm/idea-generator.service.ts:733-737`
  - Issue: `getDb()` uses unsafe type casting to access private `ensureDb` method
  - Impact: Fragile code that could break if DatabaseService internals change
  - Fix: Expose proper database access method in DatabaseService

- [ ] **BUG-IDX-009**: Project return type inconsistency
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

- [ ] **ENH-IDX-001**: Add confirmation dialog before rejecting ideas
  - Location: `IdeaDetailsModal.tsx`
  - Description: Show "Are you sure?" dialog with reason input before rejecting
  - Priority: High

- [ ] **ENH-IDX-002**: Add ability to edit/rename generated ideas
  - Description: Allow users to modify title and description before approval
  - Priority: Medium

- [ ] **ENH-IDX-003**: Add idea comparison view
  - Description: Side-by-side comparison of multiple ideas from same session
  - Priority: Medium

- [ ] **ENH-IDX-004**: Add search and filter for session history
  - Location: `SessionHistory.tsx`
  - Description: Filter by category, status, date range; search by title
  - Priority: High

- [ ] **ENH-IDX-005**: Add keyboard shortcuts for workflow
  - Description: Arrow keys to navigate ideas, Enter to approve, Escape to close modal
  - Priority: Low

- [ ] **ENH-IDX-006**: Add drag-and-drop reordering of ideas
  - Description: Allow prioritizing ideas within a session
  - Priority: Low

### Feature Additions

- [ ] **ENH-IDX-007**: Add idea templates/presets
  - Description: Save frequently used category+model combinations as presets
  - Priority: Medium

- [ ] **ENH-IDX-008**: Add collaborative features
  - Description: Share ideas with team members, collect votes
  - Priority: Low

- [ ] **ENH-IDX-009**: Add export functionality
  - Description: Export ideas to Markdown, PDF, or JSON
  - Priority: Medium

- [ ] **ENH-IDX-010**: Add idea versioning
  - Description: Track changes when ideas are enriched or modified
  - Priority: Low

- [ ] **ENH-IDX-011**: Add regenerate single idea
  - Description: Button to regenerate just one idea if it's not good
  - Priority: High

- [ ] **ENH-IDX-012**: Add custom prompt input for idea generation
  - Description: Let users provide additional context/constraints for generation
  - Priority: High

- [ ] **ENH-IDX-013**: Add market research preview in session setup
  - Description: Show quick market analysis before committing to full research
  - Priority: Medium

### Technical Improvements

- [ ] **ENH-IDX-014**: Add proper state machine for workflow stages
  - Location: `IdeasPage.tsx`
  - Description: Use XState or similar library for predictable state transitions
  - Priority: High

- [ ] **ENH-IDX-015**: Add optimistic UI updates
  - Description: Update UI immediately on approve/reject, rollback on error
  - Priority: Medium

- [ ] **ENH-IDX-016**: Add caching for session history
  - Description: Cache loaded ideas per session to avoid repeated fetches
  - Priority: Medium

- [ ] **ENH-IDX-017**: Add retry logic for LLM failures
  - Location: `idea-generator.service.ts`
  - Description: Exponential backoff retry for transient failures
  - Priority: High

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

---

## Notes

- The idea generation system is a key feature for project bootstrapping
- Logo generation requires Antigravity authentication
- Research pipeline integrates with MarketResearchService for real market data
