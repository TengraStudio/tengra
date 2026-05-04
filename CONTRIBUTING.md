# Contributing Guidelines

Thank you for your interest in contributing to Tengra. This document outlines the standards and processes for contributing to the repository.

## 1. Coding Standards

- **TypeScript**: Strict typing is mandatory. Avoid using `any` or `unknown` unless absolutely necessary.
- **Rust**: Follow standard Rust idioms. All new native modules must include unit tests and document their HTTP/IPC interfaces.
- **Complexity**: Keep functions focused and concise (aim for under 60 lines).
- **UI Design**: Adhere to the core aesthetics. Maintain a clean, premium, and minimal interface.
- **Improvement**: Aim to resolve at least one lint or type error in any existing file you modify.

## 2. Internationalization (i18n)

- **Languages**: English (`en`) and Turkish (`tr`) are the primary supported languages.
- **Source of Truth**: `en.locale.json` is the reference for all translation keys.
- **Patterns**: Use interpolation (`t('key', { val })`) and standard pluralization suffixes (`_one`, `_other`).
- **Maintenance**: Regularly audit and prune unused localization keys.

## 3. Pull Request Process

1. **Branching**: Create feature (`feat/*`) or fix (`fix/*`) branches from the main development branch.
2. **Quality Control**: Run `npm run build`, `npm run lint`, and `npm run type-check` before submitting.
3. **Commit Messages**: Follow conventional commit formats (e.g., `feat(ui): add new workspace button`).
4. **Documentation**: Update relevant documentation files (e.g., `DEVELOPMENT.md`, `ARCHITECTURE.md`) to reflect your changes.

Leave the code base in a better state than you found it.
