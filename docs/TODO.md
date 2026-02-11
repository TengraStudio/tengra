# Tandem Project - Task Tracking (Consolidated)

## 🟢 COMPLETED RECENTLY

- [x] **LLM Binary Consolidation**: Standardized `llama-server.exe` location to `resources/bin/` and updated `LlamaService` to use the standardized path.
- [x] **Internationalization (i18n)**: Translated startup messages, error logs, tool definitions, and system prompts from Turkish to English across `LlamaService`, `PerformanceMonitorService`, `ProxyService`, `OllamaStartup`, and `ChatIPC`.
- [x] **Performance Monitor Fixes**: Restored missing resource usage logic and cleanup code in `PerformanceMonitorService`.
- [x] **Workspace Cleanup**: Purged unused binaries (`proxy.exe`, `server.exe`, `orbit-token-service.exe`) and redundant vendor folders (`vendor/cmd`, `vendor/native`, `vendor/package`).
- [x] **Proxy Consolidation**: Standardized binary paths to `resources/bin/` and integrated auto-rebuild logic.
- [x] **Script Consolidation**: Merged `src/scripts/setup-build-env.js` and `scripts/setup-build-env.js` into root `scripts/` folder.
- [x] **Logo Generation Refinement**: Enhanced Logo Generator UI with style/model selection, batch generation, and drag-and-drop support.
- [x] **Go Proxy Resilience**: Fixed proxy crash on startup by making initial auth sync resilient to Electron server delays.
- [x] **Proxy Process Management**: Hardened `taskkill` logic and improved lifecycle sync by removing detached mode in development.
- [x] **Go Proxy Build Fix**: Resolved "declared and not used" Go compiler errors in the embedded proxy.
- [x] **Explorer Polish**: Optimized directory listing speed (parallel stats), combined binary/text reads, fixed stuck loading icons (useCallback + guards).
- [x] **Multi-select Support**: Added Ctrl/Shift/Cmd multi-selection in workspace explorer.
- [x] **Keyboard Shortcuts**: Added F2 (rename), Delete (delete), and Enter (open) support in workspace explorer.
- [x] **DND Activation Constraints**: Added distance (8px) and delay (250ms) constraints (Update 32).
- [x] **Database Stability**: Resolved `ECONNREFUSED` errors by implementing stale port re-discovery and listening for service restarts (Update 31)
- [x] **Chat UI Polish**: Removed message collapsing and improved KaTeX math rendering (Update 30)
- [x] Remove `HistoryImportService` and its associated IPC handlers
- [x] Remove `getAuthFiles` and file-based auth from `ProxyService`
- [x] Update renderer to use `getLinkedAccounts` instead of `checkAuthStatus`
- [x] Fix Statistics Discrepancy & Service Refactor: Integrated and optimized `TimeTrackingService`
- [x] Technical Debt: Hardened type safety in `DatabaseService` and standardized stats interfaces
- [x] Visual Polish: Implemented HSL-based shadow tokens and premium transitions (`DSN-01`)
- [x] Fix token chart data population in Statistics tab
- [x] Add proxy lifecycle management (kill old proxy on startup)
- [x] Remove unnecessary DEBUG logs from Go auth store
- [x] Fix agent plan visibility in UI nodes (auto-expand on waiting_for_approval)
- [x] **Documentation**: Created `docs/components_checklist.md` with a comprehensive list of all React components (330+ files)
- [x] **Git Hygiene**: Added `docs/components_checklist.md` to `.gitignore` to keep it secret/ignored
- [x] **GitHub Actions**: Fixed CI/CD workflows, added cleanup automation
- [x] **Workflow Cleanup Scripts**: Created Node.js and PowerShell scripts for GitHub Actions cleanup

---

## 🤖 AUTONOMOUS AGENT SYSTEM (Project Agent v2)

### 🔄 Phase 1: Checkpoint & Recovery (Priority: HIGH)

