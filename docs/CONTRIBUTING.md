# 🤝 CONTRIBUTING TO TENGRA

## 1. CODE STYLE
- **TypeScript Only**: Strict types, no `any`.
- **NASA Rules**: Short functions (<60 lines), static loops.
- **Clean UI**: Simple designs only. Match core aesthetics.
- **Boy Scout**: Fix one lint/type error in every file you edit.

## 2. I18N & LOCALIZATION
- **Core Languages**: English (`en`) and Turkish (`tr`) only.
- **Keys**: Use `en.locale.json` as the source of truth.
- **Best Practices**:
  - No concatenation. Use `t('key', { val })` interpolation.
  - Plurals: Use `_one`, `_other` suffix pattern.
  - Direction: Use CSS logical properties for RTL support.
- **Maintenance**: Prune unused keys periodically.

## 3. PR PROCESS
1. **Branch**: `feat/*` or `fix/*` from `develop`.
2. **Quality**: `npm run build && npm run lint && npm run type-check`.
3. **Commit**: Conventional commits (`type(scope): message`).
4. **Docs**: Update `TODO.md` and relevant docs in `docs/`.

"Contribute with quality, leave the code better than you found it."
