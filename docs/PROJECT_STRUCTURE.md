# Project Structure

This document provides a guided tour of the Orbit directory hierarchy and explains the conventions used for folder organization.

## 📁 Repository Overview

```text
orbit/
├── .gemini/            # Internal IDE/Assistant configurations
├── brain/              # Task artifacts and implementation plans
├── docs/               # Technical and project documentation
├── resources/          # Static assets and native binaries
├── scripts/            # Build, setup, and maintenance scripts
├── src/                # Primary Source Code
│   ├── main/           # Electron Main Process (Node.js)
│   ├── renderer/       # Electron Renderer Process (React)
│   ├── shared/         # Shared Types and Utilities
│   └── tests/          # Integrated Test Suite
├── vendor/             # Native dependencies (Go Proxy)
└── package.json        # Project metadata and dependencies
```

## 📂 src/main (Backend)
The main process handles system-level logic and orchestrates the service layer.

- **`ipc/`**: Event handlers for communication with the UI.
- **`logging/`**: Structured logger implementation.
- **`services/`**: Domain-driven implementation of application logic.
    - `data/`: Database and persistence.
    - `llm/`: AI Model integrations.
    - `security/`: Authentication and synchronization.
    - `system/`: Core runtime and process management.
- **`startup/`**: Bootstrapping logic and service registration.
- **`utils/`**: Backend-specific utility functions.

## 📂 src/renderer (Frontend)
The renderer process contains the React-based user interface.

- **`components/`**: Atomic, reusable UI components (Buttons, Cards, Inputs).
- **`features/`**: Feature-centric modules containing logic, hooks, and views.
    - `chat/`: Chat room and message handling.
    - `projects/`: Project management and code indexing.
    - `settings/`: Configuration and auth management.
- **`hooks/`**: Global React hooks.
- **`lib/`**: External library configurations (e.g., Lucide icons, Framer Motion).
- **`styles/`**: Global CSS and theme definitions.

## 📂 src/shared
Code that can be safely used in both the Main and Renderer processes.

- **`types/`**: TypeScript interfaces and types.
- **`utils/`**: Pure utility functions (formatting, sanitization, math).

## 📂 src/tests
A centralized testing directory mirroring the `src/` hierarchy.

- **`main/`**: Unit tests for backend services.
- **`renderer/`**: Unit and component tests for the UI.
- **`e2e/`**: Playwright-based end-to-end integration tests.

## 📂 vendor
Binary dependencies and external source trees used during the build process.
- **`cliproxyapi/`**: Source and binaries for the Go-based auth proxy.
- **`llama-bin/`**: Pre-compiled binaries for local model execution.
