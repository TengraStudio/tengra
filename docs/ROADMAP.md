# Orbit Strategic Roadmap
**Date:** January 7, 2026
**Focus:** Stability, Expansion, Ecosystem

## 1. Vision
To become the "Operating System for AI Development"—a platform where developers don't just write code, but orchestrate intelligence. Orbit aims to bridge the gap between local development environments, remote servers, and cloud AI models.

## 2. Short-Term Goals (Q1 2026) - "Stabilization"
*Focus on reliability and user trust.*

-   [ ] **Auto-Updater:** Implement `electron-updater` to ensure users act on the latest version seamlessly.
-   [ ] **Crash Reporting:** Integrate Sentry to track and fix main/renderer crashes in the wild.
-   [ ] **Test Coverage:** Establish a Jest/Vitest suite for critical services (`auth`, `ssh`, `database`) to prevent regressions.
-   [ ] **Performance:** Implement lazy-loading for heavy modules (Charts, Monaco Editor) to improve startup time.

## 3. Medium-Term Goals (Q2 2026) - "Expansion"
*Focus on feature depth and developer workflows.*

-   [ ] **Advanced SSH:** Implementation of "One-Click Deploy" for Node/React apps and Nginx configuration wizards.
-   [ ] **Mobile Companion:** A helper mobile app (or PWA) to check server stats and chat with the AI on the go.
-   [ ] **Plugin System:** Expose an API for users to write their own "Orbit Extensions" (JavaScript/WASM).
-   [ ] **Theme Store:** Allow community contributions for UI themes.

## 4. Long-Term Vision (2026+) - "Ecosystem"
*Focus on platform and community.*

-   **Orbit Cloud:** A sync service for user preferences, memory/history, and SSH keys across devices.
-   **AI Marketplace:** A hub to browse and install specialized "Personas" and "Council Members" (pre-prompted agents).
-   **Enterprise Integration:** SSO support and team collaboration features (shared workspaces).

## 5. Success Factors
To achieve this vision, we must:
1.  **Maintain Speed:** The UI must remain snappy despite heavy AI processing.
2.  **Privacy First:** Continue prioritizing local-first data storage (Vector DB) to win developer trust.
3.  **Model Agnostic:** Never lock the user into one AI provider; always support the latest models (e.g., GPT-5, Claude 4) day one.
