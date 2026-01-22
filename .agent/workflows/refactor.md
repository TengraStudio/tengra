---
description: Safe multi-file refactoring process
---

# Refactor Workflow

This workflow ensures safe refactoring without breaking existing functionality.

## Pre-Refactor

1. **Identify scope**
   - List all files that will be modified
   - Identify all imports/exports that reference the code
   - Check for tests that cover the code

2. **Run tests**
   // turbo
   ```bash
   npm run test
   ```
   Ensure all tests pass before starting.

## Refactor Steps

3. **Make changes incrementally**
   - Change one file at a time
   - Update imports in dependent files immediately
   - Run type-check after each change

4. **Verify after each change**
   // turbo
   ```bash
   npm run type-check
   ```

5. **Update tests**
   - Modify test files if function signatures change
   - Add new tests for new functionality
   - Remove tests for deleted code

## Post-Refactor

6. **Full verification**
   // turbo
   ```bash
   npm run build && npm run lint && npm run test
   ```

7. **Review changes**
   ```bash
   git diff --stat
   ```
   Verify the scope matches your plan.

## Rollback

If refactoring fails:
```bash
git checkout -- .
```
This reverts all uncommitted changes.
