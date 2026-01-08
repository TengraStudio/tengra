# Gap Analysis & Missing Features
**Date:** January 7, 2026

## 1. Technical Gaps (Technical Debt)
*Critical engineering items currently missing.*

| Severity | Item | Description |
| :--- | :--- | :--- |
| 🔴 **High** | **Automated Testing** | No comprehensive unit or integration test suite found. Critical for preventing regressions during rapid refactoring. |
| 🔴 **High** | **Auto-Update** | No mechanism to push updates to users. Essential for shipping security fixes and new features. |
| 🟡 **Medium** | **Error Boundaries** | React Error Boundaries need to be more granular to prevent white-screen crashes on component errors. |
| 🟡 **Medium** | **Offline Mode** | AI features fail gracefully, but UI should better handle intermittent internet for SSH/Cloud models. |

## 2. Feature Gaps (Comparison to Market)
*Features present in competitors (Cursor, VS Code) but missing in Orbit.*

-   **Inline Code Completion:** While `Copilot` service exists, a low-latency "ghost text" inline completion experience (like Github Copilot in VS Code) needs refinement in the Monaco Editor implementation.
-   **Git Graph:** No visual graph for Git history, only basic commit generation.
-   **Debugger:** No DAP (Debug Adapter Protocol) implementation to attach to running node processes and debug within Orbit.
-   **Terminal Tabs:** Basic terminal exists, but advanced split-pane and multi-tab terminal management is basic compared to iTerm/Hyper.

## 3. UX/UI Gaps
-   **Onboarding:** A dedicated "Tour" exists in code (`WelcomeScreen`), but a more interactive "First Run Experience" (setup API keys, theme, language) wizard is needed.
-   **Mobile Support:** No mobile layout or responsive considerations for extremely small screens (though mostly a Desktop app).
-   **Keybindings:** While `KeyboardShortcutsModal` exists, a custom keybinding editor (like VS Code's `keybindings.json`) is missing.

## 4. Recommendations
1.  **Prioritize Tests:** Immediately set up a testing framework (e.g., Vitest) and write tests for `database.service` and `ssh.service`.
2.  **Ship Web/PWA:** Consider a web-only build (minus Electron APIs) to easier reach users for "Chat only" mode.
3.  **Enhance Editor:** Invest heavily in the Monaco Editor integration to support LSP (Language Server Protocol) features like "Go to Definition" and "Refactor".
