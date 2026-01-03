# OMNI Project - Comprehensive TODOs

## Recently Completed

- [x] Implement "Login with GitHub" UI button in Settings.
- [x] Connect `AuthService` to frontend UI.
- [x] Add visual indicator for Proxy connection status.
- [x] Implement auto-retry for failed proxy requests. (Enhanced via `undici` agent in `openai.service.ts`)
- [x] Add support for streaming responses from Proxy models.
- [x] Implement "Stop Generation" for Proxy models.
- [x] Persist chat history for Proxy models.
- [x] Add "Regenerate Response" for Proxy models.
- [x] Support image uploads for multimodal Proxy models. (Added `normalizeMessages` and clipboard paste support)
- [x] Implement file attachment parsing for Proxy requests.
- [x] Implement "System Prompt" configuration per chat. (Via Persona/Modes)
- [x] Add temperature slider for Proxy models. (In Settings)
- [x] Add max_tokens slider for Proxy models. (In Settings)
- [x] Implement "Pin Message" feature.
- [x] Add status pill for Ollama/Proxy availability.
- [x] Show model source (local/cloud/proxy) per message.
- [x] Allow per-chat default model selection.
- [x] Add safeguards against prompt injection.
- [x] Implement Connected Applications (MCP) System.
- [x] Add "Kur" (Install) button for MCP Marketplace.
- [x] Implement Configuration UI (Env Vars) for MCP.

## High Priority

- [x] Implement "New Chat" keyboard shortcut (Ctrl+N).
- [x] Add "Open Settings" keyboard shortcut (Ctrl+,).
- [x] Implement search within chat history.
- [x] Add export chat history to JSON/Markdown.
- [x] Import chat history from JSON.
- [x] Add text-to-speech support for responses.
- [x] Add speech-to-text for input.
- [x] Implement context window management (trimming old messages).
- [x] Add support for "Slash Commands" (/help, /clear).
- [x] Add "Star Chat" / Favorites.
- [x] Implement folders for organizing chats.
- [x] Add "Delete All Chats" danger zone button.

## Core Reliability & Updates

- [ ] Implement reliable auto-update mechanism.
- [ ] Add "Check for Updates" button.
- [ ] Implement crash reporting service (Sentry).
- [ ] Add analytics (opt-in) for usage tracking.
- [ ] Support "Fork Chat" to branch a conversation.

## Editor & Rendering

- [x] Add "Copy Code Block" button to code snippets.
- [x] Implement Syntax Highlighting for more languages.
- [x] Add "Render Markdown" toggle.
- [x] Add inline image rendering in Markdown responses.
- [x] Add collapsible blocks for long responses.

## AI & Prompting

- [ ] Implement token usage estimator before sending prompts.
- [ ] Add prompt templates for common tasks.
- [ ] Implement multi-turn system prompts per chat.
- [ ] Add quick-reply buttons for suggested prompts.
- [ ] Enable auto-save drafts in input box.
- [ ] Add per-chat title editing inline.
- [ ] Implement "Archive Chat" and filter view.
- [ ] Add "Duplicate Chat" functionality.
- [ ] Add context-aware autocomplete for prompts.

## UX Improvements

- [ ] Provide keyboard navigation for chat list and messages.
- [ ] Implement message reactions/emojis.
- [ ] Add in-app notifications for long-running tasks.
- [ ] Add upload progress UI for attachments.
- [ ] Provide retry UI for failed uploads/downloads.
- [ ] Add drag-and-drop support for files into chat.
- [ ] Add image thumbnails for attachments.
- [ ] Provide file type badges and sizes in UI.
- [ ] Support multi-file uploads per message.
- [ ] Add per-message timestamps and relative time.
- [ ] Add "jump to latest" button in long chats.
- [ ] Implement infinite scroll/virtualized list for messages.
- [ ] Add "go to first unread" marker.
- [ ] Add search within current chat thread.
- [ ] Provide filter for messages by role/tool.
- [ ] Add message edit-and-resend capability.
- [ ] Provide diff view between original and regenerated responses.
- [ ] Add quick copy for message text.
- [ ] Add quick copy for code blocks only.
- [ ] Add "share chat" export with redaction options.
- [ ] Add feedback thumbs up/down on responses.
- [ ] Capture feedback analytics (opt-in).
- [ ] Add onboarding walkthrough for new users.
- [ ] Provide troubleshooting guide inside app.

