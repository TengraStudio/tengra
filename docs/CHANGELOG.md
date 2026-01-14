# Changelog & Updates

Track the evolution of Orbit.

---

## Recent Updates

### 2026-01-15: Security & Fixes
- **Security Check**: Fixed critical path traversal and shell injection vulnerabilities in `SSHService`.
- **Memory Leak**: Fixed memory leak in `TokenService` by implementing proper interval cleanup.
- **Secrets Management**: Removed hardcoded credentials and migrated vendor secrets (iFlow, Qwen, Codex, Claude, Gemini) to environment variables.
- **XSS Protection**: Enforced `DOMPurify` sanitization for Mermaid diagrams in `MarkdownRenderer` and `MessageBubble`.
- **Injection Prevention**: Hardened `LocalAIService` by removing unnecessary `shell: true`.


### 2026-01-14: Stats & Performance
- **DatabaseService**: Implemented `getDetailedStats` and fixed `getTimeStats` to populate the Statistics tab correctly.
- **DatabaseService**: Replaced `console` calls with `appLogger` and cleaned up relative imports.
- **SettingsService**: Integrated `appLogger`, cleaned up relative imports, and enhanced `JSON.parse` with recovery/error handling.
- **SecurityService**: Integrated `appLogger` and improved error handling for encryption/decryption.
- **IPC**: Hardened `window.ts` by removing dangerous shell execution fallbacks and sanitizing terminal commands.
- **Imports**: Completed mass conversion of relative imports to path aliases (`@main`, `@renderer`, `@shared`) across the entire codebase (37+ files).
- **Renderer**: Fixed UI regressions and corrupted imports in `AgentDashboard.tsx` and `AgentChatRoom.tsx`.
- **Main**: Resolved parsing errors in `command.service.ts` and `git.service.ts`.
- **Cleanup**: Removed several unused imports and unused variables identified during the cleanup process.
- **Security**: Hardened `window` IPC handlers (sanitized shell commands and removed unsafe exec fallback).
- **Async**: Converted synchronous file operations to asynchronous in `QuotaService` and `TokenService`.
- **Chat**: Resolved "placeholder ghosting" when API generation fails.
- Replaced silent error catches and console calls with `appLogger` across core services.
- **Docs**: Consolidated 19 markdown files into 6 themed documents.
- **Audit**: Completed initial small cleanup tasks from `TODO.md`.

### 2026-01-14: Build Improvements
- **Build**: Fixed TypeScript errors related to unused variables and incorrect return types.
- **IPC**: Standardized `onStreamChunk` return types.

---

## Version History

### v1.1.0: Multi-LLM Support
- Added `MultiLLMOrchestrator` for concurrent model execution.
- Introduced Model Collaboration strategies.
- Switched to PGlite for better local performance.

### v1.0.0: Initial Release
- Basic chat functionality with OpenAI and Anthropic.
- Local Ollama support.
- Project management view.
- Theme support (Dark/Light).
