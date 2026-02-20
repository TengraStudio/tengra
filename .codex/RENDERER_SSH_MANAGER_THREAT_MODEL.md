# Renderer SSH Manager Threat Model

## Assets
- SSH profile metadata (host, username, auth configuration)
- Connection status and lifecycle events
- Terminal interaction channel state

## Entry Points
- Add/Test connection modal inputs
- Connection list actions (connect/disconnect/delete)
- Renderer event listeners (`onConnected`, `onDisconnected`, shell stream callbacks)

## Primary Threats
1. Invalid/malformed profile payloads causing unsafe calls.
2. Repeated transient connection failures degrading UX without bounded retries.
3. UI desynchronization from stale connection states.
4. Unsafe destructive action flow (accidental profile deletion).

## Mitigations Implemented
- Strict form/profile validation and normalization (`ssh-manager-validation.ts`).
- Standardized error codes and fallback behavior.
- Bounded retry strategy for connect and profile test paths.
- Health telemetry with degraded-state detection and channel budgets.
- In-UI delete confirmation flow (replacing direct `window.confirm` path).
- Explicit loading/empty/failure UI states.

## Remaining Risks
- Renderer cannot independently validate remote host authenticity.
- Profile storage integrity and credential encryption rely on main process services.
- Shell event stream abuse scenarios are out-of-scope for renderer-only controls.
