---
trigger: always_on
---

# 🛸 ADVANCED AGENT HARDENING RULES

> **CRITICAL**: These rules were established to prevent agents from ignoring core logic. Failure to adhere to these specific architectural hardening rules will result in **immediate disqualification**.

## 1. 🛡️ STRICT IPC CONTRACTS (ZOD FIRST)

Ignorance of the contract is the prime cause of system instability.

- **RULE**: Every `ipcMain.handle` registered via `createValidatedIpcHandler` MUST define BOTH `argsSchema` AND `responseSchema`.
- **REASON**: Prevents "Typed IPC" mismatches and ensures the renderer never receives unvalidated data that could cause UI crashes.
- **ENFORCEMENT**: If you add a new IPC channel without a `responseSchema`, your commit WILL be rejected.

## 2. 🧬 SCHEMA PARITY (SINGLE SOURCE OF TRUTH)

- **RULE**: All Zod schemas used for IPC, settings, or project configuration MUST be defined in `src/shared/schemas/`.
- **REASON**: Enforces identical validation logic between the Main process (for safety) and Renderer process (for UI feedback).
- **ENFORCEMENT**: Never define a schema locally in a component if it's mirrored in a service. Use the `@shared/` alias.

## 3. 📦 STORE ISOLATION

- **RULE**: React `useState` is forbidden for shared application state. Use `store.ts` patterns with `useSyncExternalStore`.
- **REASON**: React context/state is for UI "transient" state (e.g. `isDropdownOpen`). Application state (e.g. `activeProject`, `userSettings`) must be external, testable, and persistent.
- **ENFORCEMENT**: Shared state found in `useState` will be marked as technical debt.

## 4. 🧹 MANDATORY DISPOSAL

- **RULE**: Any service implementing `initialize()` MUST implement `dispose()`.
- **REASON**: We use native handles (PTY, PGlite, Watchers). Failure to dispose results in "Zombie Processes" and memory leaks.
- **ENFORCEMENT**: Check for open file handles or dangling promises in tests.

## 5. ⚡ IPC BATCHING (THROTTLE)

- **RULE**: High-frequency streaming events (Log updates, Progress bars, Terminal data) MUST be throttled/batched.
- **REASON**: Flooding the IPC bridge (> 30 msgs/sec) freezes the UI thread.
- **ENFORCEMENT**: Combine updates in the Main process and emit at a maximum frequency of 20Hz (every 50ms).

## ⚠️ THE AGENT "AWARENESS" PLEDGE

By proceeding with the task, the Agent acknowledges:
1. I have read the rules and they are active in my context.
2. I will NOT skip build or lint checks.
3. I will NOT use `any` as a "shortcut".
4. I will NOT "forget" to update the changelog.

> "Code like it's a satellite. You can't reach out and fix it once it's launched."
