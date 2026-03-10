# TENGRA PROJECT TODO LIST

## 🆕 Next Backlog
- [x] **ARCH-SESSION-001**: Define the canonical Session Engine architecture so `chat`, `workspace conversation`, `automation workflow`, and future `council-enabled` experiences share one runtime model.
  Scope: establish shared terminology (`session`, `mode`, `capability`, `module`, `state`, `event`), decide canonical namespaces, and document how current `chat`, `workspaceAgent`, `workflow`, `orchestrator`, and `collaboration` map into the new model.
  Targets: `TODO.md`, `docs/architecture/**`, `src/shared/types/**`, `src/shared/schemas/**`.
  Deliverables: domain glossary, canonical ownership map, migration constraints, and a freeze on introducing new legacy namespaces.
- [x] **ARCH-SESSION-002**: Introduce shared session contracts in `src/shared` for modes, capabilities, metadata, event envelopes, transport payloads, lifecycle state, and recovery semantics.
  Scope: create the single source of truth for the new engine before moving any runtime implementation.
  Targets: `src/shared/types/**`, `src/shared/schemas/**`, `src/shared/constants/**`.
  Deliverables: `SessionMode`, `SessionCapability`, `SessionState`, `SessionMessageEnvelope`, `SessionLifecycleEvent`, and capability-gated configuration schemas.
- [x] **ARCH-SESSION-003**: Build a main-process `BaseSessionEngine` abstraction that owns the common runtime lifecycle.
  Scope: move shared behavior into one engine surface: initialization, message submission, streaming orchestration, event emission, interruption, recovery hooks, persistence hooks, tool dispatch hooks, and capability checks.
  Targets: `src/main/services/**`, `src/main/ipc/**`, `src/main/startup/**`.
  Deliverables: base engine contract, dependency bundle, module registration model, and event emitter strategy with cleanup/disposal rules.
- [x] **ARCH-SESSION-004**: Extract session capabilities/modules so feature differences are composable instead of being encoded as parallel services or hardcoded branches.
  Scope: separate optional behavior such as `council`, `workspace context`, `task planning`, `task execution`, `tools`, `rag`, `image generation`, `checkpoints`, and `recovery`.
  Targets: `src/main/services/**`, `src/shared/types/**`, `src/shared/schemas/**`.
  Deliverables: capability interfaces, module lifecycle hooks, compatibility rules, and enable/disable policies per session mode.
- [x] **ARCH-SESSION-005**: Implement `ChatSessionEngine` as the first concrete subclass on top of the base session engine.
  Scope: migrate plain chat orchestration to the shared engine without changing end-user behavior.
  Targets: `src/main/ipc/session-conversation.ts`, `src/main/services/session/chat-session-engine.service.ts`, `src/main/services/llm/**`, `src/main/services/data/**`, `src/renderer/features/chat/**`.
  Deliverables: shared chat runtime, stable streaming lifecycle, retained DB persistence, and parity coverage for tools, retry, and interruption.
- [x] **ARCH-SESSION-006**: Implement `WorkspaceSessionEngine` for workspace-side conversational usage that can behave as a normal chat session plus workspace-aware capabilities.
  Scope: support ordinary conversation, workspace context retrieval, and optional council/tool behavior from the workspace UI without forcing automation mode.
  Targets: `src/main/services/session/workspace-session-engine.service.ts`, `src/main/services/workspace/**`, `src/main/ipc/session-workspace.ts`, `src/renderer/features/workspace/**`.
  Deliverables: workspace session mode, shared stream client integration, context gating, and feature parity with current sidebar chat behavior.
- [x] **ARCH-SESSION-007**: Implement `AutomationSessionEngine` for plan/execution-oriented workflows on top of the same base engine.
  Scope: isolate workflow-specific behaviors such as planning, step state, approvals, checkpoints, execution policies, and automation telemetry while still sharing the base message/council/tool runtime.
  Targets: `src/main/services/session/automation-session-engine.service.ts`, `src/main/services/workspace/automation-workflow/**`, `src/main/ipc/session-automation.ts`, `src/renderer/features/automation-workflow/**`, `src/shared/types/automation-workflow.ts`.
  Deliverables: automation session subclass, workflow-only capability set, stable checkpoint/retry behavior, and a clean separation from plain chat/workspace conversation.
