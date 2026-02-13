# Git Workflow

## Commit Discipline (MANDATORY)

**Every change MUST be committed following these rules:**

1. **TODO Completion Commits**: When a TODO item is finished, commit immediately.
2. **Minor Change Commits**: Every minor change (fix, improvement, refactor) must be committed separately.
3. **Pre-Commit Validation**: Before committing, ALWAYS check for errors.

## Before Committing
```bash
npm run build        # Must pass
npm run lint         # Must pass
npm run type-check   # Must pass
```

**Only commit if ALL checks pass. If any fails, fix errors first.**

## Commit Message Format
```
<type>(<scope>): <description>

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- refactor: Code refactoring
- test: Add tests
- chore: Maintenance
- perf: Performance

Examples:
feat(auth): add multi-account support
fix(chat): resolve message ordering issue
docs(readme): update installation steps
```

## After Making Changes

1. Update `docs/TODO.md`:
   - Mark completed items as `[x]`
   - NEVER delete items
   - **COMMIT IMMEDIATELY** after marking done

2. Update structured changelog:
   - **English First**: Update `docs/changelog/data/changelog.entries.json` first
   - **Translations on Weekends Only**: Locale files (tr, ar, zh, ja) can ONLY be updated on weekends (Saturday-Sunday)
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

## Changelog Rules

- **English First**: ALWAYS write changelog entries in English (`changelog.entries.json`) first.
- **Translations on Weekends**: Locale/translation files can ONLY be updated on weekends (Saturday-Sunday).
- **No Translation Overload**: Do not write translations for every minor change during weekdays.

