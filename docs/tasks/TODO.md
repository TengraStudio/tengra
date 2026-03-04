# TENGRA PROJECT TODO LIST

## 🆕 Next Backlog
- [x] **REF-011**: Split `src/renderer/electron.d.ts` (2633 lines) into domain-specific declaration modules.
- [x] **REF-012**: Continue decomposing `src/main/services/llm/idea-generator.service.ts` (2448 lines) by extracting research and export orchestration.
- [x] **REF-013**: Continue shrinking `src/main/services/llm/advanced-memory.service.ts` (1937 lines) by extracting persistence/normalization adapters.
- [x] **TEST-005**: Eliminate recurring React `act(...)` warnings in renderer tests, especially the `WorkspaceEditor` suites.
- [ ] **LINT-001**: Resolve repo-wide `simple-import-sort` warnings in touched main/renderer files to reduce diff noise and keep lint output actionable.
- [ ] **SAFE-004**: Replace remaining `as unknown` and similarly broad cast patterns in IPC and translation-adjacent code with narrower typed helpers.
- [x] **REF-014**: Invert workspace compatibility shims so canonical implementations live in `Workspace*` files and `Project*` files are pure re-export shims only.
- [x] **REF-015**: Rename remaining internal `Project*` local variables and prop names in workspace features (`projectSearchIndex`, `selectedProjectIds`, `onProjectCreated`, etc.) to `Workspace*`.
- [x] **TEST-006**: Add renderer tests for the `WorkspaceHeader`, `WorkspaceModals`, and `VirtualizedWorkspaceGrid` compatibility wrappers.
- [x] **PERF-001**: Split `src/renderer/features/workspace/WorkspacePage.tsx` into smaller sections/hooks to reduce complexity and isolate state.
- [x] **DOC-001**: Update project workflow/rules docs that still reference the removed structured changelog file path.
- [ ] **TEST-007**: Add direct renderer tests for `src/renderer/features/workspace/utils/workspace-startup-preflight.ts` runbook and issue-filtering behavior.
- [x] **REF-016**: Standardize remaining `Project Agent` bridge naming in renderer hooks/components to `workspaceAgent` or `automationWorkflow` to match the UI rename.

## 🎯 March 2026 Priority Plan (Target: complete before 2026-03-31)

### P0 - Must Finish This Month
- [ ] **PRD-001**: Create a concise product strategy document that defines Tengra's primary user, primary job-to-be-done, key differentiators, and what the product is explicitly not.
  Scope: define target personas (`solo developer`, `indie team`, `local-first power user`), core workflows, non-goals, and product positioning.
  Targets: `docs/product/PRODUCT_STRATEGY.md` (new), `README.md`, `docs/README.md`, `docs/guides/DEVELOPMENT.md`.
  Deliverables: product positioning doc, updated README summary, aligned terminology guidance for future feature work.
- [ ] **UX-001**: Audit and unify product terminology across renderer flows so `Project`, `Workspace`, `Workflow`, and `Agent` language is no longer mixed in user-facing UI.
  Scope: audit visible labels, button text, headings, empty states, modal titles, and status messages for inconsistent terms.
  Targets: `src/renderer/features/workspace/**`, `src/renderer/features/automation-workflow/**`, `src/renderer/i18n/en/**`, `src/renderer/i18n/tr/**`, `src/renderer/components/layout/**`.
  Deliverables: terminology map, updated user-facing strings, regression checklist for renamed UI terms.
- [ ] **TEST-008**: Add offline-first smoke coverage for the critical path: local model available, no network, workspace operations, chat, and memory still usable.
  Scope: simulate disconnected network state and validate local providers, local DB, workspace actions, and memory retrieval continue working.
  Targets: `src/tests/main/**`, `src/tests/renderer/**`, `src/main/services/analysis/health*`, `src/main/services/llm/ollama*`, `src/renderer/features/chat/**`, `src/renderer/features/workspace/**`.
  Deliverables: smoke tests for offline startup, local chat flow, workspace open, and memory access with cloud providers degraded.
- [ ] **HEALTH-001**: Build a centralized system health dashboard covering local models, proxy, token service, database, SSH, extension connectivity, and degraded/offline states.
  Scope: collect service health from main-process services and expose a single health surface in the renderer with actionable statuses.
  Targets: `src/main/ipc/health.ts`, `src/main/services/analysis/**`, `src/main/services/system/**`, `src/main/services/llm/**`, `src/renderer/features/settings/**` or `src/renderer/features/showcase/**`, `src/shared/types/system.ts`.
  Deliverables: aggregate health IPC contract, dashboard UI, status badges, degraded mode explanations, refresh action.
