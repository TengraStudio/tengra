# OMNI Project - TODO List

## Completed Tasks (Today)

- [x] **Project Analysis**: Explored codebase and identified key integration points.
- [x] **Proxy Integration**: Implemented `OpenAIService` adapter for `ProxyPal`.
- [x] **Settings UI**: Added "Proxy / Web AI" tab to Settings Modal.
- [x] **Dynamic Models**: Implemented `getModels` to fetch model list from Proxy/Ollama dynamically.
- [x] **Rebranding**:
  - [x] Renamed application to **OMNI**.
  - [x] Designed and implemented new logo.
  - [x] Updated `package.json` metadata.
- [x] **UI Enhancements**:
  - [x] Created custom `TitleBar` with window controls (Minimize, Maximize, Close).
  - [x] Fixed syntax errors in `App.tsx` and `main.ts`.
  - [x] Added drag-region support for the new window frame.
- [x] **Native Copilot Infrastructure**:
  - [x] Created `AuthService` for GitHub Device Flow.
  - [x] Created `CopilotService` for token management.
  - [x] Added IPC handlers for native login.
- [x] **UI Theme & Typography**:
  - [x] Switched primary font to **Plus Jakarta Sans** for a modern look.
  - [x] Implemented **Premium Minimalist Palette (Soft Dark)** in `index.css`.
  - [x] Enhanced **Glassmorphism** effects and subtle animations.
- [x] **General Settings Expansion**:
  - [x] Added **Resolution** selection (HD, Full HD, etc.) to General settings.
  - [x] Added **Font Size** slider with real-time application in the UI.
  - [x] Refined settings layout for better readability and accessibility.
- [x] **Benchmark Script**: Created `benchmark.js` for verifying model connectivity.

## Future Roadmap (200 Items)

### 1. Core Feature Enhancements

1. [ ] Implement "Login with GitHub" UI button in Settings.
2. [ ] Connect `AuthService` to frontend UI.
3. [ ] Add visual indicator for Proxy connection status.
4. [ ] Implement auto-retry for failed proxy requests.
5. [ ] Add support for streaming responses from Proxy models.
6. [ ] Implement "Stop Generation" for Proxy models.
7. [ ] Persist chat history for Proxy models (currently relies on local DB).
8. [ ] Add "Regenerate Response" for Proxy models.
9. [ ] Support image uploads for multimodal Proxy models (GPT-4o, Gemini).
10. [ ] Implement file attachment parsing for Proxy requests.
11. [ ] Add "New Chat" keyboard shortcut (Ctrl+N).
12. [ ] Add "Open Settings" keyboard shortcut (Ctrl+,).
13. [ ] Implement search within chat history.
14. [ ] Add export chat history to JSON/Markdown.
15. [ ] Import chat history from JSON.
16. [ ] Add text-to-speech support for responses.
17. [ ] Add speech-to-text for input.
18. [ ] Implement "System Prompt" configuration per chat.
19. [ ] Add temperature slider for Proxy models.
20. [ ] Add max_tokens slider for Proxy models.
21. [ ] Implement context window management (trimming old messages).
22. [ ] Add support for "Slash Commands" (/help, /clear).
23. [ ] Implement "Pin Message" feature.
24. [ ] Add "Star Chat" / Favorites.
25. [ ] Implement folders for organizing chats.
26. [ ] Add "Delete All Chats" danger zone button.
27. [ ] Implement reliable auto-update mechanism.
28. [ ] Add "Check for Updates" button.
29. [ ] Implement crash reporting service (Sentry).
30. [ ] Add analytics (opt-in) for usage tracking.
31. [ ] Support "Fork Chat" to branch a conversation.
32. [ ] Add "Copy Code Block" button to code snippets.
33. [ ] Implement Syntax Highlighting for more languages.
34. [ ] Add "Render Markdown" toggle.
35. [ ] Support LaTeX rendering for math.
36. [ ] Add "Summarize Chat" feature using AI.
37. [ ] Implement "Auto Title" generation for new chats.
38. [ ] Add support for custom API endpoints (not just OpenAI/Proxy).
39. [ ] Implement "Mock Mode" for testing UI without API.
40. [ ] Add "Debug Mode" to see raw API requests/responses.
41. [ ] Implement local vector database (RAG) for document search.
42. [ ] Add "Ingest Document" feature for RAG.
43. [ ] Support PDF ingestion.
44. [ ] Support DOCX ingestion.
45. [ ] Support TXT/MD ingestion.
46. [ ] Implement "Web Search" capability via browsing agent.
47. [ ] Add "DuckDuckGo" search tool.
48. [ ] Add "Google Search" tool (via API).
49. [ ] Implement "Code Execution" sandbox (containers).
50. [ ] Add Python interpreter support.

