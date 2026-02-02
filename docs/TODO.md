# Tandem Project - TODO List

> **41 remaining items** - Focus on security, performance, and testing

---

## 📊 Summary Statistics

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Security | 7 | 15 | 8 | 1 | 31 |
| Code Quality | 0 | 0 | 3 | 1 | 4 |
| Performance | 0 | 1 | 4 | 1 | 6 |
| Testing | 0 | 23 | 17 | 10 | 50* |
| **Total** | **7** | **39** | **32** | **13** | **91*** |

> *Note: Testing category significantly inflates count (50 items). Core actionable items: 41

---

## 🔴 CRITICAL PRIORITY (Security & Stability)

### SEC-004: Insecure CSP & Electron Configuration
- [ ] **SEC-004-3**: Add certificate validation handlers in main process <!-- severity: high -->
- [ ] **SEC-004-4**: Add permission request handlers for camera/mic/notifications <!-- severity: high -->

### SEC-005: Unsafe External Process Execution
- [ ] **SEC-005-3**: Verify source/signature before MCP plugin execution <!-- severity: high -->
- [ ] **SEC-005-4**: Add privilege escalation checks in `src/main/mcp/servers/network.server.ts:11-13` - SSH commands unchecked <!-- severity: high -->

### SEC-007: Weak Cryptography & Token Generation
- [ ] **SEC-007-3**: Encrypt master key at rest in `src/main/services/security/security.service.ts:30-38` <!-- severity: high -->

### SEC-009: API & CORS Issues
- [ ] **SEC-009-3**: Add rate limiting to API endpoints <!-- severity: high -->

---

## 🟠 HIGH PRIORITY (Reliability & Quality)

### AGENT-001: Agent Service Issues
- [ ] **AGENT-001-1**: Add timeout/cancellation to `src/main/services/agent/agent-state-machine.ts` <!-- severity: high -->
- [ ] **AGENT-001-2**: Add size limits to eventHistory/messageHistory in agent state machine <!-- severity: high -->
- [ ] **AGENT-001-3**: Add permission validation in `src/main/services/agent/agent-registry.service.ts:45-48` <!-- severity: high -->
- [ ] **AGENT-001-4**: Fix race condition in `src/main/services/agent/agent-persistence.service.ts:164-189` <!-- severity: high -->
- [ ] **AGENT-001-5**: Add cleanup on task cancellation in handleStop() <!-- severity: high -->

### LLM-001: LLM Service Issues
- [ ] **LLM-001-1**: Fix token counting inaccuracy in `src/main/services/llm/token-estimation.service.ts:27` - CHARS_PER_TOKEN=4 too simple <!-- severity: high -->
- [ ] **LLM-001-2**: Add abort handling to chatOpenAI, chatAnthropic, chatGroq <!-- severity: high -->
- [ ] **LLM-001-3**: Add context overflow mitigation in `src/main/services/llm/context-window.service.ts:48` <!-- severity: high -->
- [ ] **LLM-001-4**: Fix streaming timeout in `src/main/services/llm/ollama.service.ts` - set to 0 (no timeout) <!-- severity: medium -->
- [ ] **LLM-001-5**: Add content filtering for LLM outputs <!-- severity: medium -->

### IPC-001: IPC Handler Issues
- [ ] **IPC-001-5**: Add rate limiting to write-heavy IPC operations <!-- severity: high -->
- [ ] **IPC-001-6**: Clean up event listeners in `src/main/ipc/ssh.ts` on disconnect <!-- severity: medium -->

### TYPE-001: Type Safety Issues
- [ ] **TYPE-001-4**: Add validation for Message.content union type <!-- severity: medium -->
- [ ] **TYPE-001-5**: Implement discriminated unions for UACNode types <!-- severity: medium -->

### SEC-011: Missing Rate Limiting
- [ ] **SEC-011-3**: Add rate limiting to git operations in `src/main/ipc/git.ts` <!-- severity: medium -->
- [ ] **SEC-011-4**: Add rate limiting to database writes in `src/main/ipc/db.ts` <!-- severity: high -->
- [ ] **SEC-011-5**: Add rate limiting to tool execution in `src/main/ipc/tools.ts` <!-- severity: high -->
- [ ] **SEC-011-6**: Add rate limiting to terminal input in `src/main/ipc/terminal.ts:write` <!-- severity: medium -->