- [ ] **AI-TRAIN-001**: Design and implement a system that lets users create their own AI agents/models/personas, configure them, and iteratively train/tune them with local project context, memory, and reusable prompts.
  Scope: support custom persona definition, prompt packs, memory-backed specialization, local fine-tune metadata, and reusable profile selection.
  Targets: `src/main/services/llm/**`, `src/main/services/data/**`, `src/main/ipc/model-registry.ts`, `src/main/ipc/prompt-templates.ts`, `src/renderer/features/models/**`, `src/renderer/features/prompts/**`, `src/shared/types/model.types.ts`, `src/shared/types/automation-workflow.ts`.
  Deliverables: custom AI profile schema, persistence layer, creation/edit UI, training/tuning workflow, and guarded execution path for local context ingestion.
- [ ] **GPU-001**: Design and implement hybrid local + online GPU cluster orchestration so workloads can be routed between on-device compute and remote GPU capacity with health, quota, and fallback controls.
  Scope: define workload routing between local runtimes and remote GPU providers, with provider health, job queueing, and fallback policies.
  Targets: `src/main/services/proxy/**`, `src/main/services/llm/**`, `src/main/services/system/**`, `src/main/ipc/proxy*.ts`, `src/main/ipc/model-*.ts`, `src/renderer/features/models/**`, `src/shared/types/quota.ts`.
  Deliverables: cluster routing policy model, job dispatch service, health/quota-aware selector, UI controls for preferred compute target, and failure fallback rules.
- [ ] **WS-001**: Expand the Workspace system with higher-value capabilities (multi-workspace orchestration, smarter indexing, stronger preflight checks, richer file operations, better remote mount ergonomics, and clearer status surfaces).
  Scope: improve day-to-day workspace productivity, especially around multi-root management, indexing, explorer behavior, remote mounts, and readiness feedback.
  Targets: `src/main/services/workspace/**`, `src/main/ipc/workspace*.ts`, `src/renderer/features/workspace/**`, `src/shared/types/workspace.ts`, `src/shared/schemas/service-hardening.schema.ts`.
  Deliverables: prioritized workspace improvements list, upgraded preflight/reporting, richer explorer operations, remote mount quality-of-life updates, and workspace-level orchestration actions.
- [ ] **WF-001**: Mature the Automation Workflow system into a production-ready feature by closing naming debt, stabilizing task execution, improving recovery, and tightening UX for real end-user usage.
  Scope: move the workflow system from refactor-in-progress to production-ready by hardening execution, approvals, retries, checkpoints, and UI visibility.
  Targets: `src/main/services/workspace/automation-workflow/**`, `src/main/services/workflow/**`, `src/main/ipc/workflow.ts`, `src/main/ipc/workspace-agent*.ts`, `src/renderer/features/automation-workflow/**`, `src/renderer/features/workflows/**`, `src/shared/types/automation-workflow.ts`.
  Deliverables: stable execution state machine, recovery path, approval UX, checkpoint tooling, end-to-end tests, and finalized user-facing naming.

### P1 - High Value Follow-Through
- [ ] **ONB-001**: Build a guided first-run setup flow for local models, provider keys, workspace creation, and recommended defaults.
  Scope: create a first-run wizard that detects available runtimes and leads users through the minimum viable setup.
  Targets: `src/renderer/features/onboarding/**`, `src/renderer/context/AppProviders.tsx`, `src/renderer/features/models/**`, `src/renderer/features/workspace/**`, `src/main/ipc/health.ts`, `src/main/ipc/settings.ts`.
  Deliverables: onboarding flow, setup checkpoints, skip/resume support, and default recommendations.
- [ ] **SAFE-005**: Add IPC contract parity checks that verify preload exposure, shared schemas, and handler registration stay in sync.
  Scope: detect drift between preload bridges, IPC handlers, and shared Zod schemas before runtime regressions reach users.
  Targets: `src/main/preload/**`, `src/main/ipc/**`, `src/shared/schemas/**`, `src/tests/main/**`, `scripts/**`.
  Deliverables: parity test suite or validation script, mismatch reporting, and CI-safe failure output.
- [ ] **PERF-002**: Introduce startup and bundle budgets for renderer chunks, preload bundle size, and main-process initialization time.
  Scope: establish measurable performance budgets and fail fast when builds or startup regress beyond set thresholds.
  Targets: `package.json`, `scripts/tool.js`, `scripts/**`, `vite.config.ts`, `vitest.config*.ts`, `src/main/startup/**`.
  Deliverables: budget config, build-time reporting, startup telemetry metrics, and threshold enforcement.
