# Performance Contract

## Goal

Treat performance as a release contract instead of a best-effort guideline. Tengra now has measurable guardrails for startup, workspace interaction, editor readiness, terminal readiness, memory, and idle CPU behavior.

## Contract Surface

### Build-Time Budgets

- `scripts/check-bundle-size.cjs` enforces main, preload, renderer shell, workspace details, Monaco, terminal, Mermaid, KaTeX, and React Flow size limits.
- `npm run build` already fails when those budgets regress.

### Runtime Budgets

`src/tests/e2e/performance.spec.ts` measures the following against a built Electron app:

- cold startup `ready-to-show`
- cold startup `did-finish-load`
- first interactive workspace open
- Monaco editor ready time
- workspace terminal ready time
- main-process heap ceiling
- renderer heap ceiling
- idle CPU usage after settle

The test creates temporary workspaces during execution so results do not depend on existing user data.

## Budget Values

Current contract thresholds:

- startup shell ready: `3000ms`
- startup load complete: `4500ms`
- workspace open: `2000ms`
- editor ready: `2500ms`
- terminal ready: `1500ms`
- main heap: `200MB`
- renderer heap: `250MB`
- idle CPU: `< 8%`

## Instrumentation

Renderer marks are exposed through `window.__TENGRA_PERFORMANCE__` and recorded from real UX boundaries:

- `workspace:open:start`
- `workspace:shell:ready`
- `workspace:dashboard:ready`
- `workspace:editor:runtime-loaded`
- `workspace:editor:ready`
- `workspace:terminal:requested`
- `workspace:terminal:ready`

Main-process startup milestones continue to come from `PerformanceService.recordStartupEvent()`:

- `coreServicesReadyTime`
- `ipcReadyTime`
- `windowCreatedTime`
- `readyTime`
- `loadTime`
- `deferredStartTime`
- `deferredServicesReadyTime`

## Commands

- `npm run build`
  Enforces build-time bundle budgets.
- `npm run perf:contract`
  Builds if necessary, launches the packaged Electron entry, and runs the runtime performance guardrails.
- `npm run verify:full`
  Runs lint, type-check, tests, then the runtime performance contract.

## Contributor Rules

- New heavy renderer surfaces must add a lazy boundary and stay out of the renderer shell path unless needed for first interaction.
- New recurring polling must register through the scheduler or visibility-aware interval policy instead of opening raw timers by default.
- Workspace-bound background work must respect the active workspace policy unless explicitly documented as global.
- New startup work must be assigned to a startup phase in `STARTUP_ACTIVATION_MATRIX.md` before it lands.