### SEC-012: Memory & Resource Limits
- [ ] **SEC-012-1**: Add memory limits to external plugin spawns <!-- severity: high -->
- [ ] **SEC-012-2**: Add CPU limits to external plugin spawns <!-- severity: high -->
- [ ] **SEC-012-3**: Add file handle limits to spawned processes <!-- severity: medium -->
- [ ] **SEC-012-4**: Add bounded queue size for pending requests <!-- severity: medium -->
- [ ] **SEC-012-5**: Add max event history limit in agent state machine <!-- severity: medium -->

### SEC-013: Authentication & Authorization
- [ ] **SEC-013-1**: Add permission validation to `agent-registry.service.ts` profile registration <!-- severity: high -->
- [ ] **SEC-013-2**: Add authorization checks for provider access in rotation service <!-- severity: high -->
- [ ] **SEC-013-3**: Add auth check for window operations in `src/main/ipc/window.ts` <!-- severity: medium -->
- [ ] **SEC-013-4**: Add access control for log writing in `src/main/ipc/logging.ts` <!-- severity: low -->

### SEC-014: Data Protection
- [ ] **SEC-014-1**: Encrypt session tokens at rest in `auth.service.ts` <!-- severity: high -->
- [ ] **SEC-014-2**: Add TTL/expiration validation for stored tokens <!-- severity: high -->

### SEC-015: Prompt Injection Prevention
- [ ] **SEC-015-3**: Add prompt template escaping for user inputs <!-- severity: medium -->

---

## 🟡 MEDIUM PRIORITY (Code Quality & Maintainability)

### PERF-001: Missing Virtualization
- [ ] **PERF-001-1**: Add virtualization to `src/renderer/features/memory/components/MemoryList.tsx:52-63` <!-- severity: high -->
- [ ] **PERF-001-2**: Add virtualization to `src/renderer/features/ssh/components/SSHConnectionList.tsx` <!-- severity: medium -->
- [ ] **PERF-001-3**: Add virtualization to `WorkspaceExplorer.tsx` tree structure <!-- severity: medium -->
- [ ] **PERF-001-4**: Add virtualization to `ModelsTab.tsx` model lists <!-- severity: medium -->

### PERF-002: Re-render Optimization
- [ ] **PERF-002-2**: Add useMemo for helper functions in `MessageBubble.tsx` <!-- severity: medium -->
- [ ] **PERF-002-3**: Memoize chart components in `StatisticsTab.tsx` <!-- severity: medium -->

### PERF-003: Database Query Optimization
- [ ] **PERF-003-4**: Add connection pooling in database-client.service.ts <!-- severity: medium -->

### PERF-005: Caching & Memoization
- [ ] **PERF-005-2**: Cache directory listings in FileExplorer <!-- severity: medium -->
- [ ] **PERF-005-3**: Use LRU cache in repositories - exists but unused <!-- severity: medium -->

### QUAL-001: Code Quality - Missing Documentation
- [ ] **QUAL-001-5**: Add OpenAPI/schema documentation for REST endpoints <!-- severity: medium -->

### QUAL-005: Unused/Dead Code
- [ ] **QUAL-005-2**: Remove unused parameters in agent-persistence.service.ts <!-- severity: low -->

### TODO-001: Unimplemented TODOs in Code
- [ ] **TODO-001-1**: Implement `src/main/services/data/database.service.ts:323` - episodic memory vector search <!-- severity: medium -->
- [ ] **TODO-001-2**: Implement `src/main/services/project/code-intelligence.service.ts:408` - TODO Scanner <!-- severity: medium -->
- [ ] **TODO-001-3**: Implement `src/main/services/project/project-agent.service.ts:636` - load active task from DB <!-- severity: medium -->
- [ ] **TODO-001-4**: Implement quota service in `src/main/services/agent/agent-provider-rotation.service.ts:307` <!-- severity: medium -->
- [ ] **TODO-001-5**: Implement `src/main/services/system/extension-detector.service.ts:52` - actual API detection <!-- severity: low -->
- [ ] **TODO-001-6**: Implement provider stats in `src/main/services/agent/agent-provider-rotation.service.ts:357-361` <!-- severity: low -->
- [ ] **TODO-001-7**: Persist fallback chain in `src/main/services/agent/agent-provider-rotation.service.ts:381` <!-- severity: low -->

