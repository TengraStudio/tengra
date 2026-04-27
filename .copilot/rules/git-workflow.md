# Git Workflow Standard

STRICT ADHERENCE MANDATORY.

## 1. Commit Discipline
- **COMMIT IMMEDIATELY**: After EVERY task completion or minor fix.
- **FORMAT**: Conventional Commits only (`type(scope): description`).
- **ATOMICITY**: One logical change per commit.

## 2. Pre-Commit Verification (MANDATORY)
Run these BEFORE committing:
1. `npm run build`
2. `npm run lint`
3. `npm run type-check`
**FAILURE IS UNACCEPTABLE.** Fix errors before committing.

## 3. Changelog & i18n
- **ENGLISH ONLY**: Weekdays are for English updates in `changelog.entries.json`.
- **WEEKEND i18n**: Multi-language updates (tr, ar, etc.) are FORBIDDEN during weekdays. Only Saturday/Sunday.

## 4. Post-Task Workflow
1. Update `TODO.md`: Mark `[x]`. NEVER delete.
2. Update `changelog.entries.json` (English).
3. Run `npm run changelog:sync`.
4. Commit with correct type/scope.
