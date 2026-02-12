# Tandem Project - Open TODOs

Last updated: 2026-02-12

## High Priority Features

### Marketplace System (VSCode-style Extensions)

- [ ] MKT-INFRA-01: Design marketplace architecture (manifest schema, discovery API)
- [ ] MKT-INFRA-02: Create marketplace backend service (registry, search, versioning)
- [ ] MKT-INFRA-03: Implement extension loader/unloader with sandboxing
- [ ] MKT-INFRA-04: Add extension lifecycle management (install/update/remove/enable/disable)
- [ ] MKT-INFRA-05: Create extension permission system (file/network/IPC)
- [ ] MKT-UI-01: Design marketplace browser tab
- [ ] MKT-UI-02: Implement extension card (rating/downloads/description)
- [ ] MKT-UI-03: Add search/filter (categories/tags/popularity)
- [ ] MKT-UI-04: Create extension detail view with README/reviews
- [ ] MKT-UI-05: Add installed extensions manager
- [ ] MKT-EXT-01: MCP Server Extensions
- [ ] MKT-EXT-02: Theme Extensions
- [ ] MKT-EXT-03: Command Extensions
- [ ] MKT-EXT-04: Language Extensions
- [ ] MKT-EXT-05: Agent Template Extensions
- [ ] MKT-SEC-01: Extension signing and verification
- [ ] MKT-SEC-02: Sandboxed execution environment
- [ ] MKT-SEC-03: Malware scanning and code review flow
- [ ] MKT-SEC-04: User reviews and rating system
- [ ] MKT-SEC-05: Extension telemetry and crash reporting
- [ ] MKT-DEV-01: Extension SDK/templates/CLI
- [ ] MKT-DEV-02: Extension developer docs
- [ ] MKT-DEV-04: Extension publishing workflow
- [ ] MKT-DEV-05: Extension analytics dashboard

### Model Marketplace (HuggingFace)

- [ ] MDL-HF-01: Add HuggingFace model scraper
- [ ] MDL-HF-02: Parse GGUF model files from HF Hub
- [ ] MDL-HF-03: Add download manager for HF models
- [ ] MDL-HF-04: Integrate HF models into marketplace UI

## Medium Priority Features

### Changelog System

- [ ] CLG-01: Translate all remaining `items` lines in `de/fr/es/ja/zh/ar` with editorial quality

### Agent System Enhancements

- [ ] AGENT-01: Implement agent:create IPC handler (src/main/ipc/agent.ts:27)
- [ ] AGENT-02: Implement agent:delete IPC handler (src/main/ipc/agent.ts:27)
- [ ] AGENT-03: Persist rotation settings (src/main/services/project/agent/agent-provider-rotation.service.ts:526)

### Terminal Improvements

- [ ] TERM-01: Implement Ghostty socket/IPC input handling (src/main/services/terminal/backends/ghostty.backend.ts:99)
- [ ] TERM-02: Refactor TerminalPanel into smaller modules (src/renderer/features/terminal/TerminalPanel.tsx:1086)

### UI/UX Improvements

- [ ] UI-01: Reimplement keyboard focus in MessageList (src/renderer/features/chat/components/MessageList.tsx:73)
- [ ] UI-02: Split ModelSelectorModal into smaller subcomponents (src/renderer/features/models/components/ModelSelectorModal.tsx:56)
- [ ] UI-03: Implement Command Palette (currently shows "coming soon")
- [ ] UI-04: Implement list view for projects (currently shows "coming soon")
- [ ] UI-05: Implement logs viewer (currently shows "coming soon")

### Image Generation

- [ ] IMG-01: Implement ComfyUI integration (src/main/services/llm/local-image.service.ts:407)

## Low Priority / Future Enhancements

### Test Improvements

- [x] TEST-01: Fix `agent-executor.service.test.ts` expectation mismatch (checkpoint resume)
- [x] TEST-02: Fix `code-intelligence.integration.test.ts` parameter type mismatches
 
## Code Quality Initiatives

### IPC Handler Coverage: 100% (Added missing tests for DB, Project Agent, and fixed Code Intelligence)

## File-by-File Audit (Open)

### src/main/ipc (test gaps)

- [x] Phase 2: Execution
    - [x] Replace `console.*` in `src/main`
        - [x] `src/main/utils` (theme-store, stream-parser, request-queue, event-bus)
        - [x] `src/main/services` (update, process, command, code-intelligence, ollama)
    - [x] Replace `console.*` in `src/renderer`
        - [x] utils (performance, error-handler)
        - [x] features (terminal, ssh, projects, settings)
        - [x] hooks (initialization)
    - [x] Replace `console.*` in `src/shared`
    - [x] Replace `console.*` in `src/tests` (if applicable/desired)
