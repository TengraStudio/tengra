# Renderer Settings Page Runbook

## Scope
- Page: `src/renderer/features/settings/SettingsPage.tsx`
- Logic: `src/renderer/features/settings/hooks/useSettingsLogic.ts`
- Validation: `src/renderer/features/settings/utils/settings-page-validation.ts`
- Health telemetry: `src/renderer/store/settings-page-health.store.ts`

## Health Channels
- `settings.load`
- `settings.save`
- `settings.update`
- `settings.factoryReset`

## Performance Budgets
- `settings.load`: 700ms
- `settings.save`: 1000ms
- `settings.update`: 700ms
- `settings.factoryReset`: 1500ms

## Error Codes
- `SETTINGS_PAGE_VALIDATION_ERROR`
- `SETTINGS_PAGE_LOAD_FAILED`
- `SETTINGS_PAGE_SAVE_FAILED`
- `SETTINGS_PAGE_FACTORY_RESET_FAILED`

## Triage Steps
1. Check `settingsUiState` and `lastErrorCode` from `useSettingsLogic`.
2. Inspect `settings-page-health.store` snapshot channel metrics.
3. Re-run `loadSettings` action and verify payload validation.
4. Verify `window.electron.getSettings/saveSettings` IPC responses.
5. Confirm search query normalization for invalid long search input.

## Recovery
1. Retry load/save operation (bounded retries are already enabled).
2. Reset invalid settings values to known defaults.
3. Use factory reset path only after validation passes.
4. Escalate to main IPC/settings handlers when persistent load/save failures continue.