- [x] **ARCH-SESSION-008**: Make `Council` a reusable session capability instead of a workflow-bound subsystem.
  Scope: detach council behavior from workspace/workflow naming and make it attachable to plain chat, workspace chat, and automation sessions.
  Targets: `src/main/services/workspace/automation-workflow/collaboration/**`, `src/main/services/**`, `src/shared/types/**`, `src/shared/schemas/**`, `src/renderer/features/chat/**`, `src/renderer/features/workspace/**`.
  Deliverables: council module contract, attach/detach flow, session-agnostic vote/debate/message APIs, and feature flags for future UI enablement.
  Progress 2026-03-10: council planning ownership moved into `src/main/services/session/capabilities/council-capability.service.ts`; session module registry and automation workflow now depend on the session capability service instead of the old workspace council shim.
- [x] **ARCH-SESSION-009**: Collapse duplicate renderer stream/state clients into a single session client.
  Scope: remove the split between chat and workspace stream clients so all renderer surfaces consume the same event model, abort flow, retry flow, and recovery flow.
  Targets: `src/renderer/features/chat/**`, `src/renderer/features/workspace/**`, `src/renderer/lib/**`, `src/shared/types/**`.
  Deliverables: one session stream client, one state reducer/store model, one event parsing path, and compatibility adapters for legacy UI props.
  Progress 2026-03-10: automation step, plan, budget, and cost signals now use the canonical `session:automation:*` event-bus family instead of legacy `workspace:*` runtime event names.
  Progress 2026-03-10: the dead sidebar `chat-started / chat-generation-updated / chat-generation-status` compat hook was removed; workspace sidebar chat remains a thin adapter over the shared session conversation runtime.
- [x] **ARCH-SESSION-010**: Replace legacy IPC namespace drift with a single session-centric IPC surface plus thin compatibility adapters.
  Scope: define canonical `session:*` transport channels and keep old `chat:*`, `workspace-agent:*`, and other legacy channels only as temporary adapters until migration completes.
  Targets: `src/main/ipc/**`, `src/main/preload/**`, `src/shared/constants/ipc-channels.ts`, `src/shared/types/electron-api.types.ts`, `src/renderer/electron.d.ts`.
  Deliverables: canonical session IPC map, temporary compatibility wrappers, parity tests, and a clear deprecation list.
  Progress 2026-03-10: `session:conversation:*` is now the canonical conversation surface, `session:automation:resume-checkpoint` was added, the legacy `workspace-agent` / `workflow-execution` preload bridges were removed, the top-level chat preload facade was deleted, and the old `chat:*` IPC registrations plus `CHAT_CHANNELS` constants were removed in favor of the canonical `session` surface.
  Progress 2026-03-10: the remaining `ollama:streamChunk` compat emission was removed; conversation stream chunks now flow only through `session:conversation:stream-chunk`.
- [x] **ARCH-SESSION-011**: Unify preload exposure so only active runtime domains are exposed and all exposed domains are actually registered.
  Scope: remove drift between preload bridge files, runtime IPC registration, shared typings, and renderer usage.
  Targets: `src/main/preload.ts`, `src/main/preload/domains/**`, `src/main/startup/ipc.ts`, `src/shared/types/electron-api.types.ts`, `src/renderer/electron.d.ts`.
  Deliverables: one authoritative preload surface, dead bridge inventory, compatibility notes, and tests that fail on exposure/registration drift.
  Progress 2026-03-10: the canonical `session` preload surface now owns conversation, workspace, automation, and council APIs; `workspaceAgent`, `workflowExecution`, and the old top-level `chat` preload exposure were removed.
  Progress 2026-03-10: `promptTemplates`, `userCollaboration`, and `sharedPrompts` preload/runtime drift was fixed; `extension` handlers are now also registered in startup instead of being exposed without a live IPC backend.
- [x] **ARCH-SESSION-012**: Split ambiguous naming around `collaboration` into precise domains while preserving future extensibility.
  Scope: untangle `model collaboration`, `council collaboration`, `user live collaboration`, and any websocket/session sync features so future work does not overload one name.
  Targets: `src/main/services/**`, `src/main/ipc/**`, `src/main/preload/**`, `src/shared/types/**`, `src/renderer/features/**`.
  Deliverables: final naming map, refactor plan for each collaboration family, and compatibility aliases where unavoidable.
  Progress 2026-03-10: canonical renderer surfaces are now `window.electron.modelCollaboration` and `window.electron.liveCollaboration`; the old `collaboration` and `userCollaboration` names remain only as compatibility aliases, and the naming map is documented in `docs/architecture/SESSION_ENGINE.md`.
