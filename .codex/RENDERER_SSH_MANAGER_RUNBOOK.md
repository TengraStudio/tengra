# Renderer SSH Manager Runbook

## Scope
- UI surface: `src/renderer/features/ssh/SSHManager.tsx`
- Connection state hook: `src/renderer/features/ssh/hooks/useSSHConnections.ts`
- Validation: `src/renderer/features/ssh/utils/ssh-manager-validation.ts`
- Health telemetry: `src/renderer/store/ssh-manager-health.store.ts`

## Health Channels
- `ssh.loadConnections`
- `ssh.connect`
- `ssh.testProfile`
- `ssh.deleteProfile`

## Performance Budgets
- `ssh.loadConnections`: 450ms
- `ssh.connect`: 1600ms
- `ssh.testProfile`: 1200ms
- `ssh.deleteProfile`: 450ms

## Error Codes
- `SSH_MANAGER_VALIDATION_ERROR`
- `SSH_MANAGER_LOAD_FAILED`
- `SSH_MANAGER_CONNECT_FAILED`
- `SSH_MANAGER_TEST_FAILED`
- `SSH_MANAGER_SAVE_PROFILE_FAILED`
- `SSH_MANAGER_DELETE_PROFILE_FAILED`

## Triage Checklist
1. Confirm hook `uiState` and `lastErrorCode` in renderer logs/state.
2. Inspect `ssh-manager-health.store` snapshot for failing channel.
3. Re-run profile test from modal to isolate auth vs transport issues.
4. Verify profile payload validity (host, port, username, password/privateKey).
5. Confirm backend SSH IPC channels respond (`ssh:getProfiles`, `ssh:connect`, `ssh:testProfile`).

## Recovery Actions
1. Retry `loadConnections` from UI refresh path.
2. Recreate profile with explicit auth method.
3. Remove and re-add stale profile if delete path succeeded but UI state is stale.
4. Escalate to main-process SSH service if repeated `SSH_MANAGER_CONNECT_FAILED` persists.
