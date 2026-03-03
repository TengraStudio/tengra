# TENGRA PROJECT TODO LIST

## 🏛️ Architecture & Refactoring (NASA Power of Ten)
- [x] **SYS-001**: Remove the structured changelog system.
- [ ] **REF-001**: Refactor `src/main/services/project/ssh.service.ts` (1925 lines) into modular services.
- [ ] **REF-002**: Refactor `src/main/ipc/project-agent.ts` (1858 lines) by splitting IPC domains.
- [ ] **REF-003**: Refactor `src/main/services/project/project-agent.service.ts` (1201 lines) into task and council managers.
- [ ] **REF-004**: Implement missing `dispose()` methods in all services (mandatory for native handles).
    - [ ] `SSHService`
    - [ ] `ProjectAgentService`
    - [ ] `SSHTunnelManager`

## 🐛 Existing Code Smells & TODOs
- [x] **BUG-001**: resolve `// TODO: Move to config` in `src/main/services/project/user-collaboration.service.ts:15`.
- [ ] **FEAT-001**: Implement provider health statistics tracked by `TODO-001-6` in `agent-provider-rotation.service.ts`.
- [x] **SAFE-001**: Remove unsafe `@ts-ignore` and `eslint-disable` in `src/main/startup/lifecycle.ts` and `src/main/utils/stream-parser.util.ts`.

## 🧪 Testing & Validation
- [x] **IPC-001**: Register 'model-registry:get-all' and standardize dash-case IPC names.
- [x] **IPC-002**: Fix 'auth:get-linked-accounts' registration mismatch.
- [x] **STB-001**: Fix SettingsProvider crash with optional chaining on language settings.
- [x] **STB-002**: Fix AuthProvider crash by exposing ipcRenderer.on in preload.
- [ ] **TEST-001**: Add unit tests for `SSHTunnelManager` options-based refactor.
- [ ] **TEST-002**: Add integration tests for project agent council IPC handlers with strict types.
- [ ] **TEST-003**: Verify `dispose()` cleanup for all SSH tunnels in integration tests.