- [x] **ARCH-SESSION-013**: Audit and classify legacy/duplicate systems as `canonical`, `compatibility shim`, `unused`, or `broken/half-integrated`.
  Scope: explicitly classify `workflow-execution`, unused preload bridges, duplicate IPC register entrypoints, old `project/*` re-export trees, and half-integrated collaboration paths.
  Targets: `src/main/ipc/**`, `src/main/preload/**`, `src/main/services/**`, `src/renderer/**`, `docs/architecture/**`.
  Deliverables: classification matrix, kill list for post-launch cleanup, short-term keep list, and risk notes for each legacy surface.
  Progress 2026-03-10: the duplicate `src/main/ipc/index.ts` registration entrypoint was removed; `src/main/startup/ipc.ts` is now the only aggregate IPC registration path.
  Progress 2026-03-10: `src/main/services/workspace/agent/*.service.ts` re-export shims were removed; main code and tests now import the canonical `workspace/automation-workflow/*` implementations directly.
  Progress 2026-03-10: the dead `src/main/ipc/debug.ts` IPC surface was removed; `backup-scheduler.ts` and `backup.preload.ts` remain intentionally unintegrated because the backup family is being preserved for later product work.
  Progress 2026-03-10: additional unregistered/unused IPC handlers were removed: `chat-export.ts`, `chat-import.ts`, `chat-share.ts`, `db-stats.ts`, `file-diff.ts`, and `user-behavior.ts`.
- [x] **ARCH-SESSION-014**: Remove raw renderer IPC calls from session-related features and route them through typed domain bridges only.
  Scope: enforce that session/chat/workspace/automation surfaces use the same typed bridge and shared payload contracts.
  Targets: `src/renderer/features/chat/**`, `src/renderer/features/workspace/**`, `src/renderer/lib/**`, `src/main/preload/**`, `src/shared/types/electron-api.types.ts`.
  Deliverables: typed session bridge, eliminated raw `ipcRenderer.invoke` usage in touched session paths, and stricter tests for bridge contract usage.
  Progress 2026-03-10: workspace automation hooks/components now call `window.electron.session.automation` directly, and the old raw `agent:resume-checkpoint` invoke path was replaced with `session.automation.resumeCheckpoint`.
  Progress 2026-03-10: workspace list invalidation no longer subscribes via raw `window.electron.ipcRenderer.on('workspace:updated')`; it now uses the typed `window.electron.db.onWorkspaceUpdated(...)` bridge.
  Progress 2026-03-10: the canonical `session.conversation` API was narrowed by removing the unused `removeStreamChunkListener` compat method.
  Progress 2026-03-10: `SharedPromptLibrary` no longer calls `prompts:shared-*` via raw `ipcRenderer.invoke`; it now uses the typed `window.electron.sharedPrompts` bridge.
  Progress 2026-03-10: duplicate `files` and `update` bridge spreads were removed from `src/main/preload.ts`, leaving a single authoritative preload shape for those domains.
- [x] **ARCH-SESSION-015**: Harden persistence and restart recovery so every session mode can resume safely without fake in-flight states.
  Scope: standardize persisted session metadata, incomplete turn cleanup, checkpoint restoration, interrupted tool/council recovery, and restart-time normalization across all modes.
  Targets: `src/main/services/data/**`, `src/main/ipc/session-conversation.ts`, `src/main/services/workspace/automation-workflow/**`, `src/shared/types/chat.ts`, `src/shared/types/automation-workflow.ts`.
  Deliverables: unified recovery contract, persistent session metadata model, interrupted state handling, and regression tests for restart scenarios.
  Progress 2026-03-10: `SessionState` and `SessionRecoverySnapshot` now carry a shared recovery contract (`canResume`, `requiresReview`, `action`, `lastTransitionAt`, `hint`, `lastMessagePreview`) and all session registries expose normalized recovery snapshots.
- [x] **ARCH-SESSION-016**: Build an end-to-end test matrix for chat, workspace conversation, automation, and council-enabled flows on the shared engine.
  Scope: lock down the migration with regression coverage before removing compatibility layers.
  Targets: `src/tests/main/**`, `src/tests/renderer/**`, `src/tests/integration/**`.
  Deliverables: parity tests per session mode, capability coverage, preload/IPC parity checks, and launch-blocking regression scenarios.
  Progress 2026-03-10: session recovery parity is covered for chat, workspace, and automation via `src/tests/main/services/session/session-recovery.test.ts`; canonical collaboration aliases are covered in `src/tests/renderer/session-collaboration-aliases.test.ts`, alongside the broader build/lint/type-check/full test suite validation.
