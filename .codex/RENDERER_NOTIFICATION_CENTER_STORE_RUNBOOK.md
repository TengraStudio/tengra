# Renderer Notification Center Store Runbook

## Scope
Operational guidance for Renderer Notification Center Store.

## Health Dashboard Signals
- UI state (eady|loading|empty|failure)
- Success/failure counts
- Retry/fallback counts
- Budget exceeded count

## Triage Steps
1. Confirm latest UI state and error code from health store snapshot.
2. Verify validation guards are accepting expected payloads/inputs.
3. Check retry/fallback behavior and telemetry counters for regressions.
4. If failures persist, switch to safe fallback behavior and notify via release notes.

## Recovery Playbook
1. Roll back to previous stable component build if failure spike exceeds budget.
2. Re-enable guarded defaults for invalid inputs.
3. Re-run renderer unit + integration suites for impacted component.