- [x] **AGT-CP-00**: Canvas node persistence (save/restore on app restart) <!-- id: agt0 -->
- [x] **AGT-CP-01**: Add checkpoint table to database schema <!-- id: agt1 -->
- [x] **AGT-CP-02**: Create `AgentCheckpointService` for state serialization <!-- id: agt2 -->
- [x] **AGT-CP-03**: Auto-save checkpoint after each step completion <!-- id: agt3 -->
- [x] **AGT-CP-04**: Implement "Resume from checkpoint" UI button <!-- id: agt4 -->
- [x] **AGT-CP-05**: Add rollback functionality (revert to previous checkpoint) <!-- id: agt5 -->
- [x] **AGT-CP-06**: Plan versioning (track plan modifications) <!-- id: agt6 -->

### ⚡ Phase 2: Parallel Task Execution (Priority: HIGH)

- [ ] **AGT-PAR-01**: Refactor `ProjectAgentService` to support multiple concurrent tasks <!-- id: agt7 -->
- [ ] **AGT-PAR-02**: Add task queue with priority levels <!-- id: agt8 -->
- [ ] **AGT-PAR-03**: Implement node dependency graph (A → B means B waits for A) <!-- id: agt9 -->
- [ ] **AGT-PAR-04**: Add Fork node type (split into parallel branches) <!-- id: agt10 -->
- [ ] **AGT-PAR-05**: Add Join node type (wait for all branches) <!-- id: agt11 -->
- [ ] **AGT-PAR-06**: Visual: Show parallel execution lanes in canvas <!-- id: agt12 -->

### 🔗 Phase 3: Git Integration (Priority: HIGH)

- [ ] **AGT-GIT-01**: Auto-create feature branch when plan starts <!-- id: agt13 -->
- [ ] **AGT-GIT-02**: Auto-commit after each successful step <!-- id: agt14 -->
- [ ] **AGT-GIT-03**: Add "Create PR" action node type <!-- id: agt15 -->
- [ ] **AGT-GIT-04**: Implement diff preview before commit <!-- id: agt16 -->
- [ ] **AGT-GIT-05**: Add branch cleanup on plan completion <!-- id: agt17 -->

### 📊 Phase 4: Token & Cost Tracking (Priority: MEDIUM)

- [x] **AGT-TOK-01**: Track token usage per plan/step <!-- id: agt18 -->
- [x] **AGT-TOK-02**: Add cost estimation before plan execution <!-- id: agt19 -->
- [x] **AGT-TOK-03**: Display real-time token counter in node <!-- id: agt20 -->
- [x] **AGT-TOK-04**: Add budget limits (stop if exceeded) <!-- id: agt21 -->
- [x] **AGT-TOK-05**: Show cost breakdown in plan summary <!-- id: agt22 -->

### 🧠 Phase 5: Smart Planning (Priority: MEDIUM)

- [x] **AGT-PLN-01**: Auto-retry failed steps with alternative approach <!-- id: agt23 -->
- [x] **AGT-PLN-02**: Dynamic plan revision (modify plan mid-execution) <!-- id: agt24 -->
- [x] **AGT-PLN-03**: Learn from past plans (success/failure patterns) <!-- id: agt25 -->
- [x] **AGT-PLN-04**: Time estimation per step (timing display) <!-- id: agt26 -->
- [x] **AGT-PLN-05**: Confidence scoring for each step <!-- id: agt27 -->

### 🎨 Phase 6: Visual Enhancements (Priority: MEDIUM)

- [x] **AGT-VIS-01**: Animated data flow between nodes <!-- id: agt28 -->
- [x] **AGT-VIS-02**: Mini-map for large plan graphs <!-- id: agt29 -->
- [x] **AGT-VIS-03**: Real-time log streaming in node terminal <!-- id: agt30 -->
- [x] **AGT-VIS-04**: Drag & drop to reorder plan steps <!-- id: agt31 -->
- [x] **AGT-VIS-05**: Collapsible step groups <!-- id: agt32 -->
- [x] **AGT-VIS-06**: Progress ring around node icon <!-- id: agt33 -->

### 🤝 Phase 7: Multi-Model Collaboration (Priority: LOW)

- [ ] **AGT-COL-01**: Assign different models to different steps <!-- id: agt34 -->
- [ ] **AGT-COL-02**: Model-specific task routing (code→GPT-4, research→Claude) <!-- id: agt35 -->
- [ ] **AGT-COL-03**: Voting mechanism for critical decisions <!-- id: agt36 -->
- [ ] **AGT-COL-04**: Consensus builder for conflicting outputs <!-- id: agt37 -->

