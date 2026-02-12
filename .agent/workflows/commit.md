---
description: Safely commit changes with conventional commit format
---

# Commit Workflow

This workflow ensures consistent and traceable commits.

## Pre-Commit Checks

// turbo-all
1. Run build verification
   ```bash
   npm run build && npm run lint && npm run type-check
   ```

## Commit Steps

2. **Stage changes**
   ```bash
   git add -A
   ```

3. **Create commit message**
   Use Conventional Commits format:
   ```
   type(scope): description
   ```

   Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`

   Example:
   ```bash
   git commit -m "feat(auth): add token refresh for Copilot"
   ```

4. **Update TODO.md**
   If a task was completed, mark it with `[x]` in `docs/TODO.md`.
   NEVER delete completed items.

5. **Update structured changelog**
   - Update `docs/changelog/data/changelog.entries.json`
   - Update `docs/changelog/i18n/tr.overrides.json` if needed
   - Run `npm run changelog:sync`

6. **Push changes**
   ```bash
   git push origin HEAD
   ```

## Commit Message Examples

- `feat(ui): add dark mode toggle`
- `fix(proxy): resolve token sync race condition`
- `docs(readme): update installation instructions`
- `refactor(services): move auth to security domain`
- `test(database): add migration tests`