---

## 🟢 TESTING

> **Note**: Testing category contains 50 items for creating test files. These are logged but not prioritized for immediate completion.


### TEST-001: Missing Test Files - Analysis Services (12 untested)
- [ ] **TEST-001-A1**: Add tests for `model-analytics.service.ts` <!-- severity: high -->
- [ ] **TEST-001-A2**: Add tests for `metrics.service.ts` <!-- severity: high -->
- [ ] **TEST-001-A3**: Add tests for `memory-profiling.service.ts` <!-- severity: high -->
- [ ] **TEST-001-A4**: Add tests for `scanner.service.ts` <!-- severity: medium -->
- [ ] **TEST-001-A5**: Add tests for `performance.service.ts` <!-- severity: high -->
- [ ] **TEST-001-A6**: Add tests for `pagespeed.service.ts` <!-- severity: medium -->
- [ ] **TEST-001-A7**: Add tests for `monitoring.service.ts` <!-- severity: high -->
- [ ] **TEST-001-A8**: Add tests for `telemetry.service.ts` <!-- severity: medium -->
- [ ] **TEST-001-A9**: Add tests for `sentry.service.ts` <!-- severity: medium -->
- [ ] **TEST-001-A10**: Add tests for `time-tracking.service.ts` <!-- severity: low -->
- [ ] **TEST-001-A11**: Add tests for `usage-tracking.service.ts` <!-- severity: medium -->

### TEST-002: Missing Test Files - External Services (11 untested)
- [ ] **TEST-002-E1**: Add tests for `web.service.ts` <!-- severity: high -->
- [ ] **TEST-002-E2**: Add tests for `utility.service.ts` <!-- severity: high -->
- [ ] **TEST-002-E3**: Add tests for `rule.service.ts` <!-- severity: medium -->
- [ ] **TEST-002-E4**: Add tests for `market-research.service.ts` <!-- severity: medium -->
- [ ] **TEST-002-E5**: Add tests for `logo.service.ts` <!-- severity: low -->
- [ ] **TEST-002-E6**: Add tests for `history-import.service.ts` <!-- severity: medium -->
- [ ] **TEST-002-E7**: Add tests for `feature-flag.service.ts` <!-- severity: high -->
- [ ] **TEST-002-E8**: Add tests for `deep-research.service.ts` <!-- severity: high -->
- [ ] **TEST-002-E9**: Add tests for `content.service.ts` <!-- severity: medium -->
- [ ] **TEST-002-E10**: Add tests for `collaboration.service.ts` <!-- severity: medium -->

