# Git Workflow

## Before Committing
```bash
npm run build        # Must pass
npm run lint         # Must pass
npm run type-check   # Must pass
```

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

2. Update structured changelog:
   - Update `docs/changelog/data/changelog.entries.json`
   - Update `docs/changelog/i18n/tr.overrides.json` if needed
   - Run `npm run changelog:sync`

3. Commit and push:
   ```bash
   git add .
   git commit -m "type(scope): description"
   git push
   ```

