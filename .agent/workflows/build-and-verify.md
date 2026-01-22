---
description: Build, lint, and type-check before committing any code changes
---

# Build and Verify Workflow

This workflow ensures code quality before any commit.

## Steps

1. **Build the application**
   ```bash
   npm run build
   ```
   Wait for completion. If errors occur, fix them before proceeding.

2. **Run linter**
   ```bash
   npm run lint
   ```
   Fix any lint errors or warnings.

3. **Run type checker**
   ```bash
   npm run type-check
   ```
   Resolve all TypeScript errors.

4. **Run tests** (optional but recommended)
   ```bash
   npm run test
   ```

5. **Verify success**
   All commands must exit with code 0 before proceeding to commit.

## On Failure

- Do NOT commit code that fails any of these checks
- Fix the issues and re-run the workflow
- Log any violations to `logs/agent-violations.log`
