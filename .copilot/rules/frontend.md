# Frontend Development Standard

STRICT ADHERENCE MANDATORY. Deviations will be rejected.

## 1. Typography & Styling (STRICT)
- **STRICTLY FORBIDDEN**: 
    - Ad-hoc sizes: `text-[10px]`, `text-[11px]`, etc.
    - Custom tracking: `tracking-[...]`
    - Styles: `italic`, `font-black`.
- **MANDATORY**: 
    - Use Semantic Classes: `.typo-overline`, `.typo-caption`, `.typo-body-sm`.
    - Use Tokens: `text-sm`, `tracking-tight`, `tracking-16`.
- **Theme Consistency**: Colors MUST come from `hsl(var(--...))` tokens. NO hardcoded HEX/RGB.

## 2. i18n - Internationalization
- **NEVER** hardcode user-facing strings.
- **MANDATORY**: Use `t('key')` from `useTranslation`.
- Add new keys to BOTH `en.ts` and `tr.ts`.

## 3. Component Architecture
- **Structure**: Functional components only. Use `React.FC`.
- **Props**: Explicitly typed interfaces.
- **Imports**: Use path aliases (`@/...`).
- **Cleanliness**: Max 100 lines per component file.
- Keep components focused; extract logic into custom hooks.

## 4. UI Library
- Use **Tabler Icons** (`@tabler/icons-react`).
- NEVER use emojis in code or UI.

## 5. Performance
- Memoize expensive computations with `useMemo`.
- Wrap event handlers in `useCallback` when passed as props.
- Use `React.lazy` for route-level code splitting.
- Use `memo()` for expensive render branches.
- Virtualize lists > 50 items.

## 6. Cross-Platform
- Code MUST be platform-agnostic. 
- Use portable paths.
- Avoid OS-specific file paths, separators, shell syntax, fonts, and process assumptions without an abstraction or fallback.

## Performance

- Memoize expensive computations with `useMemo`.
- Wrap event handlers in `useCallback` when passed as props.
- Use `React.lazy` for route-level code splitting.
