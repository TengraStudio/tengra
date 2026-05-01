---
paths:
  - "src/renderer/**/*.tsx"
  - "src/renderer/**/*.ts"
---

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
- **Process**:
    1. Update `en.locale.json`.
    2. Update `tr.locale.json`.
    3. Use key in component.

## 3. Component Architecture
- **Structure**: Functional components only. Use `React.FC`.
- **Props**: Explicitly typed interfaces.
- **Imports**: Use path aliases (`@/...`).
- **Cleanliness**: Max 100 lines per component file. Split if larger.

## 4. UI Library
- Use **Tabler Icons** (`@tabler/icons-react`).
- NEVER use emojis in code or UI.

## 5. Performance
- Use `memo()` for expensive render branches.
- `useCallback` / `useMemo` for stable references.
- Virtualize lists > 50 items.

## 6. Cross-Platform
- Code MUST be platform-agnostic. 
- Use portable paths. 
- NO OS-specific assumptions.
