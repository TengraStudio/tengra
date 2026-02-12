# Structured Changelog

This folder contains the multi-language changelog system.

## Single Source Of Truth

- `docs/changelog/data/changelog.entries.json` is the only canonical source.
- Do not manually edit `docs/changelog/generated/*`.
- Runtime UI reads `src/renderer/data/changelog.index.json` (generated).

## Files

- `data/changelog.entries.json`: Canonical entry data (EN source + metadata)
- `data/entry.schema.json`: Reference schema
- `i18n/locales.json`: Locale registry and markdown title config
- `i18n/<locale>.overrides.json`: Locale-specific overrides by entry id
- `generated/CHANGELOG.<locale>.md`: Generated markdown outputs

## Commands

- `npm run changelog:new -- --date=YYYY-MM-DD --title="..." --summary="..." --items="item 1|item 2"`: Add a new entry and seed locale overrides
- `npm run changelog:build`: Build renderer index + markdown artifacts
- `npm run changelog:validate`: Quality gate (summary/items/locale coverage)
- `npm run changelog:sync`: Build + validate
- `npm run changelog:migrate`: One-time bootstrap from legacy `docs/CHANGELOG.md`
- `npm run changelog:seed:de`: Seed missing German overrides from EN source text
- `npm run changelog:seed:all`: Seed missing overrides for all configured locales
- `npm run changelog:i18n:report`: Report untranslated/EN-identical content by locale
- `npm run changelog:i18n:gate`: Fail if locale EN-identical metrics exceed thresholds (`docs/changelog/i18n/gate.thresholds.json`)

## Daily Workflow

1. Add or update entries in `docs/changelog/data/changelog.entries.json`
2. Add/update locale text in `docs/changelog/i18n/<locale>.overrides.json`
3. Run `npm run changelog:sync`
4. Review generated output under `docs/changelog/generated/`

## Editorial Rules

- `summary`: one sentence, concrete, no filler words
- `items`: actionable bullets, preserve technical identifiers in backticks
- Keep terminology stable across entries (`handler`, `IPC`, `fallback`, etc.)
- Avoid mixing old/new naming for the same feature in one entry

## Localization Policy

- App locales: `en`, `tr`, `de`, `fr`, `es`, `ja`, `zh`, `ar`
- EN is source-of-truth; other locale files must be professionally localized and reviewed.
- Do not ship raw machine output without human editorial pass.
- Use `npm run changelog:i18n:report` and reduce EN-identical counts to near zero before release.
- Release gate uses `npm run changelog:i18n:gate` with threshold baseline. Tighten thresholds as localization quality improves.
- Locale editorial checklist: `docs/changelog/LOCALIZATION_CHECKLIST.md`

## Legacy Note

- `docs/CHANGELOG.md` is legacy history and should not be used for new updates.
- Keep it only as an archive/reference snapshot.