### 📝 Phase 8: Templates & Presets (Priority: LOW)

- [ ] **AGT-TPL-01**: Built-in templates (refactor, bug-fix, feature, docs) <!-- id: agt38 -->
- [ ] **AGT-TPL-02**: User-defined template creation <!-- id: agt39 -->
- [ ] **AGT-TPL-03**: Template variables (project name, file paths) <!-- id: agt40 -->
- [ ] **AGT-TPL-04**: Template sharing/export <!-- id: agt41 -->

### 🛡️ Phase 9: Human-in-the-Loop (Priority: LOW)

- [ ] **AGT-HIL-01**: Mark steps as "requires approval" <!-- id: agt42 -->
- [ ] **AGT-HIL-02**: Inline step editing during execution <!-- id: agt43 -->
- [ ] **AGT-HIL-03**: "Skip this step" option <!-- id: agt44 -->
- [ ] **AGT-HIL-04**: Manual intervention points <!-- id: agt45 -->
- [ ] **AGT-HIL-05**: Step-level comments/notes <!-- id: agt46 -->

### 🧪 Phase 10: Testing Integration (Priority: LOW)

- [ ] **AGT-TST-01**: Auto-run tests after code changes <!-- id: agt47 -->
- [ ] **AGT-TST-02**: Test result visualization in node <!-- id: r48 -->
- [ ] **AGT-TST-03**: Fail step if tests fail <!-- id: agt49 -->
- [ ] **AGT-TST-04**: Coverage tracking per plan <!-- id: agt50 -->

## 🛍️ MARKETPLACE SYSTEM (VSCode-style Extensions) (Priority: HIGH)

### 📦 Phase 1: Marketplace Infrastructure

- [ ] **MKT-INFRA-01**: Design marketplace architecture (extension manifest schema, discovery API) <!-- id: mkt1 -->
- [ ] **MKT-INFRA-02**: Create marketplace backend service (extension registry, search, versioning) <!-- id: mkt2 -->
- [ ] **MKT-INFRA-03**: Implement extension loader/unloader with sandboxing <!-- id: mkt3 -->
- [ ] **MKT-INFRA-04**: Add extension lifecycle management (install, update, remove, enable/disable) <!-- id: mkt4 -->
- [ ] **MKT-INFRA-05**: Create extension permission system (file access, network, IPC) <!-- id: mkt5 -->

### 🎨 Phase 2: Marketplace UI

- [ ] **MKT-UI-01**: Design marketplace browser tab (similar to VSCode Extensions) <!-- id: mkt6 -->
- [ ] **MKT-UI-02**: Implement extension card with rating, downloads, description <!-- id: mkt7 -->
- [ ] **MKT-UI-03**: Add search and filter (categories, tags, popularity) <!-- id: mkt8 -->
- [ ] **MKT-UI-04**: Create extension detail view with README, reviews <!-- id: mkt9 -->
- [ ] **MKT-UI-05**: Add installed extensions manager (update, configure, uninstall) <!-- id: mkt10 -->

### 🔌 Phase 3: Extension Types

- [ ] **MKT-EXT-01**: MCP Server Extensions (custom AI tools/plugins) <!-- id: mkt11 -->
- [ ] **MKT-EXT-02**: Theme Extensions (custom color schemes, UI themes) <!-- id: mkt12 -->
- [ ] **MKT-EXT-03**: Command Extensions (custom slash commands) <!-- id: mkt13 -->
- [ ] **MKT-EXT-04**: Language Extensions (additional translation packs) <!-- id: mkt14 -->
- [ ] **MKT-EXT-05**: Agent Template Extensions (pre-built agent workflows) <!-- id: mkt15 -->

### 🔐 Phase 4: Security & Quality

- [ ] **MKT-SEC-01**: Extension signing and verification <!-- id: mkt16 -->
- [ ] **MKT-SEC-02**: Sandboxed execution environment for extensions <!-- id: mkt17 -->
- [ ] **MKT-SEC-03**: Code review and malware scanning for published extensions <!-- id: mkt18 -->
- [ ] **MKT-SEC-04**: User reviews and rating system <!-- id: mkt19 -->
- [ ] **MKT-SEC-05**: Extension telemetry and crash reporting <!-- id: mkt20 -->

