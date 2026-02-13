# Changelog Guide

This guide explains version history, breaking-change policy, and migration notes.

## Version History

- Canonical source: `docs/changelog/data/changelog.entries.json`
- Generated locale markdown: `docs/changelog/generated/CHANGELOG.<locale>.md`
- Legacy archive: `docs/CHANGELOG.md` (read-only reference)

## Breaking Changes Policy

Mark an entry as breaking when at least one is true:

1. IPC channel signature changes (parameter or return shape).
2. Settings schema changes requiring migration.
3. Removed feature flags, removed commands, or removed config keys.
4. Auth/session behavior changes that may invalidate existing tokens.

When breaking:

1. Add a clear `breaking` note in summary/items.
2. Add explicit "before/after" usage in item bullets.
3. Link the migration section in release notes.

## Migration Guide Rules

Every breaking release must include:

1. Impact scope: who is affected.
2. Required action: exact steps.
3. Rollback path: how to recover safely.
4. Validation checklist: how to confirm success.

## Example Migration Block

```md
### Migration: IPC rename `settings:save` -> `settings:update`
- Impact: renderer integrations using old channel.
- Action: replace invoke channel names and update payload schema.
- Rollback: revert to previous app build and restore settings backup.
- Validation: run smoke tests for settings read/write + restart persistence.
```

## Release Workflow

1. Add/curate entries in `changelog.entries.json`.
2. Update locale override files.
3. Run `npm run changelog:sync`.
4. Review generated markdown + i18n gate output.
5. Publish with migration notes for breaking releases.