- [x] **ARCH-SESSION-017**: Finalize launch-time cleanup by shrinking legacy paths to explicit adapters and documenting the post-launch removal plan.
  Scope: keep only the minimum compatibility surface needed for release while ensuring the codebase communicates the new canonical structure clearly.
  Targets: `src/main/ipc/**`, `src/main/preload/**`, `src/main/services/**`, `docs/architecture/**`, `TODO.md`.
  Deliverables: compatibility layer inventory, marked deprecation boundaries, post-launch cleanup checklist, and updated architecture docs for contributors.
  Progress 2026-03-10: `docs/architecture/SESSION_ENGINE.md` and `.codex/SESSION_ENGINE.md` now document the canonical session runtime, compatibility aliases, deferred backup cleanup, and contributor rules for post-launch removal work.
- [x] **REF-011**: Split `src/renderer/electron.d.ts` (2633 lines) into domain-specific declaration modules.
- [x] **REF-012**: Continue decomposing `src/main/services/llm/idea-generator.service.ts` (2448 lines) by extracting research and export orchestration.
- [x] **REF-013**: Continue shrinking `src/main/services/llm/advanced-memory.service.ts` (1937 lines) by extracting persistence/normalization adapters.
- [x] **TEST-005**: Eliminate recurring React `act(...)` warnings in renderer tests, especially the `WorkspaceEditor` suites.
- [x] **LINT-001**: Resolve repo-wide `simple-import-sort` warnings in touched main/renderer files to reduce diff noise and keep lint output actionable.
- [x] **SAFE-004**: Replace remaining `as unknown` and similarly broad cast patterns in IPC and translation-adjacent code with narrower typed helpers.
- [x] **REF-014**: Invert workspace compatibility shims so canonical implementations live in `Workspace*` files and `Project*` files are pure re-export shims only.
- [x] **REF-015**: Rename remaining internal `Project*` local variables and prop names in workspace features (`projectSearchIndex`, `selectedProjectIds`, `onProjectCreated`, etc.) to `Workspace*`.
- [x] **TEST-006**: Add renderer tests for the `WorkspaceHeader`, `WorkspaceModals`, and `VirtualizedWorkspaceGrid` compatibility wrappers.
- [x] **FIX-CHAT-CRASH-001**: Resolve 'Cannot read properties of undefined (reading \'error\')' crash in ChatProvider by adding defensive guards.
- [x] **PERF-001**: Split `src/renderer/features/workspace/WorkspacePage.tsx` into smaller sections/hooks to reduce complexity and isolate state.
- [x] **DOC-001**: Update project workflow/rules docs that still reference the removed structured changelog file path.
- [x] **TEST-007**: Add direct renderer tests for `src/renderer/features/workspace/utils/workspace-startup-preflight.ts` runbook and issue-filtering behavior.
- [x] **REF-016**: Standardize remaining `Project Agent` bridge naming in renderer hooks/components to `workspaceAgent` or `automationWorkflow` to match the UI rename.
- [x] **SAFE-006**: Fix "Maximum call stack size exceeded" errors by removing recursive `workspaceScaffoldService` and `workspaceAgentService` registrations in `src/main/startup/services.ts`.
- [x] **FIX-WS-IMPORT-001**: Stop silent workspace creation failures from closing the folder-import wizard and propagate duplicate-path errors from `db:createWorkspace`.
- [x] **FIX-WS-IMPORT-002**: Route workspace create/list through strict db-service responses so folder imports cannot succeed on swallowed query failures.
- [x] **FIX-DB-SCHEMA-001**: Repair legacy runtime DB bootstrap so missing `workspaces`/`agents`/memory tables and missing `agent_tasks.state` or `uac_tasks.workspace_path` columns are recreated during startup.
- [x] **SAFE-007**: Remove automatic Hugging Face model fetching and display from `ModelRegistryService` to simplify Model Selector.
- [x] **OPT-WS-OPEN-001**: Make workspace opening latency-bounded by skipping non-blocking preflight checks on click and returning partial analysis immediately while full scans finish in the background.
- [x] **UX-WS-SEARCH-001**: Collapse duplicate workspace search surfaces into a single Search tab and remove the separate Code search tab.
- Rename-tail note: Exclude `src/native/Cargo.lock` from `project|Project|projects|Projects` tail expectations because every remaining hit in that autogenerated lockfile is the third-party crate name `pin-project-lite`, not workspace rename debt.

