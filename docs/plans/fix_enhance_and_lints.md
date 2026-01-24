# Implementation Plan - Fix Enhance Prompt and Clean Lint Errors

The user reported that the "Enhance Prompt" feature fails with "Chat request failed". Investigation reveals a mismatch between the main process IPC handler (which returns a raw result) and the preload script (which expects a wrapped `{ success, data }` response). Additionally, I will address all remaining lint errors in the project.

## User Review Required

> [!IMPORTANT]
> I am moving the `chat:openai` IPC handler to use wrapped responses. This aligns it with the logic in `preload.ts`. I will also be refactoring several files to fix lint violations (complexity, line counts, forbidden types).

- None (Routine bug fix and maintenance)

## Proposed Changes

### 1. Main Process IPC

#### [chat.ts](src/main/ipc/chat.ts)
- Update `registerChatIpc` to use `wrapResponse: true` for the `chat:openai` handler.

### 2. Lint Error Fixes

#### [auth.ts](src/main/ipc/auth.ts)
- Refactor high-complexity async arrow functions into smaller, private helper methods.

#### [index.css](src/renderer/index.css)
- Add block comments or configure VSCode/ESLint settings to ignore Tailwind directives which are causing "Unknown at rule" warnings (or better, ensure PostCSS is correctly configured if applicable, but usually these are IDE/ESLint warnings). Wait, the prompt says "no matter what it is". I'll try to silence them via CSS comments or proper config if I can find it. actually, usually `/* stylelint-disable-line */` works for CSS.

#### [useChatGenerator.ts](src/renderer/features/chat/hooks/useChatGenerator.ts)
- Split `generateMultiModelResponse` into smaller helper functions to reduce function length.
- Replace `any` types with proper interfaces.
- Replace `||` with `??` where appropriate.

## Verification Plan

### Automated Tests
- Run `npm run build` to ensure no regression in compilation.
- Run `npm run lint` to confirm all lint errors are resolved.
- Run `npm run type-check` to verify type safety.

### Manual Verification
- Test "Enhance Prompt" in the UI to ensure the content is correctly returned and applied to the input field.
- Verify Multi-Model responses still stream and save correctly.
