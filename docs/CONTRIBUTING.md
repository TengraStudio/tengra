# Contributing to Tengra & Development Guide

Thank you for your interest in contributing to Tengra! This guide provides the necessary information to set up, develop, and test the platform.

To maintain high code quality and safety, we follow strict guidelines.

## 1. 👑 The Master Commandments

> **CRITICAL**: Failure to adhere to these rules will result in immediate session termination. NO EXCEPTIONS.

1.  **NO `console.log`**: Use `appLogger` for all logging. Every log must have a service context.
2.  **STRICT TYPES**: `any` and `unknown` are strictly forbidden. Use explicit interfaces.
3.  **NO SUPPRESSION**: `@ts-ignore` and `eslint-disable` are NOT allowed. Fix the root cause.
4.  **NASA POWER OF TEN**:
    - No recursion.
    - Fixed loop bounds.
    - Short functions (max 150 lines, 60 lines preferred).
    - Check all return values.
5.  **BOY SCOUT RULE**: Mandatory. Leave the code cleaner. Every session MUST fix at least one existing lint warning or type issue.

---

## 2. Environment Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher.
- **Go**: v1.21+ for `cliproxy-embed`.
- **Rust and Cargo**: for native token and model services.
- **Build Tools**: Visual Studio Build Tools (Windows) or GCC/Clang (Linux/macOS).

### Initial Configuration
1. Clone the repository and navigate to the root directory.
2. Run `npm install` to install dependencies.
3. Run `npm run build` for an initial full compilation.
4. Run `npm run dev` to start the application with HMR.

---

## 3. Development Workflow

1.  **Read Docs**: Check `AI_RULES.md` and `TODO.md` before starting.
2.  **Implementation**: Follow the established service patterns (`BaseService`).
3.  **Verification**:
    ```bash
    npm run build
    npm run lint
    npm run type-check
    npm run test
    ```
4.  **Commit**: Use conventional commit messages.

---

## 4. UI/UX Standards

- Use the premium design system (vibrant colors, glassmorphism).
- Mandatory `useMemo` and `useCallback` for computations in React.
- Always implement `dispose()` for resource cleanup.
- Virtualize lists exceeding 50 items.

---

## 5. Localization (i18n)

- Never hardcode user-facing strings.
- Use `t('key')` for translations.
- Update matching section files in `src/renderer/i18n/en/` and `src/renderer/i18n/tr/`.
- Keep language folders synchronized across all sections.

---

## 6. Build and Release Process

1. **TypeScript Compilation**: `tsc` validates types.
2. **Linting**: ESLint checks for rule violations.
3. **Frontend Build**: Vite bundles React code and assets.
4. **Native Compilation**: `scripts/build-native.js` triggers Go and Cargo builds.
5. **Packaging**: Electron Builder packages the app into an executable installer.

---

For more detailed coding standards, see [AI_RULES.md](./AI_RULES.md).
