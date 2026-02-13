# Contributing to Tandem

This guide defines code style, PR flow, and review criteria for consistent contributions.

## Prerequisites

1. Install Node.js and npm versions used by the project.
2. Run `npm install`.
3. Read `docs/DEVELOPMENT.md`, `docs/AI_RULES.md`, and `docs/TESTING_STRATEGY.md`.

## Branching and Commits

1. Create branch from `develop`:
   - `feature/<short-topic>`
   - `fix/<short-topic>`
   - `docs/<short-topic>`
2. Keep commits focused and atomic.
3. Reference task IDs from `docs/TODO.md` in commit messages when applicable.

## Code Style Guidelines

1. Use TypeScript-first patterns and explicit types for public APIs.
2. Naming:
   - `camelCase`: variables/functions
   - `PascalCase`: React components/classes/types
   - `kebab-case`: folder names
3. Prefer small modules and short functions.
4. Use structured logger instead of `console.*` in runtime code.
5. Add JSDoc for exported/public functions and non-obvious logic.

## Local Validation Before PR

Run these before opening a PR:

1. `npm run type-check`
2. `npm run lint`
3. `npm run test:unit`
4. `npm run test:renderer` (if renderer touched)
5. `npm run changelog:sync` (if release notes/changelog changed)

## Pull Request Submission Process

1. Open PR against `develop`.
2. Fill PR template with:
   - Problem statement
   - Scope of changes
   - Test evidence
   - Risk/rollback notes
3. Attach screenshots or short screen capture for UI changes.
4. Keep PR size reviewable; split unrelated work into separate PRs.

## Review Criteria

Reviewers evaluate:

1. Correctness and regression risk
2. Test coverage and validation quality
3. Security implications (IPC validation, secrets, filesystem boundaries)
4. Performance impact (startup, memory, unnecessary re-renders)
5. Documentation impact (`docs/` updates where needed)

## Reporting Bugs

Include:

1. Environment (OS, app version, commit hash if local)
2. Exact reproduction steps
3. Expected vs actual behavior
4. Logs with secrets redacted

## License

By contributing, you agree contributions are licensed under the repository license.
