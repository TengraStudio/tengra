# Git Workflow Rules for Copilot

## Commit Messages

Follow the Conventional Commits format:
```
type(scope): description
```

### Types
- `feat`: A new feature.
- `fix`: A bug fix.
- `docs`: Documentation changes only.
- `refactor`: Code change that neither fixes nor adds.
- `test`: Adding or correcting tests.
- `chore`: Maintenance, build scripts, CI.
- `perf`: Performance improvement.

### Example
```
feat(token-service): add background refresh for Copilot tokens
```

## Branching

- `main`: Production-ready code.
- `develop`: Integration branch for features.
- `feature/*`: New features.
- `fix/*`: Bug fixes.

## Pre-Commit Checklist

Before committing, you MUST run:
1. `npm run build`
2. `npm run lint`
3. `npm run type-check`

If any of these fail, fix the errors before committing.