### TEST-003: Missing Test Files - LLM Services (23 untested)
- [ ] **TEST-003-L1**: Add tests for `ollama.service.ts` <!-- severity: high -->
- [ ] **TEST-003-L2**: Add tests for `ollama-health.service.ts` <!-- severity: medium -->
- [ ] **TEST-003-L3**: Add tests for `multi-model-comparison.service.ts` <!-- severity: high -->
- [ ] **TEST-003-L4**: Add tests for `multi-llm-orchestrator.service.ts` <!-- severity: high -->
- [ ] **TEST-003-L5**: Add tests for `model-collaboration.service.ts` <!-- severity: medium -->
- [ ] **TEST-003-L6**: Add tests for `memory.service.ts` <!-- severity: high -->
- [ ] **TEST-003-L7**: Add tests for `local-image.service.ts` <!-- severity: medium -->
- [ ] **TEST-003-L8**: Add tests for `local-ai.service.ts` <!-- severity: medium -->
- [ ] **TEST-003-L9**: Add tests for `llama.service.ts` <!-- severity: medium -->
- [ ] **TEST-003-L10**: Add tests for `idea-scoring.service.ts` <!-- severity: high -->
- [ ] **TEST-003-L11**: Add tests for `idea-generator.service.ts` <!-- severity: high -->
- [ ] **TEST-003-L12**: Add tests for `idea/strategy.service.ts` <!-- severity: medium -->
- [ ] **TEST-003-L13**: Add tests for `idea/research.service.ts` <!-- severity: medium -->
- [ ] **TEST-003-L14**: Add tests for `idea/product.service.ts` <!-- severity: medium -->
- [ ] **TEST-003-L15**: Add tests for `idea/base.service.ts` <!-- severity: medium -->
- [ ] **TEST-003-L16**: Add tests for `huggingface.service.ts` <!-- severity: medium -->
- [ ] **TEST-003-L17**: Add tests for `embedding.service.ts` <!-- severity: high -->
- [ ] **TEST-003-L18**: Add tests for `copilot.service.ts` <!-- severity: high -->
- [ ] **TEST-003-L19**: Add tests for `context-window.service.ts` <!-- severity: high -->
- [ ] **TEST-003-L20**: Add tests for `context-retrieval.service.ts` <!-- severity: high -->
- [ ] **TEST-003-L21**: Add tests for `brain.service.ts` <!-- severity: high -->
- [ ] **TEST-003-L22**: Add tests for `agent.service.ts` <!-- severity: high -->
- [ ] **TEST-003-L23**: Add tests for `advanced-memory.service.ts` <!-- severity: high -->

### TEST-004: Missing Test Files - Project Services (6 untested)
- [ ] **TEST-004-P1**: Add tests for `terminal.service.ts` <!-- severity: high -->
- [ ] **TEST-004-P2**: Add tests for `project-scaffold.service.ts` <!-- severity: medium -->
- [ ] **TEST-004-P3**: Add tests for `project-agent.service.ts` <!-- severity: high -->
- [ ] **TEST-004-P4**: Add tests for `git.service.ts` <!-- severity: high -->
- [ ] **TEST-004-P5**: Add tests for `docker.service.ts` <!-- severity: medium -->
- [ ] **TEST-004-P6**: Add tests for `code-intelligence.service.ts` <!-- severity: high -->

### TEST-005: Missing Test Files - System Services (9 untested)
- [ ] **TEST-005-S1**: Add tests for `update.service.ts` <!-- severity: high -->
- [ ] **TEST-005-S2**: Add tests for `system.service.ts` <!-- severity: high -->
- [ ] **TEST-005-S3**: Add tests for `process.service.ts` <!-- severity: high -->
- [ ] **TEST-005-S4**: Add tests for `process-manager.service.ts` <!-- severity: high -->
- [ ] **TEST-005-S5**: Add tests for `network.service.ts` <!-- severity: medium -->
- [ ] **TEST-005-S6**: Add tests for `extension-detector.service.ts` <!-- severity: low -->
- [ ] **TEST-005-S7**: Add tests for `event-bus.service.ts` <!-- severity: high -->
- [ ] **TEST-005-S8**: Add tests for `command.service.ts` <!-- severity: high -->
- [ ] **TEST-005-S9**: Expand tests for `settings.service.ts` - incomplete <!-- severity: medium -->

### TEST-006: Missing Test Files - Data Services (5 untested)
- [ ] **TEST-006-D1**: Add tests for `filesystem.service.ts` <!-- severity: high -->
- [ ] **TEST-006-D2**: Add tests for `file.service.ts` <!-- severity: high -->
- [ ] **TEST-006-D3**: Add tests for `db-migration.service.ts` <!-- severity: medium -->
- [ ] **TEST-006-D4**: Add tests for `database-client.service.ts` <!-- severity: high -->
- [ ] **TEST-006-D5**: Add tests for `data.service.ts` <!-- severity: high -->

### TEST-007: Missing Test Files - Security Services (3 untested)
- [ ] **TEST-007-SEC1**: Add tests for `rate-limit.service.ts` <!-- severity: high -->
- [ ] **TEST-007-SEC2**: Add tests for `auth.service.ts` <!-- severity: high -->
- [ ] **TEST-007-SEC3**: Add tests for `auth-api.service.ts` <!-- severity: high -->

