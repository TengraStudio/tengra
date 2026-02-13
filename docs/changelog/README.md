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
- `npm run changelog:auto:draft -- --from=YYYY-MM-DD --to=YYYY-MM-DD --limit=300`: Generate draft changelog suggestions from git commits (dry-run; no source mutation)
- `npm run changelog:auto:apply -- --from=YYYY-MM-DD --to=YYYY-MM-DD --limit=300`: Apply generated commit draft entries directly into `data/changelog.entries.json` (skips ID collisions)
- `npm run changelog:i18n:report`: Report untranslated/EN-identical content by locale
- `npm run changelog:i18n:gate`: Fail if locale EN-identical metrics exceed thresholds (`docs/changelog/i18n/gate.thresholds.json`)
- `npm run changelog:rss -- --locale=en --limit=50`: Generate RSS feed from structured changelog
- `npm run changelog:rss -- --watchMinutes=30`: Regenerate RSS feed on schedule (every 30 min)
- `npm run changelog:rss:test`: Validate generated RSS output

## Daily Workflow

1. Add or update entries in `docs/changelog/data/changelog.entries.json`
2. Optionally generate a draft from commits via `npm run changelog:auto:draft` and curate it manually
3. Add/update locale text in `docs/changelog/i18n/<locale>.overrides.json`
4. Run `npm run changelog:sync`
5. Review generated output under `docs/changelog/generated/`

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

### Metric Notes (`sameItems`)

- `sameItems` intentionally ignores technical lines that should remain unchanged across locales:
  - code fences and pure code snippets
  - file paths / env keys / markdown structural headers
  - token lists and component/file-name enumerations
- Goal: `sameItems` should represent real untranslated natural-language content, not technical noise.
- If `sameItems` rises unexpectedly, first run `npm run changelog:i18n:report` and inspect whether the increase comes from technical lines or actual prose.

## Legacy Note

- `docs/CHANGELOG.md` is legacy history and should not be used for new updates.
- Keep it only as an archive/reference snapshot.

