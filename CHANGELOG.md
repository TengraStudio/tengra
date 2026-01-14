# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-01-15

### Fixed
- **Security**: Fixed critical path traversal vulnerability in `SSHService` preventing access to unauthorized files.
- **Security**: Fixed potential shell injection vulnerability in SSH log reading.
- **Security**: Fixed memory leak in `TokenService` by implementing proper interval cleanup.

### Security
- **Secrets**: Removed hardcoded Antigravity client credentials from `QuotaService` and `TokenService`. Migrated all vendor secrets (iFlow, Qwen, Codex, Claude, Gemini) to environment variables.
- **XSS Protection**: Enforced `DOMPurify` sanitization for Mermaid diagrams in `MarkdownRenderer` and `MessageBubble`.
- **Injection Prevention**: Hardened `LocalAIService` by removing unnecessary `shell: true` usage in spawning processes.
