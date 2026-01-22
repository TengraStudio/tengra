---
name: Build and Verify
description: Run build, lint, and type-check before committing code
---

# Build and Verify Skill

This skill ensures code quality before any commit.

## Commands

Execute in order:

```bash
npm run build
```

```bash
npm run lint
```

```bash
npm run type-check
```

## Success Criteria

All three commands must exit with code 0.

## On Failure

1. Read error messages
2. Fix issues in code
3. Re-run from beginning
4. Do NOT commit until all pass
