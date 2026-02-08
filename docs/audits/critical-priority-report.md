# Critical Priority Audit Report

Generated: 2026-02-08T12:45:26.380Z

## GLOBAL-TS
- Strict mode enabled (`tsconfig.json` + `tsconfig.node.json`): **YES**
- Type check exit code: **0**
- Implicit any diagnostics: **0**

## GLOBAL-NASA
- Function length violations (`max-lines-per-function`): **6**
- Cyclomatic complexity violations (`complexity`): **39**
- Return-value / floating promise findings (`@typescript-eslint/no-floating-promises`): **0**

## GLOBAL-LOG
- `console.log` findings (excluding scaffold templates): **0**
- ESLint `no-console` findings: **3**

## GLOBAL-MEM
- Potential service leak-risk files (event/timer usage without cleanup): **8**

## GLOBAL-SEC
- IPC files with path args and explicit sanitization patterns: **2/50**

## GLOBAL-IPC
- Total `ipcMain.handle`: **375**
- Wrapped with central IPC wrappers: **139**
- Wrapper coverage: **37%**

## GLOBAL-DB
- `CREATE INDEX IF NOT EXISTS` statements found: **27**

## Notes
- JSON raw report: `docs/audits/critical-priority-report.json`