- [ ] **DATA-001**: Document and test canonical boundaries between Workspace, Memory, Chat, and Automation Workflow data models.
  Scope: make domain ownership explicit so future refactors do not cross-contaminate data responsibilities.
  Targets: `docs/architecture/DATA_MODEL.md`, `src/shared/types/**`, `src/main/services/data/**`, `src/tests/main/**`.
  Deliverables: boundary matrix, updated data model docs, and contract tests for key domain edges.
- [ ] **EXT-001**: Harden browser extension to desktop integration with connection diagnostics, reconnection UX, and clearer failure handling.
  Scope: improve extension-to-app handshake reliability, user feedback, and recovery when desktop or extension state changes.
  Targets: `src/main/services/extension/**`, `src/main/ipc/extension.ts`, `src/renderer/features/extensions/**`, `website/**` docs if needed.
  Deliverables: connection state model, diagnostics UI, reconnect flow, and failure-state handling tests.
- [ ] **MCP-001**: Add permission profiles for MCP/plugin capabilities (`read-only`, `workspace-only`, `network-enabled`, `destructive`) with explicit gating in UI and runtime.
  Scope: establish a permission model for plugin/server capabilities and enforce it across registration, execution, and UI.
  Targets: `src/main/services/mcp/**`, `src/main/ipc/mcp*.ts`, `src/renderer/features/mcp/**`, `src/shared/types/**`, `docs/guides/MCP_PLUGIN_DEVELOPMENT.md`.
  Deliverables: permission schema, enforcement layer, consent UI, and audit logging hooks for sensitive actions.

### P2 - Quality And Maintainability
- [ ] **LINT-002**: Reduce residual lint and test warning noise beyond import sorting, including recurring renderer warnings that hide real regressions.
  Scope: clear noisy warnings so future signal is meaningful and CI output remains usable.
  Targets: `eslint.config.mjs`, `src/renderer/**`, `src/main/**`, `src/tests/**`.
  Deliverables: reduced warning count, triage list for remaining intentional exceptions, and cleaner CI output.
- [ ] **DOC-002**: Reconcile product, architecture, and workflow documentation with the current post-migration codebase and remove stale references.
  Scope: bring docs back in sync with the real architecture after Workspace and Workflow migrations.
  Targets: `docs/README.md`, `docs/architecture/**`, `docs/api/**`, `docs/guides/**`, `README.md`.
  Deliverables: updated docs index, corrected architecture references, and removed stale paths/instructions.
- [ ] **TEST-009**: Add regression suites for compatibility shims and renamed Workspace/Workflow entry points so migration debt does not reappear.
  Scope: lock down renamed entry points and compatibility wrappers with explicit regression coverage.
  Targets: `src/tests/main/**`, `src/tests/renderer/**`, `src/renderer/features/workspace/**`, `src/main/ipc/workspace*.ts`, `src/main/ipc/workflow.ts`.
  Deliverables: regression tests covering canonical imports, compatibility shims, and renamed IPC/bridge paths.

## ⚡ Performance Optimization Program

### P0 - High ROI Optimization Pass
- [ ] **OPT-001**: Add baseline performance instrumentation for startup, idle CPU, renderer memory, main-process memory, and feature-level hot paths before changing behavior.
  Scope: measure current performance so optimization work is driven by evidence instead of guesswork.
  Targets: `src/main/services/analysis/**`, `src/main/ipc/performance.ts`, `src/main/ipc/metrics.ts`, `src/renderer/features/showcase/**` or a new diagnostics panel, `scripts/tool.js`.
  Deliverables: baseline metrics dashboard/report, startup timing capture, idle CPU checklist, memory snapshots, and a repeatable profiling workflow.
- [ ] **OPT-002**: Make startup service initialization aggressively lazy so only core services initialize on app launch and heavy domains load on first use.
  Scope: reduce startup CPU/RAM by deferring non-essential services such as `workspace`, `ssh`, `docker`, `memory`, `extension`, `marketplace`, and heavy workflow services.
  Targets: `src/main/startup/**`, `src/main/services/**`, `src/main/ipc/lazy-services.ts`, `src/main/startup/services.ts`.
  Deliverables: startup service classification (`core`, `deferred`, `on-demand`), lazy initialization paths, and reduced cold-start resource usage.
- [ ] **OPT-003**: Expand renderer-side code splitting and lazy loading so heavy feature bundles are only loaded when their screens/tabs are opened.
  Scope: defer loading of large UI modules such as `WorkspacePage`, `AutomationWorkflow`, `Models`, `Memory`, editors, graph views, markdown/math tooling, and terminal-heavy surfaces.
  Targets: `src/renderer/components/lazy/**`, `src/renderer/features/**`, `vite.config.ts`, `src/renderer/views/**`.
  Deliverables: new lazy boundaries, smaller initial renderer payload, and documented chunk ownership by feature.