## 🎯 March 2026 Priority Plan (Target: complete before 2026-03-31)

### P0 - Must Finish This Month  
- [ ] **RUNTIME-BOOT-001**: Audit and classify every runtime binary, external dependency, and startup assumption used by packaged and development builds.
  Scope: produce the canonical inventory of native services, bundled binaries, external prerequisites, path-resolution assumptions, startup ordering, and per-OS gaps before any refactor begins.
  Targets: `TODO.md`, `docs/architecture/**`, `src/main/services/system/**`, `src/main/services/**`, `scripts/**`, `package.json`.
  Deliverables: runtime dependency matrix, binary ownership map, dev-vs-packaged path matrix, external dependency list (`Ollama`, VC++/system libs if applicable), and an explicit list of code paths that currently assume `resources/bin`.
  Progress 2026-03-11: the initial runtime inventory and path policy are now documented in `docs/architecture/MANAGED_RUNTIME.md`, including current managed components, external dependencies, and remaining bootstrap gaps.
- [ ] **RUNTIME-BOOT-002**: Define the canonical managed runtime directory strategy for Windows, macOS, and Linux while preserving the current development workflow.
  Scope: standardize where downloaded runtimes, extracted binaries, manifests, checksums, temp downloads, logs, and state files live on each OS; require one managed runtime root for both development and packaged builds.
  Targets: `docs/architecture/**`, `src/main/services/system/**`, `src/shared/constants/**`.
  Deliverables: OS path policy, managed runtime root contract, cache/temp directory policy, cleanup rules, and a clear rule for how local build outputs seed the managed runtime without restoring `resources/bin` as a runtime source.
  Progress 2026-03-11: the canonical managed runtime root is now documented as `%APPDATA%/Tengra/runtime` on Windows and the Electron `appData/Tengra/runtime` equivalent on macOS/Linux; packaged builds no longer bundle `resources/bin`.
- [ ] **RUNTIME-BOOT-003**: Introduce a central runtime path resolution layer so no service resolves executable paths ad hoc.
  Scope: create one authoritative service/helper for runtime path resolution across all native services and model runtimes, with the same managed runtime contract in development and packaged modes.
  Targets: `src/main/services/system/**`, `src/main/services/llm/**`, `src/main/services/data/**`, `src/main/services/security/**`, `src/main/services/proxy/**`.
  Deliverables: `RuntimePathService` or equivalent contract, binary name normalization per OS, one runtime-root policy across dev/prod, and a migration plan for current direct `resources/bin`/`process.cwd()` assumptions.
  Progress 2026-03-11: a central runtime path layer now resolves managed runtime locations under `%APPDATA%/Tengra/runtime`; `ProcessManagerService`, proxy launch, llama launch, and local image temp/runtime paths no longer resolve primary binaries from `resources/bin`, `process.resourcesPath`, or repo-relative temp folders.
- [ ] **RUNTIME-BOOT-004**: Define the runtime artifact and release manifest specification used to download binaries from GitHub releases.
  Scope: standardize naming, versioning, hashing, archive formats, platform/arch selectors, and compatibility metadata for all downloadable runtime components.
  Targets: `docs/architecture/**`, `scripts/**`, `.github/**`, `src/shared/types/**`, `src/shared/schemas/**`.
  Deliverables: artifact naming convention, manifest schema, checksum/signature policy, GitHub release structure, compatibility metadata for `win32/darwin/linux` and `x64/arm64`, and upgrade/downgrade rules.
  Progress 2026-03-11: shared runtime manifest constants, types, and Zod schema now exist, and `docs/architecture/MANAGED_RUNTIME.md` documents the initial artifact naming convention plus required manifest fields.