### 2. UI/UX Improvements

1. [ ] Redesign Sidebar for better compactness.
2. [ ] Add "Collapse Sidebar" animation.
3. [ ] Implement "Dark/Light" mode toggle based on system.
4. [ ] Add standard "Light Mode" theme (currently only Dark).
5. [ ] Implement "High Contrast" theme.
6. [ ] Add custom accent color picker.
7. [ ] Improve "User Avatar" customization (upload image).
8. [ ] Improve "AI Avatar" customization.
9. [ ] Add "Typewriter Effect" for streaming text.
10. [ ] Improve scroll-to-bottom behavior.
11. [ ] Add "Scroll to Bottom" button when scrolled up.
12. [ ] Implement "Toast Notifications" for errors/success.
13. [ ] Add tooltips to all icon buttons.
14. [ ] Improve accessibility (ARIA labels).
15. [ ] Add keyboard navigation support (Tab ordering).
16. [ ] Implement "Command Palette" (Cmd+K) for quick actions.
17. [ ] Add "About Omni" modal with version info.
18. [ ] Improve modal animations (framer-motion).
19. [ ] Add "Loading Skeletons" for chat history.
20. [ ] Implement "Glassmorphism" effect for TitleBar.
21. [ ] Add window shadow/border for better OS integration.
22. [ ] Improve font rendering (antialiasing settings).
23. [ ] Support custom font selection.
24. [ ] Add "Zoom In/Out" UI controls.
25. [ ] Implement "Full Screen" mode (F11).
26. [ ] Add "Compact Mode" for small screens.
27. [ ] Improve mobile responsiveness (if valid targets).
28. [ ] Add "Markdown Preview" split pane.
29. [ ] Implement "Code Diff" view for code changes.
30. [ ] Add "Line Numbers" to code blocks.
31. [ ] Improve "Settings" organization (tabs/sections).
32. [ ] Add "Reset Settings" button.
33. [ ] Implement "Onboarding Tour" for new users.
34. [ ] Add "What's New" changelog popup.
35. [ ] Improve error message clarity.
36. [ ] Add "Feedback" form.
37. [ ] Implement status bar for background tasks.
38. [ ] Add progress bar for long operations.
39. [ ] Improve drop-zone UI for file uploads.
40. [ ] Add "typing..." indicator enhancement.
41. [ ] Implement "Code Folding" in code blocks.
42. [ ] Add "Word Wrap" toggle for code blocks.
43. [ ] Improve link styling in markdown.
44. [ ] Add "Open Link" confirmation dialog.
45. [ ] Implement "Image Preview" modal.
46. [ ] Add "Download Image" button.
47. [ ] Support drag-and-drop for chat reordering.
48. [ ] Add "Confirmation" dialog for delete actions.
49. [ ] Improve connection error UI states.
50. [ ] Add "Retry" button on failed message bubbles.

### 3. Engineering & Performance

