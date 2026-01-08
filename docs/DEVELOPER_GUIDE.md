# Developer Guide

## Introduction

Thank you for your interest in contributing to Orbit! This guide will help you understand the codebase, set up your development environment, and follow our coding standards.

## Development Setup

### Prerequisites
*   **Node.js**: Version 18 or higher.
*   **npm**: Version 9 or higher.
*   **Python**: (Optional) Required for some backend tooling if modifying python bridges.
*   **Ollama**: Recommended for testing local model integration.

### Quick Start
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
    This command starts both the React renderer (Vite) and the Electron main process in hot-reload mode.

## Project Structure

The project is structured as a monorepo-style application.

```
src/
├── main/                 # Electron Main Process
│   ├── services/         # Business logic (database, llm, proxy)
│   ├── repositories/     # Data access layer
│   └── index.ts          # Entry point
├── renderer/             # React Frontend
│   ├── components/       # Reusable UI components
│   ├── features/         # Feature-based modules (chat, projects)
│   ├── context/          # React Contexts (Auth, Chat, Model)
│   ├── hooks/            # Shared custom hooks
│   └── App.tsx           # Root component
└── shared/               # Shared types and utilities
```

## Key Technologies

*   **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion (for animations).
*   **Backend**: Electron (main process), SQLite (LanceDB/Turso), Node.js native modules.
*   **Build System**: Vite (for renderer), Electron Builder (for packaging).

## Coding Standards

### TypeScript
*   **Strict Mode**: We use strict TypeScript checks. Avoid specific `any` types unless absolutely necessary.
*   **Interfaces**: Define interfaces for all props and data structures. Prefer `interface` over `type` for object definitions.

### React / Components
*   **Functional Components**: Use functional components with hooks.
*   **Context API**: Use the provided contexts (`useChat`, `useAuth`) instead of prop drilling for global state.
*   **Styling**: Use Tailwind CSS utility classes. Avoid custom CSS files unless for complex animations or overrides.

### State Management
*   **Local State**: Use `useState` for component-local data.
*   **Global State**: Use the designated Context Providers.
*   **Persistence**: Persistent data should be saved to the database via `window.electron.db` calls, not just kept in memory.

### Linting and Formatting
We use ESLint and Prettier. Please ensure your code is linted before submitting a pull request.
```bash
npm run lint
```

## Creating a Pull Request
1.  Create a fresh branch for your feature or fix.
2.  Keep your changes focused on a single task.
3.  Write clear commit messages.
4.  Update documentation if you change how a feature works.
5.  Ensure all tests pass (if applicable).

## Common Tasks

### Adding a New Service
1.  Create the service class in `src/main/services/`.
2.  Register it in the dependency injection container in `src/main/index.ts`.
3.  Add necessary IPC handlers in `src/main/ipc/`.
4.  Expose the API in `preload.ts` and update the `window.electron` type definition.

### Adding a New View
1.  Create the view component in `src/renderer/features/<feature>/`.
2.  Update `ViewManager.tsx` to include the new route.
3.  Add a navigation item in `Sidebar.tsx` or `AppHeader.tsx`.