### TEST-008: Missing Test Files - Other Services
- [ ] **TEST-008-O1**: Add tests for `proxy-process.service.ts` <!-- severity: medium -->
- [ ] **TEST-008-O2**: Add tests for `proxy-embed.service.ts` <!-- severity: medium -->
- [ ] **TEST-008-O3**: Add tests for `theme.service.ts` <!-- severity: low -->
- [ ] **TEST-008-O4**: Add tests for `screenshot.service.ts` <!-- severity: low -->
- [ ] **TEST-008-O5**: Add tests for `notification.service.ts` <!-- severity: low -->
- [ ] **TEST-008-O6**: Add tests for `clipboard.service.ts` <!-- severity: low -->
- [ ] **TEST-008-O7**: Add tests for `mcp-plugin.service.ts` <!-- severity: medium -->
- [ ] **TEST-008-O8**: Add tests for `migration.service.ts` <!-- severity: medium -->
- [ ] **TEST-008-O9**: Add tests for `image-persistence.service.ts` <!-- severity: low -->
- [ ] **TEST-008-O10**: Add tests for `file-change-tracker.service.ts` <!-- severity: medium -->

### TEST-009: Test Coverage Issues
- [ ] **TEST-009-1**: Un-skip `database.service.test.ts:91` - project archival test <!-- severity: medium -->
- [ ] **TEST-009-2**: Add network timeout error tests to `llm.service.test.ts` <!-- severity: high -->
- [ ] **TEST-009-3**: Add rate limit (429) error tests to `llm.service.test.ts` <!-- severity: high -->
- [ ] **TEST-009-4**: Add server error (5xx) tests to `llm.service.test.ts` <!-- severity: high -->
- [ ] **TEST-009-5**: Add timeout/abort tests to `http.service.test.ts` <!-- severity: medium -->
- [ ] **TEST-009-6**: Add constraint violation tests to `database.service.test.ts` <!-- severity: medium -->
- [ ] **TEST-009-7**: Add connection failure tests to `database.service.test.ts` <!-- severity: high -->
- [ ] **TEST-009-8**: Add transaction rollback tests to `database.service.test.ts` <!-- severity: medium -->
- [ ] **TEST-009-9**: Add query timeout tests to `database.service.test.ts` <!-- severity: medium -->
- [ ] **TEST-009-10**: Add "unhealthy" state test to `health-check.service.test.ts` <!-- severity: low -->
- [ ] **TEST-009-11**: Expand tests for `config.service.test.ts` - only 3 tests <!-- severity: medium -->
- [ ] **TEST-009-12**: Expand tests for `token-estimation.service.test.ts` - missing large token edge cases <!-- severity: medium -->
- [ ] **TEST-009-13**: Expand tests for `settings.service.test.ts` - missing error condition tests <!-- severity: medium -->
- [ ] **TEST-009-14**: Expand tests for `security.service.test.ts` - missing permission tests <!-- severity: high -->

### TEST-010: Test Quality Improvements
- [ ] **TEST-010-1**: Extract fixtures from `backup.service.test.ts:122-125` - hardcoded data <!-- severity: low -->
- [ ] **TEST-010-2**: Extract fixtures from `export.service.test.ts:38-59` <!-- severity: low -->
- [ ] **TEST-010-3**: Extract fixtures from `audit-log.service.test.ts:140-143` <!-- severity: low -->
- [ ] **TEST-010-4**: Extract fixtures from `token-estimation.service.test.ts:57-66` <!-- severity: low -->
- [ ] **TEST-010-5**: Fix meaningless assertion in `health-check.service.test.ts:67` - `expect(true).toBe(true)` <!-- severity: medium -->
- [ ] **TEST-010-6**: Fix async pattern in `backup.service.test.ts:74-78` - use vi.advanceTimersByTimeAsync <!-- severity: low -->
- [ ] **TEST-010-7**: Fix inconsistent timer pattern in `health-check.service.test.ts:53-54` <!-- severity: low -->
- [ ] **TEST-010-8**: Add proper mock cleanup in `settings.service.test.ts:67` - fs mocks not reset <!-- severity: medium -->

