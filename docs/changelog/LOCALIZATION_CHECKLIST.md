# Changelog Localization Checklist

Use this checklist before marking locale changelog entries complete.

## Terminology

- Keep product nouns and technical terms stable across entries.
- Preserve identifiers as-is: `IPC`, `MCP`, `API`, `CLI`, `LLM`, `JSON`, `TypeScript`.
- Do not translate file paths, command names, or code symbols in backticks.
- Keep model/provider names unchanged unless there is an official localized name.

## Tone And Style

- Prefer concise, release-note style writing.
- Keep `summary` to one direct sentence with concrete outcome.
- Avoid filler marketing phrases and vague claims.
- Keep tense consistent within one entry.

## Technical Tokens

- Do not alter shell snippets, flags, env vars, or IDs.
- Do not localize error codes, metric names, or status constants.
- Preserve list semantics in `items` (`- ` bullets and checkbox markers).
- Keep numeric values, dates, and version strings exact.

## Translation Quality Gates

- `title` must not remain identical to EN unless proper noun only.
- `summary` must not remain identical to EN.
- `items` should minimize EN-identical lines; justify unavoidable ones.
- Run `npm run changelog:i18n:report` and review per-locale counts.
- Run `npm run changelog:i18n:gate` before release tagging.

## Reviewer Pass

- Verify terminology consistency against previous 20 entries in same locale.
- Check readability by a native speaker or editor for that locale.
- Confirm no accidental machine-literal phrasing remains.
