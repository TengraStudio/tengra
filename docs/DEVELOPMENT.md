# Development & Contributor Guide

Welcome to the Orbit development guide. This document covers everything you need to know to contribute to the project, from setting up your environment to following our coding standards.

---

## 1. Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Git

### Installation
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start the application in development mode.

### Build Commands
- `npm run build`: Build for production.
- `npm run build:check`: Run TypeScript compilation check.
- `npm run lint`: Run ESLint.

---

## 2. Coding Standards

We follow strict TypeScript and React best practices to ensure code quality and maintainability.

### General Rules
- **No `any`**: Use proper types or `unknown` with type guards.
- **Functional Components**: Use React functional components with hooks.
- **Path Aliases**: Use `@/` for `src/` imports.
- **Error Handling**: Use `try/catch` blocks for asynchronous operations and provide meaningful error messages.

### Naming Conventions
- **Files**: `PascalCase` for components, `kebab-case` for utilities and hooks.
- **Variables/Functions**: `camelCase`.
- **Interfaces/Types**: `PascalCase`.

### CSS & Styling
- Use **Tailwind CSS** for styling.
- Follow the established design system tokens (colors, spacing).
- Ensure responsiveness across all screen sizes.

---

## 3. Testing

### Run Tests
- `npm test`: Run all tests.
- `npm run test:watch`: Run tests in watch mode.
- `npm run test:coverage`: Run tests and generate coverage report.

### Writing Tests
- Place test files in the `tests/` directory (mapped to `src/` structure).
- Use **Vitest** for unit and integration tests.
- Mock external services and IPC calls using provided utilities.
- Target at least 80% coverage for new features.

---

## 4. Security

- **Secrets**: Never commit API keys or sensitive information. Use `.env` files for local configuration.
- **IPC Safety**: Only expose necessary methods through the IPC bridge.
- **Input Validation**: Sanitize all user input before processing or storing.

---

## 5. Contributing Process

1. **Fork** the repository.
2. **Create a branch** for your feature or bugfix (`feature/my-feature` or `fix/my-bug`).
3. **Write tests** for your changes.
4. **Ensure linting passes**.
5. **Submit a Pull Request** with a detailed description of your changes.

---

## 6. Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please be respectful and professional in all interactions.