1. [ ] Migrate to latest Electron version.
2. [ ] Update React to v19 (when stable).
3. [ ] Optimize bundle size (code splitting).
4. [ ] Implement lazy loading for Settings modal.
5. [ ] Optimize large chat history rendering (virtualization).
6. [ ] Reduce memory usage of `OpenAIService`.
7. [ ] Implement proper dependency injection container.
8. [ ] Add unit tests for `AuthService`.
9. [ ] Add unit tests for `CopilotService`.
10. [ ] Add unit tests for `SettingsService`.
11. [ ] Add component tests for `ChatPage`.
12. [ ] Add E2E tests for login flow.
13. [ ] Setup CI/CD pipeline (GitHub Actions).
14. [ ] Automate release builds.
15. [ ] Sign application verification (Windows/Mac).
16. [ ] Implement strict TypeScript checks.
17. [ ] Add husky pre-commit hooks.
18. [ ] Lint code with ESLint + Prettier.
19. [ ] Optimize image assets (WebP).
20. [ ] Cache model lists to reduce API calls.
21. [ ] Implement offline mode handling.
22. [ ] optimizing IPC communication overhead.
23. [ ] Add logging rotation (log files).
24. [ ] Implement robust error handling middleware.
25. [ ] Add performance monitoring (FPS stats).
26. [ ] Refactor `App.tsx` into smaller components.
27. [ ] Extract `Sidebar` into dedicated component.
28. [ ] Extract `ChatWindow` into dedicated component.
29. [ ] Move types to shared `types/` directory.
30. [ ] Implement "Repository Pattern" for data access.
31. [ ] Use `tanstack-query` for data fetching.
32. [ ] Replace `useState` with `zustand` for global state.
33. [ ] Implement "Undo/Redo" state management.
34. [ ] Add support for multiple windows.
35. [ ] Implement "Tray Icon" features.
36. [ ] Add "Start at Login" option.
37. [ ] Check for internet connection before requests.
38. [ ] Handle token expiration gracefully (refresh loop).
39. [ ] Encrypt sensitive data in `settings.json`.
40. [ ] Use `keytar` for secure storage (Platform dependant).
41. [ ] Implement "Force Quit" handler.
42. [ ] Optimize startup time.
43. [ ] Add "Safe Mode" launch option.
44. [ ] Implement telemetry for crash analysis.
45. [ ] Add "Report Bug" automated email generation.
46. [ ] Refactor CSS to use CSS Modules or consistency.
47. [ ] Verify Windows 11 Snap Layout support.
48. [ ] Verify macOS specialized window checks.
49. [ ] Verify Linux build compatibility.
50. [ ] Add Dockerfile for development environment.

### 4. Native Copilot & Model Specifics

1. [ ] Implement `Codex` model support specifically.
2. [ ] Add "Code Completion" UI (inline ghost text - ambitious!).
3. [ ] Support "Edit Selection" with Copilot.
4. [ ] Implement "Explain Code" quick action.
5. [ ] Implement "Fix Bug" quick action.
6. [ ] Implement "Generate Tests" quick action.
7. [ ] Support Copilot Workspace features (future).
8. [ ] Support multiple GitHub accounts.
9. [ ] Add "Sign Out" functionality.
10. [ ] Show GitHub organization access status.
11. [ ] Filter Copilot functionality based on plan (Individual vs Business).
12. [ ] Add telemetry opt-out for GitHub Copilot.
13. [ ] Verify TOS compliance checks.
14. [ ] Add support for Copilot Chat in IDE-like view.
15. [ ] Implement "Brush" / "Edit" mode for code.
16. [ ] Support custom instructions for Copilot.
17. [ ] Dashboard for Copilot usage quotas.
18. [ ] Add visual token counter for Copilot requests.
19. [ ] Support other GitHub APIs (Issues, PRs) via context.
20. [ ] Allow creating GitHub Gists from chat code.

### 5. Documentation & Community

1. [ ] Create comprehensive `README.md`.
2. [ ] Create `CONTRIBUTING.md`.
3. [ ] Create `CHANGELOG.md`.
4. [ ] Write developer documentation for architecture.
5. [ ] Document API response formats.
6. [ ] Create user manual (PDF/Web).
7. [ ] Create video tutorials for "Omni" features.
8. [ ] Setup Discord community server.
9. [ ] Setup GitHub Discussions.
10. [ ] Create a landing page for the app.
11. [ ] Add "Sponsor" button.
12. [ ] Document security practices.
13. [ ] Create privacy policy.
14. [ ] Create terms of service.
15. [ ] Add "credits" section for open source libraries.
16. [ ] Design social media assets.
17. [ ] Create press kit (logos, screenshots).
18. [ ] Translating app to Spanish.
19. [ ] Translating app to German.
20. [ ] Translating app to French.
21. [ ] Translating app to Chinese.
22. [ ] Translating app to Japanese.
23. [ ] Implementing i18n infrastructure.
24. [ ] Add ability for community translations.
25. [ ] Create "Plugin System" architecture proposal.
26. [ ] Define "Plugin API".
27. [ ] Create "Theme Store" proposal.
28. [ ] Create "Model Marketplace" concept.
29. [ ] Plan mobile companion app.
30. [ ] Plan web-based version of Omni.