### 📚 Phase 5: Developer Experience

- [ ] **MKT-DEV-01**: Extension development kit (SDK, templates, CLI tools) <!-- id: mkt21 -->
- [ ] **MKT-DEV-02**: Extension development documentation and guides <!-- id: mkt22 -->
- [ ] **MKT-DEV-04**: Extension publishing workflow (automated builds, versioning) <!-- id: mkt24 -->
- [ ] **MKT-DEV-05**: Extension analytics dashboard for developers <!-- id: mkt25 -->

## 🧠 MEMORY SYSTEM ENHANCEMENTS (Priority: MEDIUM)

### 🌍 Multi-Language Support

- [ ] **MEM-LANG-01**: Extend fact extraction to support non-English languages <!-- id: mem1 -->
  - Current `shouldExtractFacts` only has English patterns
  - Options: Multi-language patterns, LLM detection, hybrid approach
  - See: `src/main/services/llm/advanced-memory.service.ts`
 
## 📋 FULL FILE-BY-FILE AUDIT LIST (Total Checked: 131 Files)

### 📁 src/main/api

1. **api-auth.middleware.ts** *(DELETED — 100% commented-out dead code)*
    - [x] AUDIT: Type Safety (remove potential `any`) <!-- id: a1 -->
    - [x] REFACTOR: Complexity/Length audit <!-- id: a2 -->
    - [x] DOCUMENT: JSDoc for exports/types <!-- id: a3 -->
    - [x] TEST: Unit coverage for auth logic <!-- id: a4 -->
2. **api-router.ts** *(DELETED — 100% commented-out dead code)*
    - [x] AUDIT: Route handler parameter types <!-- id: a5 -->
    - [x] REFACTOR: Break down long route definitions <!-- id: a6 -->
    - [x] DOCUMENT: API endpoint documentation <!-- id: a7 -->
    - [x] TEST: Integration tests for API routes <!-- id: a8 -->
3. **api-server.service.ts**
    - [x] AUDIT: Fastify/Hapi library type safety <!-- id: a9 -->
    - [x] REFACTOR: Lifecycle management (start/stop) <!-- id: a10 -->
    - [x] DOCUMENT: Service initialization documentation <!-- id: a11 -->
    - [x] TEST: Server startup/shutdown tests <!-- id: a12 -->

### 📁 src/main/core

4. **circuit-breaker.ts**
    - [x] AUDIT: State transition types <!-- id: a13 -->
    - [x] REFACTOR: Simplify state machine logic <!-- id: a14 -->
    - [x] DOCUMENT: Failure threshold configuration <!-- id: a15 -->
    - [x] TEST: Resilience matching scenarios <!-- id: a16 -->
5. **container.ts**
    - [x] AUDIT: Dependency injection type safety <!-- id: a17 -->
    - [x] REFACTOR: Avoid circular dependency patterns <!-- id: a18 -->
    - [x] DOCUMENT: Module registration patterns <!-- id: a19 -->
    - [x] TEST: Mock injection tests <!-- id: a20 -->
6. **lazy-services.ts**
    - [x] AUDIT: Proxy object type safety <!-- id: a21 -->
    - [x] REFACTOR: Performance audit of initial access <!-- id: a22 -->
    - [x] DOCUMENT: Lazy loading patterns <!-- id: a23 -->
    - [x] TEST: Service instantiation timing tests <!-- id: a24 -->
7. **repository.interface.ts**
    - [x] AUDIT: Generic type constraints <!-- id: a25 -->
    - [x] REFACTOR: standard paging/sorting types <!-- id: a26 -->
    - [x] DOCUMENT: Repository pattern usage guide <!-- id: a27 -->
    - [x] TEST: Interface compliance audit <!-- id: a28 -->
8. **service-registry.ts**
    - [x] AUDIT: Service identification types <!-- id: a29 -->
    - [x] REFACTOR: Dynamic registry cleanup logic <!-- id: a30 -->
    - [x] DOCUMENT: Global service access patterns <!-- id: a31 -->
    - [x] TEST: Registration collision tests <!-- id: a32 -->

### 📁 src/main/ipc

