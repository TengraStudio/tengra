# Orbit Project Updates

## Latest Updates (Current Session)

### Refactoring & Cleanup

- **View Architecture:** Refactored `ViewManager.tsx`, `ProjectWorkspace.tsx`, and related components (`ChatView`, `MessageList`) to align props and fix TypeScript errors.
- **Service Optimization:**
  - Moved `llama-bin` to `vendor/llama-bin` and updated `LlamaService` and `LocalAIService`.
  - Consolidated `cliproxy` dependencies into `vendor/cliproxyapi/cmd/cliproxy-embed`.
  - Removed unused `public` and `resources` directories to declutter the workspace.
- **Code Quality:**
  - Resolved `@apply` CSS linting issues by configuring VS Code settings (`.vscode/settings.json`) and adding `stylelint`.
  - Updated `.gitignore` to correctly exclude the `vendor` directory while allowing documentation.

### Documentation

- **README.md:** Created a comprehensive README detailing project goals, architecture, and usage risks.
- **TODO.md:** Established a structured todo list, including future Nginx configuration for SSH and an AI-driven Logo Generator.
- **UPDATES.md:** Initiated this changelog to track project evolution.

## Application History (Git Log Summary)

- **Fixing Persistent UI Issues:** Addressed layout and scrolling bugs in the code editor and sidebar.
- **Antigravity Image Model Debugging:** Resolved routing errors for custom image generation models.
- **Database Service Fixes:** Corrected FTS5 errors and improved model categorization in the UI.
- **Graceful Shutdown:** Implemented robust shutdown handlers for training processes.
- **Copilot Integration:** Fixed routing for `gpt-5.1-codex` and ensured stable connection to GitHub Copilot services.
- **UI Redesign:** Refreshed the main menu and settings UI with a modern aesthetic.
- **MCP Server Integration:** Added foundation for Model Context Protocol servers.

*See git log for detailed commit history.*
