# Critical Priority Audit Report

Generated: 2026-02-08T13:22:05.978Z

## GLOBAL-TS
- Strict mode enabled (`tsconfig.json` + `tsconfig.node.json`): **YES**
- Type check exit code: **0**
- Implicit any diagnostics: **0**

## GLOBAL-NASA
- Function length violations (`max-lines-per-function`): **7**
- Cyclomatic complexity violations (`complexity`): **41**
- Return-value / floating promise findings (`@typescript-eslint/no-floating-promises`): **0**

## GLOBAL-LOG
- `console.log` findings (excluding scaffold templates): **0**
- ESLint `no-console` findings: **0**

## GLOBAL-MEM
- Potential service leak-risk files (event/timer usage without cleanup): **0**

## GLOBAL-SEC
- IPC files with path args and explicit sanitization patterns: **2/50**

## GLOBAL-IPC
- Total `ipcMain.handle`: **376**
- Wrapped with central IPC wrappers: **140**
- Wrapper coverage: **37%**

## GLOBAL-DB
- `CREATE INDEX IF NOT EXISTS` statements found: **27**

## Notes
- JSON raw report: `docs/audits/critical-priority-report.json`