## Model Management

- [ ] Add warning banner when offline.
- [ ] Provide UI to manage downloaded local models.
- [ ] Add model size and license info to model picker.
- [ ] Add "favorite models" list.
- [ ] Add "recent models" quick selector.
- [ ] Provide benchmark metrics per model (latency/quality).
- [ ] Add automatic model fallback on failure.
- [ ] Show GPU/CPU usage when running local models.
- [ ] Add notification when model download completes.
- [ ] Support pause/resume for model downloads.
- [ ] Add checksum verification for model downloads.
- [ ] Provide storage quota indicator for models.
- [ ] Implement cleanup for unused models.
- [ ] Add "pin model" to prevent accidental deletion.
- [ ] Provide UI for updating models to newer versions.
- [ ] Add changelog for model updates.

## Safety & Security

- [ ] Implement profanity/safety filter toggle.
- [ ] Add user-defined content filters.
- [ ] Provide redaction of sensitive data before sending to cloud.
- [ ] Add warnings before sending long text to cloud models.
- [ ] Add per-provider usage dashboards (tokens/cost).
- [ ] Add spending alerts for cloud providers.
- [ ] Provide API key validation UI with test call.
- [ ] Add secure storage for API keys (OS keychain).
- [ ] Add key rotation reminders.
- [ ] Add multi-account/provider profiles.
- [ ] Provide import/export of provider settings.
- [ ] Add audit log for admin (local) actions.
- [ ] Provide session timeout/lock screen option.
- [ ] Add biometric unlock (Windows Hello if available).
- [ ] Add workspace-scoped data directories.
- [ ] Provide encrypted backup of chat data.
- [ ] Implement per-chat encryption keys (optional).
- [ ] Add secure wipe for deleted chats/files.
- [ ] Add option to disable clipboard interactions.

## Local Interaction & MCP Extensions

- [ ] Add permission prompts for file system access.
- [ ] Provide whitelisted directories for file operations.
- [ ] Add warning before executing shell commands.
- [ ] Add allowlist/denylist for shell commands.
- [ ] Add rate limiting for command executions.
- [ ] Provide audit log for executed commands.
- [ ] Add confirmation prompts for remote SSH commands.
- [ ] Add SSH host key verification and trust-on-first-use.
- [ ] Support SSH jump hosts/bastion configuration.
- [ ] Add SSH connection templates and favorites.
- [ ] Add user-defined MCP tool plugins catalog (Partial: Marketplace).
- [ ] Provide safe execution sandbox for plugins.
- [ ] Add versioning for tool definitions and rollback.
- [ ] Add automated contract tests for tools.
- [ ] Add monitoring of tool latency/error rates.
- [ ] Provide tool execution timeout and cancellation.
- [ ] Add concurrency limits for tool execution.
- [ ] Add fallback strategies when tools fail.

## Developer & Integration

- [ ] Add offline mode for local-only operation.
- [ ] Provide cached responses when offline.
- [ ] Add sync/backup of chats to cloud drive (opt-in).
- [ ] Add import/export for settings and chats.
- [ ] Add CLI interface for headless usage.
- [ ] Provide REST/WS API for integrations.
- [ ] Add webhook triggers for chat events.
- [ ] Add VS Code extension mode or bridge.
- [ ] Add browser extension companion for quick prompts.
- [ ] Add mobile companion app plan/design doc.
- [ ] Add kiosk/presentation mode.

## QA & Release

- [ ] Add automated smoke tests pre-release.
- [ ] Add release checklist with signing/AV scan.
- [ ] Add release notes generator.
- [ ] Add user feedback channel inside app.
- [ ] Add error-reporting with opt-in telemetry.
- [ ] Add privacy policy and data handling docs.
- [ ] Add contributor guide with coding standards and testing expectations.
