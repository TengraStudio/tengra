# Task - Fix Enhance Prompt IPC Mismatch

The `chat:openai` IPC handler returns a raw result, but `preload.ts` expects a wrapped response `{ success: true, data: result }`. This causes "Enhance Prompt" to fail.

## Status: ⏳ Pending

## Objectives
- [ ] Update `src/main/ipc/chat.ts` to enable `wrapResponse: true`.
- [ ] Verify fix in UI.
