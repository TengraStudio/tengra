# Chat Hooks Module

This module contains reusable chat-side hooks for state/history/input flows.

## Conventions

- Use `handleError` from `@/utils/error-handler.util` for async failures.
- Avoid direct `console.*` usage in renderer hooks; use `appLogger` from `@/utils/renderer-logger` for context-aware logging.
- Prefer typed IDs (`ChatId`) and guards from `@shared/types/ids` for identifier-heavy flows.

## Main Hooks

- `useChatHistory`: undo/redo state snapshots with bounded history and memory trimming.
- `usePromptManager`: CRUD for prompt templates.
- `useFolderManager`: folder CRUD and local state sync.
- `useSpeechRecognition` / `useVoiceInput`: browser speech API wrappers with guarded error handling.
