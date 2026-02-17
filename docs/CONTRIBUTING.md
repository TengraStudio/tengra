# Contributing to Tandem

Thank you for your interest in contributing to Tandem! To maintain high code quality and safety, we follow strict guidelines.

## 👑 The Master Commandments

1.  **NO `console.log`**: Use `appLogger` for all logging.
2.  **STRICT TYPES**: `any` and `unknown` are forbidden. Use explicit interfaces.
3.  **NO SUPPRESSION**: `@ts-ignore` and `eslint-disable` are not allowed. Fix the root cause.
4.  **NASA POWER OF TEN**:
    - No recursion.
    - Fixed loop bounds.
    - Short functions (max 150 lines).
    - Check all return values.
5.  **BOY SCOUT RULE**: Leave the code cleaner. Every PR should fix at least one existing lint warning or type issue.

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