9. **advanced-memory.ts**: [x] Audit [x] Refactor [x] Doc [ ] Test <!-- id: a33 -->
10. **agent.ts**: [x] Audit [x] Refactor [x] Doc [ ] Test <!-- id: a37 -->
11. **audit.ts**: [x] Audit [ ] Refactor [x] Doc [ ] Test <!-- id: a41 -->
12. **auth.ts**: [x] Audit [ ] Refactor [x] Doc [ ] Test <!-- id: a45 -->
13. **backup.ts**: [x] Audit [ ] Refactor [x] Doc [ ] Test <!-- id: a49 -->
14. **brain.ts**: [x] Audit [x] Refactor [x] Doc [ ] Test <!-- id: a53 -->
15. **chat.ts**: [x] Audit [ ] Refactor [x] Doc [ ] Test <!-- id: a57 -->
16. **code-intelligence.ts**: [x] Audit [x] Refactor [x] Doc [ ] Test <!-- id: a61 -->
17. **collaboration.ts**: [x] Audit [ ] Refactor [x] Doc [ ] Test <!-- id: a65 -->
18. **db.ts**: [x] Audit [ ] Refactor [x] Doc [ ] Test <!-- id: a69 -->
19. **dialog.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a73 -->
20. **export.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a77 -->
21. **extension.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a81 -->
22. **file-diff.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a85 -->
23. **files.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a89 -->
24. **gallery.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a93 -->
25. **git.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a97 -->
26. **health.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a101 -->
27. **history.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a105 -->
28. **huggingface.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a109 -->
29. **idea-generator.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a113 -->
30. **index.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a117 -->
31. **key-rotation.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a121 -->
32. **llama.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a125 -->
33. **logging.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a129 -->
34. **mcp.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a133 -->
35. **memory.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a137 -->
36. **metrics.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a141 -->
37. **migration.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a145 -->
38. **model-registry.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a149 -->
39. **multi-model.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a153 -->
40. **ollama.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a157 -->
41. **orchestrator.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a161 -->
42. **performance.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a165 -->
43. **process.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a169 -->
44. **project-agent.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a173 -->
45. **project.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a177 -->
46. **prompt-templates.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a181 -->
47. **proxy-embed.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a185 -->
48. **proxy.ts**: [x] Audit [x] Refactor [ ] Doc [ ] Test <!-- id: a189 -->
49. **screenshot.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a193 -->
50. **settings.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a197 -->
51. **system.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a201 -->
52. **telemetry.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a205 -->
53. **terminal.ts**: [x] Audit [x] Refactor [x] Doc [x] Test <!-- id: a209 -->
54. **theme.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a213 -->
55. **token.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a217 -->
56. **translations.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a221 -->
57. **update.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a225 -->
58. **user.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a229 -->
59. **vector-db.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a233 -->
60. **window.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: a237 -->

### 📁 src/main/services

