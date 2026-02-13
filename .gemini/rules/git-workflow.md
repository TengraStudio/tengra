# Git Workflow Rules for Gemini

## Commit Discipline (MANDATORY)

**Every change MUST be committed following these rules:**

1. **TODO Completion Commits**: When a TODO item is finished, commit immediately.
2. **Minor Change Commits**: Every minor change (fix, improvement, refactor) must be committed separately.
3. **Pre-Commit Validation**: Before committing, ALWAYS check for errors.

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

**Only commit if ALL checks pass. If any fails, fix errors first.**

## Changelog Rules

- **English First**: ALWAYS write changelog entries in English (`changelog.entries.json`) first.
- **Translations on Weekends**: Locale files (tr, ar, zh, ja) can ONLY be updated on weekends (Saturday-Sunday).
- **No Translation Overload**: Do not write translations for every minor change during weekdays.

## After Making Changes

1. Update `docs/TODO.md`:
   - Mark completed items as `[x]`
   - NEVER delete items
   - **COMMIT IMMEDIATELY** after marking done

2. Update structured changelog:
   - **English First**: Update `docs/changelog/data/changelog.entries.json` first
   - **Translations on Weekends Only**: Locale files can ONLY be updated on weekends
   - Run `npm run changelog:sync`

3. Commit and push:
   ```bash
   # Run checks first
   npm run build && npm run lint && npm run type-check
   
   # If all pass, commit
   git add .
   git commit -m "type(scope): description"
   git push
   ```
