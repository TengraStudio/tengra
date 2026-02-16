# Security Best Practices Report
Date: 2026-02-15
Scope: `src/main`, `src/renderer`, `extension`, dependency/tooling checks

## Executive Summary
The codebase has multiple strong defaults in Electron window hardening (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`) and IPC validation in key paths.  
High-priority risk remains in command-execution code paths where shell command strings are built from dynamic input, plus one renderer HTML injection surface that should be sanitized defensively.

## Critical / High Findings

### SEC-F001 (High): Command injection risk in agent test runner
- Location: `src/main/services/project/agent/agent-test-runner.service.ts:104`, `src/main/services/project/agent/agent-test-runner.service.ts:141`
- Evidence:
  - Dynamic command composition with `filter` interpolation.
  - Process execution uses `spawn(..., { shell: true })`.
- Impact: Malicious filter/command values can execute unintended shell commands during agent-driven test runs.
- Fix:
  - Remove `shell: true`.
  - Parse command into executable + validated args.
  - Strictly sanitize/escape filter inputs and disallow shell metacharacters.

### SEC-F002 (High): Shell string interpolation in system service methods
- Location: `src/main/services/system/system.service.ts:100`, `src/main/services/system/system.service.ts:142`
- Evidence:
  - `setWallpaper(imagePath)` and `launchApp(appName)` interpolate values into shell command strings.
  - Uses `exec(...)`-style invocation patterns.
- Impact: If attacker-controlled values reach these methods, command injection is possible.
- Fix:
  - Replace string shell execution with `spawn/execFile` argument arrays.
  - Apply strict allowlists and escaping for app names/paths.

### SEC-F003 (High): Archive extraction command interpolation
- Location: `src/main/services/data/file.service.ts:101`
- Evidence:
  - `unzip()` builds command strings with interpolated paths for PowerShell/`unzip`.
- Impact: Quote/path injection can trigger arbitrary command execution in extraction flow.
- Fix:
  - Use non-shell invocation with validated argument arrays.
  - Add regression tests for malicious file/path payloads.

## Medium Findings

### SEC-F004 (Medium): Unsanitized HTML injection for marketplace model details
- Location: `src/renderer/features/models/components/ModelDetailsPanel.tsx:446`
- Evidence:
  - `dangerouslySetInnerHTML` renders `ollamaModel.longDescriptionHtml`.
- Impact: If upstream model metadata contains hostile HTML, renderer XSS is possible.
- Fix:
  - Sanitize with DOMPurify allowlist profile before render.
  - Optionally render as markdown/plain text fallback when sanitization fails.

### SEC-F005 (Medium): Dependency vulnerability detected in audit
- Location: `package.json` (`audit:deps`)
- Evidence:
  - `npm audit --audit-level=moderate` reports high vulnerability in transitive `axios` via `bundlewatch`.
- Impact: Supply-chain risk remains in current dependency graph.
- Fix:
  - Pin/override or replace vulnerable path.
  - Add CI policy for accepted exceptions and review cadence.

## Operational / Tooling Findings

### OPS-F001 (Medium): Secret scan fails on large binary artifact
- Location: `package.json` (`secrets:scan`)
- Evidence:
  - `secretlint "**/*"` fails with `ERR_FS_FILE_TOO_LARGE` on `release/win-unpacked/resources/app.asar` (>2GB).
- Impact: Secret scanning is unreliable and can silently stop in local/CI contexts.
- Fix:
  - Exclude build artifacts and large binaries via ignore config.
  - Run scan on source-only globs in CI.

### OPS-F002 (Low): npm config warning during scripts
- Evidence:
  - `npm warn Unknown env config "msvs-version"` appears in script runs.
- Impact: No immediate security risk, but noisy logs and future breakage risk.
- Fix:
  - Remove/normalize legacy npm env config in local/CI environment.

## Checks Performed
- `npm run type-check` (passed)
- `npm run audit:deps` (failed with 2 high vulnerabilities, same advisory chain)
- `npm run secrets:scan` (failed due file >2GB)
- Targeted static scans for:
  - HTML/DOM sinks (`dangerouslySetInnerHTML`, `innerHTML`)
  - Process execution (`exec`, `spawn`, `shell: true`)
  - Electron security window prefs

