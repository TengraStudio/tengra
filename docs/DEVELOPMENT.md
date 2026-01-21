# Development Guide

This guide outlines the environment setup, coding standards, and workflows required for contributing to Orbit. Following these standards ensures the stability, security, and performance of the application.

## 1. Environment Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher.
- **Git**: Latest version.
- **VS Build Tools / GCC**: Required for compiling native Rust and Go components.

### Quick Start
1. `npm install`
2. `npm run build` (Ensures all native binaries are compiled)
3. `npm run dev` (Starts Electron in development mode with HMR)

## 2. Core Development Rules

We adhere to high-integrity software standards, inspired by **NASA's Power of Ten** rules for safety-critical code.

### Mandatory Standards
- **Documentation First**: Read `docs/AI_RULES.md` and `docs/ARCHITECTURE.md` before making architectural changes.
- **No `any` or `unknown` usage**: Always use specific interfaces or types. Use type guards for external data.
- **Build Before Commit**: You MUST run `npm run build` successfully before pushing any changes.
- **Zero Warnings Policy**: New code should not introduce ESLint warnings or TypeScript errors.
- **NASA Rule 2 (Loops)**: All loops must have a fixed upper bound or a clear exit condition to prevent infinite execution.
- **NASA Rule 4 (Function Length)**: Keep functions short (target < 60 lines) and focused on a single responsibility.
- **NASA Rule 8 (Input Validation)**: Always validate parameters at the start of public service methods.

## 3. Architecture & Code Style

- **Domain-Based Services**: Services should be grouped by domain in `src/main/services/` (e.g., `llm/`, `security/`).
- **Path Aliases**:
    - `@main/`: Maps to `src/main/`
    - `@renderer/`: Maps to `src/renderer/`
    - `@shared/`: Maps to `src/shared/`
    - `@/`: Maps to `src/renderer/` (Vite default)
- **Error Handling**: Use the centralized `appLogger` (`this.logError()`) instead of `console.log`.
- **Naming**:
    - `kebab-case.service.ts` for service files.
    - `PascalCase.tsx` for React components.

## 4. Testing Workflow

We use **Vitest** for majority of testing.

- `npm run test`: Runs the full test suite.
- `npm run test:watch`: Runs tests related to changed files.
- `npm run type-check`: Validates TypeScript across all workspaces.

**Requirements**:
- All new services must have a corresponding `.test.ts` file in `src/tests/`.
- Critical business logic (Auth, Sync, Model Orchestration) requires 90%+ branch coverage.

## 5. Build Pipeline

The build process is automated via `scripts/build-native.js` and `vite.config.ts`.
1. **TSC**: Compiles TypeScript.
2. **Lint**: Validates styles and rules.
3. **Vite**: Builds the renderer and preload bundles.
4. **Native Build**: Compiles Rust and Go microservices and copies them to `resources/bin`.
