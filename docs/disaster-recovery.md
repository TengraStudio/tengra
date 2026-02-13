# Disaster Recovery Runbook

## Goals

- Restore app settings and data quickly after corruption or machine loss.
- Keep repeatable, verifiable recovery steps in version control.

## Included Data

- Latest application backup (`backup-*.json` or `backup-*.json.gz`)
- Auto-backup configuration (`backup-config.json`, if available)
- Recovery manifest (`recovery-manifest.json`)

## Create Bundle

Use IPC/API:

- `backup:createDisasterRecoveryBundle(targetDir?)`

This creates a timestamped `dr-bundle-*` folder under:

- default: app data `disaster-recovery/`
- optional: custom `targetDir`

## Restore Bundle

Use IPC/API:

- `backup:restoreDisasterRecoveryBundle(bundlePath)`

The restore process:

1. Finds bundled backup payload.
2. Restores settings/chats/prompts/folders.
3. Restores `backup-config.json` if present.

## Validation

After restore:

1. Run backup verification (`backup:verify`) on the restored backup file.
2. Confirm app boots and chat/project lists load.
3. Confirm auto-backup scheduler status (`backup:getAutoBackupStatus`).

