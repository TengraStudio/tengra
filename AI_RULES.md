# AI Agent Development Guidelines

This document outlines the architectural principles and coding standards for AI agents and contributors working on the Tengra codebase.

## 1. Technical Stack and Architecture

- **Core**: Electron (Main process: Node.js | Renderer process: React 18 + TypeScript).
*   **Styling**: Vanilla CSS and Tailwind CSS. Use predefined design tokens for consistent typography and spacing.
- **Native Services**: High-performance Rust sidecars (`db-service`, `tengra-proxy`) located in `src/native`.
- **IPC**: Typed communication via Zod-validated contracts and domain-specific bridges.

## 2. Directory Structure

The project follows a feature-first and domain-driven organization:

- **src/main/ipc/**: Categorized IPC handlers (ai, chat, workspace, system, data, etc.).
- **src/main/services/**: Core backend logic, grouped by domain (llm, workspace, system, etc.).
- **src/renderer/features/**: Modular UI features containing their own components, hooks, stores, and utils.
- **src/renderer/store/**: Domain-specific state management.
- **src/shared/**: Shared schemas (`src/shared/schemas/`) and TypeScript definitions.
- **src/native/**: Source code for native Rust binaries.
- **src/tests/**: Organized unit, integration, and E2E tests mirroring the source structure.

## 3. Development Principles

- **Function Length**: Keep functions focused and concise (aim for under 60 lines).
- **Type Safety**: Strictly avoid `any`. Use interfaces and Zod schemas for all cross-process and external data.
- **Error Handling**: Always validate return values. Use structured error patterns.
- **Logging**: Use `appLogger` for all system events. Avoid `console.log` in production code.
- **Resource Management**: Services must extend `BaseService` and implement a `dispose()` method for cleanup.

## 4. UI and Design Standards

- **Consistency**: Use semantic classes (`typo-overline`, `typo-caption`) and design tokens (`text-10`, `tracking-tight`).
- **Minimalism**: Maintain a premium, clean interface. Avoid ad-hoc styling chains in JSX.
- **Accessibility**: Ensure all interactive elements have unique IDs and comply with web accessibility guidelines.
- **Testing**: Vitest for unit, Playwright for E2E. Target 60% coverage.
- **Verification**: `npm run build && npm run lint && npm run type-check`.

## 5. HANDOFF FORMAT
- **Action**: What changed.
- **Scope**: Key files affected.
- **Validation**: Build/Lint/Test results.
- **Risks**: Any follow-up items.

"Simple code is reliable code. Less is more."
