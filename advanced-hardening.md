# 🛡️ ADVANCED AGENT HARDENING
> **CRITICAL**: Fail these = termination.

## 1. IPC CONTRACTS
- **RULE**: Every `ipcMain.handle` MUST define `argsSchema` and `responseSchema`.
- **REASON**: Prevents "Typed IPC" mismatches.

## 2. SCHEMA PARITY
- **RULE**: Define all shared Zod schemas in `src/shared/schemas/`.
- **REASON**: Single source of truth for Main and Renderer.

## 3. STORE ISOLATION
- **RULE**: Shared state MUST use `store.ts` patterns. No `useState` for global data.
- **REASON**: Ensures testable, external state management.

## 4. DISPOSAL
- **RULE**: All services MUST implement `dispose()`.
- **REASON**: Clean up native handles, watchers, and memory.

## 5. IPC BATCHING
- **RULE**: Throttle high-frequency updates (Logs/Progress) to max 20Hz (50ms).
- **REASON**: Prevents bridge flooding and UI freezes.

"Code like it's a satellite."
