# Build Timeout and Memory Settings

## Purpose

This guide documents stable timeout and memory settings for local development and GitHub Actions to reduce `npm run build` timeout risk.

## Local Shell (Windows PowerShell)

- Use the existing build scripts with `NODE_OPTIONS=--max-old-space-size=8192` for heavy runs.
- Example:

```powershell
$env:NODE_OPTIONS="--max-old-space-size=8192"
npm run build
```

## GitHub Actions Baseline

Configured in `.github/workflows/ci.yml`:

- `validate`: `timeout-minutes: 20`, `NODE_OPTIONS=--max-old-space-size=6144`
- `security`: `timeout-minutes: 20`, `NODE_OPTIONS=--max-old-space-size=4096`
- `lint-and-types`: `timeout-minutes: 25`, `NODE_OPTIONS=--max-old-space-size=6144` (type-check), `4096` (lint)
- `tests`: `timeout-minutes: 30`, `NODE_OPTIONS=--max-old-space-size=6144`
- `build-preview`: `timeout-minutes: 25`, `NODE_OPTIONS=--max-old-space-size=8192`

## Notes

- Keep memory lower for lint/security jobs to avoid over-allocation.
- Keep highest memory for build and type-check workloads.
- If timeout recurs, first inspect lockfile churn and dependency resolution time before increasing limits.