- [ ] **OPT-004**: Reduce idle CPU usage by throttling or suspending watchers, timers, health polling, telemetry loops, and background jobs when the app or feature is inactive.
  Scope: audit all recurring work and make it adaptive to visibility, focus, active workspace state, and idle/minimized conditions.
  Targets: `src/main/services/system/**`, `src/main/services/analysis/**`, `src/main/services/workspace/**`, `src/main/services/llm/**`, `src/renderer/hooks/**`.
  Deliverables: reduced idle polling cadence, pause/resume logic for background jobs, and measurable idle CPU improvements.
- [ ] **OPT-005**: Batch and throttle high-frequency IPC streams (logs, file-watch events, progress updates, terminal output, workflow events) to reduce UI thread pressure.
  Scope: eliminate IPC event storms that cause renderer jank and unnecessary main/renderer churn.
  Targets: `src/main/ipc/**`, `src/main/services/terminal/**`, `src/main/services/workspace/**`, `src/main/services/workflow/**`, `src/main/services/analysis/**`.
  Deliverables: batched event emission, max-frequency limits, coalesced file-watch updates, and lower IPC message volume under load.

### P1 - Structural Performance Improvements
- [ ] **OPT-006**: Split `WorkspacePage` and other state-heavy renderer surfaces into smaller render boundaries so local state changes do not re-render the entire screen.
  Scope: reduce expensive re-renders by isolating list state, modal state, preflight state, header controls, and heavy content panes.
  Targets: `src/renderer/features/workspace/WorkspacePage.tsx`, `src/renderer/features/workspace/components/**`, `src/renderer/features/automation-workflow/**`.
  Deliverables: smaller container components, extracted hooks, isolated render sections, and fewer whole-page re-renders.
- [ ] **OPT-007**: Optimize terminal and editor lifecycle management by limiting retained instances, trimming buffers, and suspending hidden tabs/panels.
  Scope: reduce long-session RAM growth and CPU churn from multiple open terminals and editors.
  Targets: `src/renderer/features/terminal/**`, `src/renderer/features/workspace/components/workspace/**`, `src/main/services/terminal/**`, `src/shared/types/terminal*.ts`.
  Deliverables: buffer limits, suspended hidden sessions, capped retained instances, and documented lifecycle rules for tabs/panels.
- [ ] **OPT-008**: Reduce semantic memory, indexing, and code-intelligence runtime cost using bounded concurrency, incremental work, and cache reuse.
  Scope: keep large workspaces from triggering expensive scans, embeddings, and maintenance tasks too aggressively.
  Targets: `src/main/services/llm/advanced-memory*.ts`, `src/main/services/workspace/**`, `src/main/services/project/code-intelligence/**`, `src/main/services/data/**`.
  Deliverables: bounded job queues, incremental indexing, cache reuse strategy, and lower CPU spikes during workspace analysis.
- [ ] **OPT-009**: Trim renderer bundle and vendor chunk size by splitting feature-specific dependencies and deferring rarely used heavy libraries.
  Scope: reduce parse/compile cost from large frontend bundles and improve first usable paint.
  Targets: `vite.config.ts`, `src/renderer/features/**`, `src/renderer/components/**`, `package.json`.
  Deliverables: chunk strategy update, dependency loading plan, reduced initial JS footprint, and bundle-size comparison before/after.
- [ ] **OPT-010**: Reduce logging and telemetry overhead in production builds by lowering verbosity and sampling high-frequency events.
  Scope: stop log I/O and diagnostics traffic from consuming CPU during normal usage.
  Targets: `src/main/logging/**`, `src/main/services/analysis/**`, `src/main/services/**`, `src/renderer/utils/**`.
  Deliverables: production logging policy, sampled telemetry for noisy channels, and reduced high-frequency diagnostic overhead.

### P2 - Long-Term Performance Guardrails
- [ ] **OPT-011**: Add enforceable performance budgets for startup time, renderer heap, main-process heap, and bundle size so regressions are detected automatically.
  Scope: move performance from ad hoc tuning to an enforced engineering contract.
  Targets: `scripts/**`, `package.json`, `vite.config.ts`, `src/main/services/analysis/**`, CI-related tooling.
  Deliverables: budget thresholds, automated budget report, failure conditions for regressions, and baseline documentation.
- [ ] **OPT-012**: Add feature-specific performance regression tests for `Workspace`, `Automation Workflow`, `Terminal`, and `Memory` hot paths.
  Scope: ensure heavy user flows stay within defined limits as the product evolves.
  Targets: `src/tests/main/**`, `src/tests/renderer/**`, `scripts/**`, `playwright.config.ts`.
  Deliverables: repeatable perf-oriented smoke/regression tests and a tracked set of critical user-flow metrics.
