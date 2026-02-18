# Contributing to Tandem

Thank you for your interest in contributing to Tandem! To maintain high code quality and safety, we follow strict guidelines.

## 👑 The Master Commandments
> **CRITICAL**: Failure to adhere to these rules will result in immediate session termination. NO EXCEPTIONS.

1.  **NO `console.log`**: Use `appLogger` for all logging. Every log must have a service context.
2.  **STRICT TYPES**: `any` and `unknown` are strictly forbidden. Use explicit interfaces and types.
3.  **NO SUPPRESSION**: `@ts-ignore` and `eslint-disable` are NOT allowed. Fix the root cause.
4.  **NASA POWER OF TEN**:
    - No recursion.
    - Fixed loop bounds.
    - Short functions (max 60 lines preferred, 150 lines max).
    - Check all return values.
5.  **BOY SCOUT RULE**: Mandatory. Leave the code cleaner. Every session MUST fix at least one existing lint warning or type issue.
6.  **DOCS MIRRORING**: All documentation must be updated in `docs/` and mirrored to `.codex/`.

## 🛠 Development Workflow

1.  **Read Docs**: Check `docs/AI_RULES.md` and `docs/TODO.md` before starting.
2.  **Implementation**: Follow the established service patterns (`BaseService`).
3.  **Verification**:
    ```bash
    npm run build
    npm run lint
    npm run type-check
    ```
4.  **Changelog**: Update `docs/changelog/data/changelog.entries.json` (English first).
5.  **Commit**: Use conventional commit messages.

## 🎨 UI/UX Standards

- Use the premium design system (vibrant colors, glassmorphism).
- Mandatory `useMemo` and `useCallback` for computations/functions in React.
- Always implement `dispose()` for resource cleanup.
- Virtualize lists exceeding 50 items.

## 🌍 Localization (i18n)

- Never hardcode user-facing strings.
- Use `t('key')` for translations.
- Update `en.ts` and `tr.ts` when adding new strings.

---

For more details, see [AI_RULES.md](./AI_RULES.md).
