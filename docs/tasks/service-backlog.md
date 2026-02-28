# Service Backlog (BACKLOG-0301 to BACKLOG-0500)

> Extracted from TODO.md — remaining tasks only
> Generated from current repository modules (`src/main`, `src/renderer`, `src/shared`) to capture realistic ideas for new systems, potential bugs, and missing implementations.

## AgentCollaborationService (BACKLOG-0335–0340)


## AgentCheckpointService (BACKLOG-0345–0350)


## RateLimitService (BACKLOG-0401–0410)


## ProxyService (BACKLOG-0411–0420)


## QuotaService (BACKLOG-0421–0430)


## WorkflowService (BACKLOG-0431–0440)


## FeatureFlagService (BACKLOG-0441–0450)


## MonitoringService (BACKLOG-0451–0460)


## TelemetryService (BACKLOG-0461–0470)


## ThemeService (BACKLOG-0471–0480)


## DataService (BACKLOG-0481–0490)


## DatabaseService (BACKLOG-0491–0500)

## Security Follow-Ups (2026-02-27)

- [x] **BACKLOG-SEC-API-01**: Refactor `ApiServerService` authentication flow to forbid token transport in query parameters.
- [x] **BACKLOG-SEC-AUTH-01**: Refactor `auth:poll-token` IPC contract to avoid returning bearer tokens to renderer.
- [x] **BACKLOG-SEC-WINDOW-01**: Add command allowlist + executable policy enforcement for `window:shell:runCommand`.
