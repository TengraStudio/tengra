# Frontend Rules for Copilot

## React Standards

### Component Structure
- Use functional components with hooks.
- Keep components focused; extract logic into custom hooks.
- Maximum component size: 150 lines.

### State Management
- Use React Context for global state (Auth, Settings, Model).
- Use local `useState` for component-specific state.
- Avoid prop drilling; use context or composition.

### Styling
- Use Vanilla CSS or the project's design tokens.
- Avoid inline styles except for dynamic values.
- Follow the UI/UX guidelines in `docs/UI_UX_GUIDELINES.md`.

## Internationalization (i18n)

- NEVER hardcode user-facing strings.
- Use the `useTranslation` hook: `const { t } = useTranslation()`.
- Add new keys to BOTH `en.ts` and `tr.ts`.

## Performance

- Memoize expensive computations with `useMemo`.
- Wrap event handlers in `useCallback` when passed as props.
- Use `React.lazy` for route-level code splitting.