### TEST-011: Missing Integration Tests
- [ ] **TEST-011-1**: Add Auth → Project workflow integration test <!-- severity: high -->
- [ ] **TEST-011-2**: Add LLM → Cache interaction integration test <!-- severity: medium -->
- [ ] **TEST-011-3**: Add Database → Backup/Restore round-trip test <!-- severity: medium -->
- [ ] **TEST-011-4**: Add provider rotation integration test <!-- severity: medium -->
- [ ] **TEST-011-5**: Add Chat → Message persistence integration test <!-- severity: high -->
- [ ] **TEST-011-6**: Add Settings → ConfigService integration test <!-- severity: medium -->
- [ ] **TEST-011-7**: Add IPC → Service communication integration test <!-- severity: high -->

### TEST-012: Missing Edge Case Tests
- [ ] **TEST-012-1**: Add rate limiter token bucket reset tests <!-- severity: medium -->
- [ ] **TEST-012-2**: Add cache memory limits/eviction tests <!-- severity: medium -->
- [ ] **TEST-012-3**: Add stream parser malformed chunks tests <!-- severity: medium -->
- [ ] **TEST-012-4**: Add request queue overflow tests <!-- severity: medium -->
- [ ] **TEST-012-5**: Add retry utility exponential backoff reset tests <!-- severity: medium -->
- [ ] **TEST-012-6**: Add concurrent operation tests for database service <!-- severity: high -->
- [ ] **TEST-012-7**: Add file system edge cases (permissions, disk full) tests <!-- severity: medium -->
- [ ] **TEST-012-8**: Add network failure recovery tests for external services <!-- severity: high -->

---

## 🔧 CONFIGURATION

### CONFIG-001: Environment & Config Issues
- [ ] **CONFIG-001-1**: Implement `.env.development`, `.env.production`, `.env.test` separation <!-- severity: medium -->
- [ ] **CONFIG-001-2**: Add config schema/interface in `src/main/services/system/config.service.ts` <!-- severity: medium -->
- [ ] **CONFIG-001-3**: Make environment validation fail app on missing required vars <!-- severity: medium -->
- [ ] **CONFIG-001-4**: Centralize provider env var mappings (avoid duplication in token.service.ts) <!-- severity: medium -->
 
---

## 🔄 CLEANUP & LIFECYCLE

### CLEAN-001: Resource Cleanup Issues
- [ ] **CLEAN-001-1**: Add cleanup to `src/main/services/llm/copilot.service.ts:92` - rateLimitInterval timer <!-- severity: medium -->
- [ ] **CLEAN-001-2**: Add file watcher cleanup in `src/main/services/project/project.service.ts` <!-- severity: medium -->
- [ ] **CLEAN-001-3**: Add cleanup to `src/main/mcp/external-plugin.ts:84-93` - incomplete dispose <!-- severity: medium -->
- [ ] **CLEAN-001-4**: Add orphaned data cleanup for deleted projects/chats in knowledge repo <!-- severity: medium -->
- [ ] **CLEAN-001-5**: Add bounded size to active processes map in command.service.ts <!-- severity: low -->

### CLEAN-002: Memory Leak Prevention
- [ ] **CLEAN-002-1**: Add abort on unmount in FileExplorer directory loads <!-- severity: medium -->
- [ ] **CLEAN-002-2**: Clean up terminal references after component unmount <!-- severity: medium -->
- [ ] **CLEAN-002-3**: Add cleanup to global keyboard shortcut listeners <!-- severity: low -->

---

## 📋 NOTES

### Architecture Decisions Needed
1. Unified config access pattern (ConfigService vs direct env access)
2. Standardized IPC return type contract
3. Error boundary strategy for React components
4. Rate limiting strategy across IPC and API

### Known Technical Debt
- ~700+ TypeScript strict mode warnings to fix
- 85+ services without tests (23% coverage)
- Multiple duplicate IPC handler registrations
- CSP requires `unsafe-eval` for Monaco Editor - needs alternative solution

### Blocked Items
- Database rollback support requires migration refactoring
- Some TODOs depend on quota service implementation

---

*Last updated: Auto-generated from codebase analysis*
*Total items: 330*