- [x] Phase 3: Verification
    - [x] Run `npm run build`
    - [x] Run `npm run lint`
    - [x] Run `npm run type-check`
- [x] Phase 4: Documentation (In Progress)
- [x] a33: `advanced-memory.ts` test
- [x] a45: `auth.ts` test
- [x] a53: `brain.ts` test
- [x] a61: ipc/code-intelligence.ts
- [x] a69: ipc/db.ts
- [x] a73: `dialog.ts` test
- [x] a81: `extension.ts` test
- [x] a85: `file-diff.ts` test
- [x] a89: `files.ts` test
- [x] a93: `gallery.ts` test
- [x] a97: `git.ts` test
- [x] a113: `idea-generator.ts` test
- [ ] a117: `index.ts` test (N/A - just exports)
- [x] a131: `mcp-marketplace.ts` test
- [x] a133: `mcp.ts` test
- [x] a169: `process.ts` test
- [ ] a173: `project-agent.ts` test
- [x] a185: `proxy-embed.ts` test
- [x] a189: `proxy.ts` test

## IPC Handler Test Coverage Status

**Current Status (as of 2026-02-12):**
- Total IPC handlers: 51 files
- Handlers with tests: 30 files (59%)
- Handlers without tests: 21 files (41%)

**Remaining (no tests yet):**
advanced-memory, auth, brain, code-intelligence, db, dialog, extension, file-diff, files, gallery, git, idea-generator, mcp, mcp-marketplace, process, project-agent, proxy-embed, proxy

**Test Statistics:**
- 852/852 tests passing (100%)
- 86 test files total
- 30 IPC integration test files

## TypeScript Errors in Test Files (2026-02-12)

### src/tests/main/ipc/advanced-memory.integration.test.ts
- [ ] TS6133 (64,48): 'id' is declared but its value is never read
- [ ] TS6133 (116,48): 'id' is declared but its value is never read

### src/tests/main/ipc/code-intelligence.integration.test.ts
- [ ] TS6133 (8,1): 'FileSearchResult' is declared but its value is never read
- [ ] TS2345 (32,54): Argument type mismatch - handler vs listener parameters
- [ ] TS2345 (62,54): 'rootPath' parameter type incompatible (unknown vs string)
- [ ] TS2345 (78,56): 'rootPath' parameter type incompatible (unknown vs string)
- [ ] TS2345 (94,56): 'rootPath' parameter type incompatible (unknown vs string)
- [ ] TS2345 (110,57): 'rootPath' parameter type incompatible (unknown vs string)
- [ ] TS2345 (124,64): 'query' parameter type incompatible (unknown vs string)

### src/tests/main/ipc/idea-generator.integration.test.ts
- [ ] TS2345 (45,54): Argument type mismatch - handler vs listener parameters

### src/tests/main/ipc/ollama.integration.test.ts
- [ ] TS6133 (174,19): 'handler' is declared but its value is never read
- [ ] TS6133 (206,19): 'handler' is declared but its value is never read
- [ ] TS6133 (387,19): 'handler' is declared but its value is never read
- [ ] TS6133 (417,19): 'handler' is declared but its value is never read
- [ ] TS6133 (490,19): 'handler' is declared but its value is never read

### src/tests/main/ipc/prompt-templates.integration.test.ts
- [ ] TS2345 (78,85): Missing PromptTemplate properties (template, variables, createdAt, updatedAt)
- [ ] TS2345 (102,83): Missing PromptTemplate properties (template, variables, createdAt, updatedAt)
- [ ] TS2345 (134,78): Missing PromptTemplate properties (name, template, variables, createdAt, updatedAt)
- [ ] TS2345 (157,76): Missing PromptTemplate properties (template, variables, createdAt, updatedAt)
- [ ] TS2345 (189,81): Missing PromptTemplate properties (template, variables, createdAt, updatedAt)
- [ ] TS2345 (199,81): 'null' not assignable to 'PromptTemplate | undefined'

### src/tests/main/ipc/theme.integration.test.ts
- [ ] TS2552 (217,23): Cannot find name 'ThemeService' - should be 'mockThemeService'
- [ ] TS2345 (308,66): 'undefined' not assignable to 'Promise<CustomTheme>'
- [ ] TS2345 (344,69): 'undefined' not assignable to 'Promise<boolean>'
- [ ] TS2345 (393,63): 'undefined' not assignable to 'Promise<CustomTheme | null>'
- [ ] TS2345 (431,66): 'undefined' not assignable to 'Promise<CustomTheme | null>'

### src/tests/main/ipc/usage.integration.test.ts
- [ ] TS6133 (138,19): 'result' is declared but its value is never read