- [ ] **RUNTIME-BOOT-005**: Build a runtime bootstrap orchestration service that detects, downloads, verifies, installs, and repairs managed runtime components.
  Scope: centralize first-run preparation and repair/update flows instead of letting feature services perform their own installation or runtime fetching logic.
  Targets: `src/main/services/system/**`, `src/main/startup/**`, `src/main/ipc/**`, `src/shared/types/**`, `src/shared/schemas/**`.
  Deliverables: bootstrap state machine, runtime install plan builder, download/extract/verify pipeline, checksum enforcement, partial-failure recovery, and stable result objects for UI and logs.
  Progress 2026-03-11: `RuntimeBootstrapService` now covers the install-plan phase by classifying manifest components as `ready`, `install`, `external`, or `unsupported` for the current platform/arch; download/extract/repair execution remains next.
- [ ] **RUNTIME-BOOT-006**: Add a runtime health and readiness layer that can validate binaries before dependent services attempt to launch.
  Scope: formalize file existence, version, executable permission, process startability, service port readiness, and repairability checks for each managed component.
  Targets: `src/main/services/system/**`, `src/main/services/data/**`, `src/main/services/llm/**`, `src/main/services/security/**`, `src/main/services/proxy/**`.
  Deliverables: health probe contracts per component, readiness result types, port/process verification helpers, stale runtime detection, and repair recommendations surfaced to startup and UI.
- [ ] **RUNTIME-BOOT-007**: Refactor native service launch flows to depend on the runtime manager instead of directly assuming bundled binaries already exist.
  Scope: update database, token, model, quota, memory, llama, and related service launchers so they request resolved executable paths from the central runtime layer.
  Targets: `src/main/services/system/process-manager.service.ts`, `src/main/services/data/**`, `src/main/services/security/**`, `src/main/services/proxy/**`, `src/main/services/llm/**`.
  Deliverables: runtime-aware start contracts, removed hardcoded path resolution from feature services, stable persistent-service behavior, and migration notes for remaining legacy launchers.
  Progress 2026-03-11: native build output and Windows helper scripts now seed/read the managed runtime bin directory instead of `resources/bin`; remaining work is to route download/bootstrap/update flows through the same contract and remove remaining repo-relative temp/runtime assumptions.
- [ ] **RUNTIME-BOOT-008**: Design and implement first-run bootstrap UX in the Electron app instead of relying on an external installer.
  Scope: provide a clean user-facing flow for prerequisite scanning, permission requests, progress reporting, retry/repair, optional component skipping, and launch gating.
  Targets: `src/renderer/features/**`, `src/main/ipc/**`, `src/main/preload/**`, `src/shared/types/**`, `src/shared/schemas/**`.
  Deliverables: first-run bootstrap screen(s), progress/state model, permission prompts, retry/repair actions, localized user-facing copy, and a safe transition into the main app after readiness succeeds.
- [ ] **RUNTIME-BOOT-009**: Standardize handling of external prerequisites such as Ollama so detection, consent, install guidance, and startup are explicit and cross-platform aware.
  Scope: separate bundled Tengra-managed runtimes from truly external dependencies and give each a clear detection and remediation policy per OS.
  Targets: `src/main/startup/ollama.ts`, `src/main/services/llm/**`, `src/main/ipc/**`, `src/renderer/features/**`, `docs/architecture/**`.
  Deliverables: external dependency policy, OS-specific detection strategy, explicit consent flow, install/open/download strategy, and a clear distinction between `required`, `optional`, and `user-managed` components.
- [ ] **RUNTIME-BOOT-010**: Build runtime update and repair workflows for already-installed applications.
  Scope: support version checks, runtime replacement, cache invalidation, rollback boundaries, and user-invoked repair without reinstalling the whole app package.
  Targets: `src/main/services/system/**`, `src/main/ipc/**`, `src/renderer/features/settings/**`, `src/shared/types/**`.
  Deliverables: runtime version registry, update policy, repair action flow, stale archive cleanup, rollback safety rules, and settings/debug surfaces for runtime maintenance.
- [ ] **RUNTIME-BOOT-011**: Add automated test coverage for runtime path resolution, manifest parsing, bootstrap orchestration, and service launch compatibility.
  Scope: prevent regressions across dev, packaged, and cross-platform behaviors by testing the orchestration layer independently from the UI.
  Targets: `src/tests/main/**`, `src/tests/renderer/**`, `src/tests/integration/**`, `scripts/**`.
  Deliverables: resolver unit tests, manifest/schema tests, bootstrap state machine tests, service-launch compatibility tests, and packaged-vs-dev scenario coverage.
  Progress 2026-03-11: `src/tests/main/services/system/runtime-path.service.test.ts` now covers the managed runtime root/bin/models/temp contract and executable-name normalization.