61. **audit-log.service.ts**: [x] Type Audit [ ] Doc [ ] Test <!-- id: s61 -->
62. **backup.service.ts**: [x] Type Audit [ ] Doc [ ] Test <!-- id: s62 -->
63. **base.service.ts**: [x] Type Audit [ ] Doc [ ] Test <!-- id: s63 -->
64. **config.service.ts**: [x] Type Audit [ ] Doc [ ] Test <!-- id: s64 -->
65. **data-service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s65 -->
66. **data/chat-event.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s66 -->
67. **data/database.service.ts**: [x] Type Audit [x] Refactor [ ] Doc [ ] Test <!-- id: s67 -->
68. **data/database-migration.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s68 -->
69. **export.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s69 -->
70. **health-check.service.ts**: [x] Type Audit [ ] Doc [ ] Test <!-- id: s70 -->
71. **http.service.ts**: [x] Type Audit [ ] Doc [ ] Test <!-- id: s71 -->
72. **llm/llm.service.ts**: [x] Type Audit [x] Refactor [x] Doc [x] Test <!-- id: s72 -->
73. **llm/model-fallback.service.ts**: [x] Type Audit [ ] Doc [ ] Test <!-- id: s73 -->
74. **llm/model-registry.service.ts**: [ ] Type Audit [ ] Doc [x] Test <!-- id: s74 -->
75. **llm/ollama.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s75 -->
76. **project/agent/agent-persistence.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s76 -->
77. **project/agent/agent-provider-rotation.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s77 -->
78. **project/agent/agent-state-machine.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s78 -->
79. **project/project-agent.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s79 -->
80. **project/project-scaffold.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s80 -->
81. **project/ssh.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s81 -->
82. **project.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s82 -->
83. **proxy/proxy.service.ts**: [x] Type Audit [x] Refactor [x] Doc [x] Test <!-- id: s83 -->
84. **proxy/quota.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s84 -->
85. **security/auth.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s85 -->
86. **security/key-rotation.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s86 -->
87. **security/token.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s87 -->
88. **security.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s88 -->
89. **system/job-scheduler.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s89 -->
90. **system/process.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s90 -->
91. **system/process-manager.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s91 -->
92. **system/security-fixes.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s92 -->
93. **system/settings.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s93 -->
94. **system/system.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s94 -->
95. **token-estimation.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s95 -->
96. **ui/theme.service.ts**: [x] Type Audit [ ] Doc [ ] Test <!-- id: s96 -->
97. **ui/window.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s97 -->
98. **web-bridge.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s98 -->
99. **project/agent/agent-executor.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s99 -->
100.    **project/agent/agent-planner.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s100 -->
101.    **project/agent/agent-verifier.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s101 -->
102.    **project/agent/agent-logger.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s102 -->
103.    **project/agent/agent-history.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s103 -->
104.    **project/agent/agent-token.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s104 -->
105.    **project/agent/agent-cache.service.ts**: [ ] Type Audit [ ] Doc [ ] Test <!-- id: s105 -->

### 📁 src/main/utils

106. **cache.util.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: u106 -->
107. **config-validator.util.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: u110 -->
108. **event-bus.util.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: u114 -->
109. **ipc-batch.util.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: u118 -->
110. **ipc-wrapper.util.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: u122 -->
111. **local-auth-server.util.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: u126 -->
112. **logger.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: u130 -->
113. **message-normalizer.util.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: u134 -->
114. **rate-limiter.util.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: u138 -->
115. **request-queue.util.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: u142 -->
116. **response-normalizer.util.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: u146 -->
117. **retry.util.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: u150 -->
118. **stream-parser.util.ts**: [ ] Audit [ ] Refactor [ ] Doc [ ] Test <!-- id: u154 -->

### 📁 src/renderer/components

119. **ChatBubble.tsx**: [x] Memoization [ ] A11y [ ] Doc [ ] Test <!-- id: r119 -->
120. **ChatMessage.tsx**: [x] Memoization [ ] A11y [ ] Doc [ ] Test <!-- id: r123 -->
121. **ChatInput.tsx**: [x] Memoization [ ] A11y [ ] Doc [ ] Test <!-- id: r127 -->
122. **ProjectCard.tsx**: [x] Memoization [ ] A11y [ ] Doc [ ] Test <!-- id: r131 -->
123. **SettingsPanel.tsx**: [ ] Memoization [ ] A11y [ ] Doc [ ] Test <!-- id: r135 -->
124. **IdeaCard.tsx**: [x] Memoization [ ] A11y [ ] Doc [ ] Test <!-- id: r139 -->
125. **MemoryItem.tsx**: [ ] Memoization [ ] A11y [ ] Doc [ ] Test <!-- id: r143 -->
126. **Sidebar.tsx**: [x] Memoization [ ] A11y [ ] Doc [ ] Test <!-- id: r147 -->
127. **Navbar.tsx**: [ ] Memoization [ ] A11y [ ] Doc [ ] Test <!-- id: r151 -->
128. **Modal.tsx**: [ ] Memoization [ ] A11y [ ] Doc [ ] Test <!-- id: r155 -->
129. **Button.tsx**: [ ] Memoization [ ] A11y [ ] Doc [ ] Test <!-- id: r159 -->
130. **Input.tsx**: [ ] Memoization [ ] A11y [ ] Doc [ ] Test <!-- id: r163 -->
131. **Card.tsx**: [ ] Memoization [ ] A11y [ ] Doc [ ] Test <!-- id: r167 -->

---

**Total Tasks Identified:** 542
**Audit Baseline:** 2026-02-04
**Last updated:** 2026-02-11 00:45 (LLM & Localization)
