# TENGRA PROJECT TODO LIST

## 🏛️ Architecture & Refactoring (NASA Power of Ten)
- [x] **SYS-001**: Remove the structured changelog system.
- [ ] **REF-001**: Refactor `src/main/services/project/ssh.service.ts` (1925 lines) into modular services.
- [x] **REF-002**: Refactor `src/main/ipc/project-agent.ts` (1858 lines) by splitting IPC domains.
- [x] **REF-003**: Refactor `src/main/services/project/project-agent.service.ts` (1201 lines) into task and council managers.
- [x] **REF-004**: Implement missing `dispose()` methods in all services (mandatory for native handles).
    - [x] `SSHService`
    - [x] `ProjectAgentService`
    - [x] `SSHTunnelManager`

## 🐛 Existing Code Smells & TODOs
- [x] **BUG-001**: resolve `// TODO: Move to config` in `src/main/services/project/user-collaboration.service.ts:15`.
- [x] **FEAT-001**: Implement provider health statistics tracked by `TODO-001-6` in `agent-provider-rotation.service.ts`.
- [x] **SAFE-001**: Remove unsafe `@ts-ignore` and `eslint-disable` in `src/main/startup/lifecycle.ts` and `src/main/utils/stream-parser.util.ts`.

## 🧪 Testing & Validation
- [x] **IPC-001**: Register 'model-registry:get-all' and standardize dash-case IPC names.
- [x] **IPC-002**: Fix 'auth:get-linked-accounts' registration mismatch.
- [x] **STB-001**: Fix SettingsProvider crash with optional chaining on language settings.
- [x] **STB-002**: Fix AuthProvider crash by exposing ipcRenderer.on in preload.
- [x] **TEST-001**: Add unit tests for `SSHTunnelManager` options-based refactor.
- [x] **TEST-002**: Add integration tests for project agent council IPC handlers with strict types.
- [x] **TEST-003**: Verify `dispose()` cleanup for all SSH tunnels in integration tests.

## 🚨 Build & Test Stability
- [ ] **SAFE-002**: Fix the `AppSettings` type mismatch in `src/renderer/features/settings/components/DeveloperTab.tsx` and `src/renderer/store/settings.store.ts` that currently breaks `npm run build` / `npm run type-check`.
- [ ] **TEST-004**: Restore the missing `afterEach` import/setup in `src/tests/main/ipc/logging.integration.test.ts` so the test suite type-checks again.

## 🔭 Newly Identified Refactors
- [ ] **REF-005**: Refactor `src/main/services/llm/idea-generator.service.ts` (2423 lines) into smaller generator, validation, and persistence modules.
- [ ] **REF-006**: Refactor `src/main/services/llm/advanced-memory.service.ts` (2151 lines) into focused indexing, retrieval, and maintenance services.
- [ ] **REF-007**: Refactor `src/main/services/project/agent/agent-task-executor.ts` (2142 lines) into bounded execution-stage modules.
- [ ] **REF-008**: Rename "Project" to "Workspace" across all frontend
- [x] **REF-009**: Rename "Project Agent" to "Automation Workflow" (or similar) in frontend features to separate UI concerns from backend agent logic.