- [ ] **RUNTIME-BOOT-012**: Document the final runtime architecture, contributor workflow, and release responsibilities for shipping managed runtimes safely.
  Scope: make runtime packaging, release generation, bootstrap behavior, fallback policy, and troubleshooting explicit for future contributors and release engineering.
  Targets: `docs/architecture/**`, `.codex/**`, `TODO.md`, release documentation.
  Deliverables: architecture doc, release runbook, troubleshooting guide, contributor rules for adding new binaries, and a post-launch cleanup checklist for legacy path assumptions.
  Progress 2026-03-11: `docs/architecture/MANAGED_RUNTIME.md` now captures the current managed runtime contract, binary ownership map, and contributor rules for new runtime binaries.
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
- [ ] **PERF-002**: Introduce startup and bundle budgets for renderer chunks, preload bundle size, and main-process initialization time.
  Scope: establish measurable performance budgets and fail fast when builds or startup regress beyond set thresholds.
  Targets: `package.json`, `scripts/tool.js`, `scripts/**`, `vite.config.ts`, `vitest.config*.ts`, `src/main/startup/**`.
  Deliverables: budget config, build-time reporting, startup telemetry metrics, and threshold enforcement.
- [ ] **DATA-001**: Document and test canonical boundaries between Workspace, Memory, Chat, and Automation Workflow data models.
  Scope: make domain ownership explicit so future refactors do not cross-contaminate data responsibilities.
  Targets: `docs/architecture/DATA_MODEL.md`, `src/shared/types/**`, `src/main/services/data/**`, `src/tests/main/**`.
  Deliverables: boundary matrix, updated data model docs, and contract tests for key domain edges.
  
## ⚡ Performance Optimization Program

### P0 - High ROI Optimization Pass
- [ ] **OPT-001**: Add baseline performance instrumentation for startup, idle CPU, renderer memory, main-process memory, and feature-level hot paths before changing behavior.
  Scope: measure current performance so optimization work is driven by evidence instead of guesswork.
  Targets: `src/main/services/analysis/**`, `src/main/ipc/performance.ts`, `src/main/ipc/metrics.ts`, `src/renderer/features/showcase/**` or a new diagnostics panel, `scripts/tool.js`.
  Deliverables: baseline metrics dashboard/report, startup timing capture, idle CPU checklist, memory snapshots, and a repeatable profiling workflow.
- [x] **OPT-002**: Make startup service initialization aggressively lazy so only core services initialize on app launch and heavy domains load on first use.
  Scope: reduce startup CPU/RAM by deferring non-essential services such as `workspace`, `ssh`, `docker`, `memory`, `extension`, and heavy workflow services.
  Targets: `src/main/startup/**`, `src/main/services/**`, `src/main/ipc/lazy-services.ts`, `src/main/startup/services.ts`.
  Deliverables: startup service classification (`core`, `deferred`, `on-demand`), lazy initialization paths, and reduced cold-start resource usage.
- [x] **OPT-003**: Expand renderer-side code splitting and lazy loading so heavy feature bundles are only loaded when their screens/tabs are opened.
  Scope: defer loading of large UI modules such as `WorkspacePage`, `AutomationWorkflow`, `Models`, `Memory`, editors, graph views, markdown/math tooling, and terminal-heavy surfaces.
  Targets: `src/renderer/components/lazy/**`, `src/renderer/features/**`, `vite.config.ts`, `src/renderer/views/**`.
  Deliverables: new lazy boundaries, smaller initial renderer payload, and documented chunk ownership by feature.
- [/] **OPT-004**: Reduce idle CPU usage by throttling or suspending watchers, timers, health polling, telemetry loops, and background jobs when the app or feature is inactive.
  Scope: audit all recurring work and make it adaptive to visibility, focus, active workspace state, and idle/minimized conditions.
  Targets: `src/main/services/system/**`, `src/main/services/analysis/**`, `src/main/services/workspace/**`, `src/main/services/llm/**`, `src/renderer/hooks/**`.
  Deliverables: reduced idle polling cadence, pause/resume logic for background jobs, and measurable idle CPU improvements.
  Progress 2026-03-12: implemented `PowerManagerService` for window-focus based throttling and service hibernation (e.g. Ollama GPU monitoring) after inactivity. Added `LowPowerContext` for adaptive renderer intervals.
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
