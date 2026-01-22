---
name: Build and Verify
description: Run build, lint, and type-check before committing code
---

# Build and Verify Skill

This skill ensures code quality before any commit.

## Usage

Run this skill before committing any code changes.

## Commands

Execute these commands in order:

```bash
npm run build
```

If successful, continue:

```bash
npm run lint
```

If successful, continue:

```bash
npm run type-check
```

## Success Criteria

All three commands must exit with code 0.

## On Failure

1. Read the error messages carefully
2. Fix the issues in the code
3. Re-run this skill from the beginning
4. Do NOT commit until all checks pass

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile TypeScript, bundle renderer |
| `npm run lint` | ESLint code analysis |
| `npm run type-check` | TypeScript strict checking |
