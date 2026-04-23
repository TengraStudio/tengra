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
- Do not hardcode renderer colors, shadows, radii, spacing, or layout values in TSX/TS/CSS when a token can be used.
- Add new visual/layout values as CSS custom properties first, then expose them through Tailwind/theme manifests when needed.
- If a new CSS variable affects theming, sync `src/renderer/themes/manifests/*.theme.json` via `npm run themes:sync`.
- Avoid inline styles except for dynamic values.
- Follow the UI/UX guidelines in `docs/UI_UX_GUIDELINES.md`.

## Theme Compatibility

- Renderer visuals must be theme-driven. Prefer `var(--...)`, Tailwind theme classes, or shared theme helpers over literal colors.
- Special surfaces that do not read CSS directly (canvas, Monaco, xterm, SVG/icon libraries, generated HTML) must resolve theme tokens through shared utilities instead of embedding fallback literals.
- New UI should remain compatible with both built-in themes and runtime-installed themes.

## Cross-Platform Compatibility

- Generated code must work on Windows, macOS, and Linux unless the task explicitly targets a single platform.
- Avoid OS-specific file paths, separators, shell syntax, fonts, and process assumptions without an abstraction or fallback.
- Prefer shared Node/Electron APIs, standards-based browser APIs, and repo utilities over platform-specific shortcuts.

## Internationalization (i18n)

- NEVER hardcode user-facing strings.
- Use the `useTranslation` hook: `const { t } = useTranslation()`.
- Add new keys to BOTH `en.ts` and `tr.ts`.

## Performance

- Memoize expensive computations with `useMemo`.
- Wrap event handlers in `useCallback` when passed as props.
- Use `React.lazy` for route-level code splitting.
