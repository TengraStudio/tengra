
# Tengra Project - Comprehensive TODO List

> Last updated: 2026-02-27
> **Total Tasks: 1020+** | **Status: In Development**

## Release Milestones

### v1.3.0 (Target: Q2 2026)
- [/] Marketplace system MVP (C++ Backend initialized)
- ( ) HuggingFace model integration
- ( ) Agent collaboration improvements
- ( ) Performance optimizations

### Marketplace Infrastructure
- [x] **MKT-CORE-001**: Initialize C++ Backend (Drogon framework).
- [x] **MKT-CORE-002**: Define Marketplace Database Schema (PostgreSQL).
- [x] **MKT-CORE-003**: Configure Redis caching layer.
- [x] **MKT-CORE-004**: Set up PM2 Process Management.
- [x] **MKT-AUTH-001**: Implement Secure User Registration & Login (C++).
- [x] **MKT-SUB-001**: Implement Extension Submission System (GitHub URL).
- [x] **MKT-ADMIN-001**: Build Admin Dashboard for Submissions.
- (x) **MKT-DATA-10**: Add ready prompt/theme catalogs to marketplace DB and moderation flow.
- (x) **MKT-DISC-20**: Add advanced marketplace filtering dimensions (type/provider/license/language/trust/runtime).
- (x) **MKT-DISC-21**: Add expanded sorting strategies (trend/quality/trust/install-success).
- (x) **MKT-UX-30**: User interaction layer (ratings, reviews, favorites, follows, reports) [TODO].
- ( ) **LOCAL-03**: Hardware-aware model fit estimator (llmfit-style TPS/compatibility recommendations).

### Frontend Hardening & Completion (website/tengra-frontend)
- [x] **MKT-FE-001**: Remove hardcoded backend URLs and standardize API base usage (`VITE_API_BASE_URL`).
- [x] **MKT-FE-002**: Replace marketplace mock list with live backend API data (no hardcoded content).
- [x] **MKT-FE-003**: Move all admin/auth/submission user-facing strings into i18n dictionaries.
- [x] **MKT-FE-004**: Strengthen admin gate UX with backend-driven auth check and explicit unauthorized state.
- [x] **MKT-FE-005**: Add admin panel quality features (empty states, retry flow, pagination, filter/sort).
- [x] **MKT-FE-006**: Add analytics delivery resilience (retry/queue, offline-safe flush, error budget).
- [x] **MKT-FE-007**: Upgrade bot/human detection signal model in tracker payload.
- [x] **MKT-FE-008**: Add admin audit-log page (approval/reject timeline with actor and reason).
- [x] **MKT-FE-009**: Add marketplace submission-detail page (review metadata and moderation notes).
- [x] **MKT-FE-010**: Add status page for website/backend/database uptime and incident timeline.
- [x] **FE-WIZ-001**: Redesign Project Wizard Modal for better clarity and premium aesthetics.



### v1.4.0 (Target: Q3 2026)
- ( ) Extension system beta
- ( ) ComfyUI integration
- ( ) SSH tunneling
- ( ) Advanced memory features

### Backlog Range: BACKLOG-0501 to BACKLOG-0510 (Project Health & Maintenance)
- [x] **BACKLOG-0501**: Resolve Namespace Confusion: Rename `src/services` (Rust workspace) to `src/native`.
- [x] **BACKLOG-0502**: Consolidate Testing Structures: Move `src/test/setup.ts` to `src/tests/` and remove redundant `src/test/`.
- [x] **BACKLOG-0503**: Modularize Preload Script: Split the oversized `src/main/preload.ts` into modular fragments within `src/main/preload/`.
- [x] **BACKLOG-0504**: Enforce Component Promotion Rules: Promoted feature-local CodeMirror editor to global UI as CodeMirrorEditor.
- [x] **BACKLOG-0505**: Root Directory Hygiene: Moved build/test error logs to `logs/` directory.
- [x] **BACKLOG-0506**: Build Artifact Hygiene: Verified `stats.html` generation in `dist/`.
- (x) **BACKLOG-0507**: Website Submodule Integration: Remove `website/tengra-*` from root `.gitignore` and properly integrate as git submodules or manage separately.
- (x) **BACKLOG-0508**: Documentation Reorganization: Group files in `docs/` into subdirectories (`architecture`, `api`, `guides`, `tasks`).

### Security & Stability Hardening
- [x] **SEC-STAB-01**: Fix critical infinite re-render loop in `ViewManager` (React Error #185).
- [x] **SEC-STAB-02**: Harden Electron Content Security Policy (CSP) with robust sources and headers.
- [x] **SEC-STAB-03**: Consolidate CSP management into Main process and remove redundant meta tags.
- [x] **SEC-STAB-04**: Restrict WebContents navigation to trusted origins and local files.
- [x] **SEC-STAB-05**: Strict Type Safety: Resolve unsafe 'any' and 'unknown' type casts across renderer components.

### v2.0.0 (Target: Q4 2026)
- ( ) Plugin ecosystem
- ( ) Collaborative sessions
- ( ) Performance dashboard
- ( ) Mobile companion app

---

## March 1, 2026 Critical Path (AI-Assisted Mini Code Editor)

Deadline note: This block is the must-ship scope for **March 1, 2026**.

- ( ) **MARCH1-CORE-001**: Ship workspace-integrated AI chat end-to-end (send, stream, cancel, retry, model switch, persistence).
  - ( ) Verify chat flow in workspace panel uses production IPC (`chat:stream`) and not mock paths.
  - ( ) Add regression tests for chat stream lifecycle (start/chunk/done/cancel/error) across provider types.
  - ( ) Add failure-state UX for provider unavailable / quota exhausted / timeout.
- ( ) **MARCH1-COUNCIL-001**: Implement "Council President" orchestration flow with explicit pre-execution approval.
  - ( ) Generate plan + stages before execution.
  - ( ) Present selected models/accounts/stage routing to user and require explicit approve/reject.
  - ( ) Persist approved plan version and execution config to DB for resume/audit.
- ( ) **MARCH1-COUNCIL-002**: Implement quota-aware account/model selection strategy.
  - ( ) Query linked account quotas before assignment.
  - ( ) Prefer highest-available quota account(s) with capability match.
  - ( ) Add deterministic fallback policy when multiple accounts/models are eligible.
- ( ) **MARCH1-COUNCIL-003**: Enable dynamic reassignment and teamwork.
  - ( ) If an agent finishes early, allow reassignment to pending/blocked steps.
  - ( ) Enable inter-agent discussion channel for coordination and conflict resolution.
  - ( ) Add operator-visible timeline of assignments/reassignments.
- ( ) **MARCH1-COUNCIL-004**: Add user-controlled model governance.
  - ( ) Let user force allowed/blocked model list per task before start.
  - ( ) Enforce guardrails so runtime routing stays inside user-approved model set.
- ( ) **MARCH1-RESUME-001**: Guarantee crash-safe continuation.
  - ( ) Persist full execution state on important transitions (planning, approval, step start/end, reassignment).
  - ( ) On app relaunch, restore active tasks and continue from last consistent checkpoint.
  - ( ) Validate rollback/resume path with integration tests.
- (x) **MARCH1-RESUME-002**: Continue execution after quota exhaustion.
  - (x) Detect quota exhaustion as a first-class interrupt reason.
  - (x) Auto-switch to next eligible account/model and continue step/task (auto-resume attempt after switch).
  - (x) Surface user notification baseline: emit `project:quota-interrupt` event to renderer on forced switch.
  - (x) Surface in-app user notification UI for every forced provider/model switch.
  - (x) Emit structured `QUOTA_EXHAUSTED` interrupt (`taskId`, `stageId`, `provider`, `model`, `reason`, `timestamp`).
  - (x) Take immediate checkpoint on interrupt before any routing action.
  - (x) Compute deterministic fallback chain from user-approved model/account set.
  - (x) Continue from same stage checkpoint (no full-plan restart).
  - (x) If no fallback candidate exists, mark task as `blocked_by_quota` and require user action.
  - (x) Persist interrupt + switch decisions to timeline/audit logs.
  - (x) Add integration test: quota exhaustion -> checkpoint -> auto switch -> same-stage continuation.
- ( ) **MARCH1-QUALITY-001**: Stabilize project-agent operational gaps blocking March 1 launch.
  - (x) Replace stubbed `saveSnapshot` behavior with real checkpoint persistence return values.
  - (x) Replace stubbed telemetry/events endpoints with backed data for task diagnostics.
  - (x) Ensure orchestrator/council IPC surface is actively wired in renderer or remove dead paths.

### March 1 Detailed Execution Plan (Project System)

- ( ) **MARCH1-CHAT-IMPLEMENTATION-001**: AI chat system (workspace integrated) full implementation.
  - ( ) Define transport contract:
    - ( ) Finalize request schema for `chat:stream` (`taskId`, `projectId`, `messages`, `model`, `temperature`, `tools`).
    - ( ) Finalize stream event schema (`start`, `chunk`, `tool_call`, `tool_result`, `done`, `error`, `cancelled`).
    - ( ) Add strict response validation and typed bridge updates in preload + renderer.
  - ( ) Implement backend chat runtime:
    - ( ) Add provider adapter selection (OpenAI/Anthropic/Ollama/Copilot).
    - ( ) Add timeout, retry, and cancellation token handling per provider call.
    - ( ) Persist chat events incrementally to DB for crash-safe recovery.
  - ( ) Implement renderer chat UX:
    - ( ) Stream tokens in real-time with stable scroll behavior.
    - ( ) Add `Cancel`, `Retry`, `Switch Model` actions on active/failed messages.
    - ( ) Show provider/model badge and latency/cost metadata per message.
  - ( ) Recovery and resume:
    - ( ) On app restart, restore unfinished streams as `interrupted`.
    - ( ) Allow user to continue interrupted thread from last persisted message.
  - ( ) Tests and release gate:
    - ( ) Unit tests for stream state machine.
    - ( ) Integration tests for cancellation/retry/provider fallback.
    - ( ) Manual QA checklist for 5 scenarios (normal, timeout, quota end, provider down, app restart).

- ( ) **MARCH1-COUNCIL-IMPLEMENTATION-001**: Council President orchestration system end-to-end.
  - ( ) Planning phase:
    - ( ) Generate plan with explicit stages, dependencies, and acceptance criteria.
    - ( ) Estimate token/time budget per stage.
    - ( ) Produce candidate model/account routing for each stage.
  - ( ) User approval phase (mandatory):
    - ( ) Render pre-execution approval screen showing:
      - ( ) Stage list and expected outputs.
      - ( ) Selected models/accounts and fallback chain.
      - ( ) Estimated cost/time and risk notes.
    - ( ) Add `Approve` / `Reject` / `Edit Constraints` actions.
    - ( ) Block execution unless user approves exact plan version.
  - ( ) Execution phase:
    - ( ) Assign stages to agent workers.
    - ( ) Track per-worker heartbeat and progress.
    - ( ) Enable dynamic reassignment when worker finishes early.
    - ( ) Enable worker-to-worker coordination channel.
  - ( ) Supervision phase:
    - ( ) Council President validates each worker output against acceptance criteria.
    - ( ) Auto-request fix if criteria fail.
    - ( ) Escalate to user if repeated failures exceed threshold.
  - ( ) Persistence phase:
    - ( ) Persist plan version, assignment map, and live stage state at each transition.
    - ( ) Persist council chat/decision logs for audit and resume.

- ( ) **MARCH1-QUOTA-ROUTING-001**: Quota-aware model/account routing implementation.
  - ( ) Build quota snapshot service:
    - ( ) Read linked accounts and live remaining quota.
    - ( ) Normalize quotas to comparable units (token/time/request).
  - ( ) Build routing algorithm:
    - ( ) Primary strategy: highest quota + capability match.
    - ( ) Tie-breakers: latency, reliability score, price.
    - ( ) Deterministic fallback order if primary fails.
  - ( ) Runtime failover:
    - ( ) Detect quota exhaustion as typed interrupt event.
    - ( ) Auto-switch to next eligible model/account.
    - ( ) Resume same stage without losing context/state.
  - ( ) User control:
    - ( ) Respect user `allowedModels` / `blockedModels`.
    - ( ) Show forced switch notification with reason and selected fallback.

- ( ) **MARCH1-MULTI-AGENT-TEAMWORK-001**: Multi-agent collaboration features.
  - ( ) Implement agent bus:
    - ( ) Structured inter-agent message format (`from`, `to`, `taskId`, `stageId`, `intent`, `payload`).
    - ( ) Priority lanes for blocker/help messages.
  - ( ) Implement help protocol:
    - ( ) Early-finishing worker requests pending stage queue.
    - ( ) Council President reassigns subtask with clear acceptance criteria.
    - ( ) Merge helper output with original owner output via reviewer agent.
  - ( ) Implement conflict protocol:
    - ( ) If agent outputs disagree, trigger debate/reviewer step.
    - ( ) Store rationale and final resolution in timeline.

- ( ) **MARCH1-STATE-RECOVERY-001**: Crash-safe state and continuation.
  - ( ) Persist state checkpoints on every critical transition:
    - ( ) plan_created, plan_approved, stage_started, stage_completed, reassigned, model_switched, error_raised.
  - ( ) Startup recovery flow:
    - ( ) Detect unfinished tasks.
    - ( ) Reconstruct in-memory queues and worker ownership.
    - ( ) Continue from last consistent checkpoint.
  - ( ) Recovery validation:
    - ( ) Integration test: close app mid-stage, reopen, continue.
    - ( ) Integration test: quota exhaustion -> fallback -> continue.
    - ( ) Integration test: provider outage -> reroute -> continue.

### March 1 Expanded Backlog (Meclis Sistemi - Detailed)

- (x) **MARCH1-ARCH-001**: Council architecture freeze and boundaries.
  - (x) Finalize component boundaries: President, Planner, Router, Worker, Reviewer, Recovery.
  - (x) Define responsibilities and no-overlap rules per component.
  - (x) Add architecture decision record (ADR) for council execution model.
  - (x) Define failure domains and fallback ownership.

- (x) **MARCH1-DATA-001**: Database schema for council/task lifecycle.
  - (x) Add `council_plans` table (planVersion, userConstraints, estimatedCost, approvedAt).
  - (x) Add `council_plan_stages` table (stageId, dependencies, assignedAgent, status, acceptanceJson).
  - (x) Add `council_assignments` table (agentId, stageId, assignedAt, reassignedFrom).
  - (x) Add `council_decisions` table (decisionType, reason, actor, createdAt).
  - (x) Add `council_interrupts` table (quota_exhausted, provider_down, timeout, crash_resume).
  - (x) Add DB indexes for `taskId`, `status`, `updatedAt`, `stageId`.

- ( ) **MARCH1-DATA-002**: Event sourcing and timeline durability.
  - ( ) Define canonical event types (`PLAN_CREATED`, `PLAN_APPROVED`, `STAGE_STARTED`, `MODEL_SWITCHED`, `TASK_RESUMED`).
  - ( ) Persist immutable event log with sequence numbers.
  - ( ) Implement replay mechanism to reconstruct state from events.
  - ( ) Add compaction/snapshot policy for long-running tasks.

- ( ) **MARCH1-IPC-001**: Council IPC contract completion.
  - ( ) Add `project:council-generate-plan`.
  - ( ) Add `project:council-get-proposal`.
  - ( ) Add `project:council-approve-proposal`.
  - ( ) Add `project:council-reject-proposal`.
  - ( ) Add `project:council-start-execution`.
  - ( ) Add `project:council-pause-execution`.
  - ( ) Add `project:council-resume-execution`.
  - ( ) Add `project:council-get-timeline`.
  - ( ) Add typed preload bridge and renderer API wrappers for all channels.

- (x) **MARCH1-IPC-002**: Streaming and event contract hardening.
  - (x) Standardize event payload schemas with versioning (`v1`, `v2` compatibility policy).
  - (x) Add max event frequency throttle for high-volume streams.
  - (x) Add event deduplication key to prevent duplicate UI updates after resume.
  - (x) Add IPC integration tests for every council endpoint.

- (x) **MARCH1-UX-APPROVAL-001**: Pre-execution approval UX (zorunlu onay ekranı).
  - (x) Build "Execution Proposal" panel with plan stages and dependencies graph.
  - (x) Show selected model/account per stage with fallback chain visibility.
  - (x) Show quota impact and estimated finish time.
  - (x) Add explicit confirmation checkbox ("I approve this plan and model usage").
  - (x) Disable run button until explicit approval.
  - (x) Save rejected proposals with rejection reason history.

- (x) **MARCH1-UX-RUNTIME-001**: Live runtime monitoring UX.
  - (x) Build live assignment board (which agent is working on which stage).
  - (x) Build agent health panel (heartbeat, last output time, failure count).
  - (x) Add "forced reroute" notification center entries.
  - (x) Add timeline filters (stage, agent, model, interrupt type).
  - (x) Add "manual intervention" action button per blocked stage.

- ( ) **MARCH1-AGENT-PROTOCOL-001**: Agent-to-agent communication protocol.
  - (x) Define intents (`REQUEST_HELP`, `SHARE_CONTEXT`, `PROPOSE_CHANGE`, `BLOCKER_REPORT`).
  - (x) Define message priority and expiry policy.
  - (x) Implement routed private channel (agent-to-agent) and group channel (all workers).
  - (x) Add transcript tracking + moderation baseline rules (in-memory channel log, payload size/length limits).
  - (x) Add anti-loop rule: repeated same request > N times triggers President intervention.
  - (x) Persist collaboration transcript to DB and restore on restart.

- (x) **MARCH1-ASSIST-001**: Early-finish helper flow.
  - (x) Detect idle/finished workers and register availability.
  - (x) Implement helper assignment scoring (skill match + context readiness).
  - (x) Implement helper handoff package generator (context summary + acceptance criteria + constraints).
  - (x) Implement merge-review gate before helper contribution is accepted.

- ( ) **MARCH1-QUOTA-ENGINE-002**: Real quota engine and account governance.
  - ( ) Pull quota status from all linked accounts at planning and runtime checkpoints.
  - ( ) Add quota freshness timeout; stale quota must trigger refresh before routing.
  - ( ) Implement account lock when provider reports hard-limit reached.
  - ( ) Implement account cooldown for transient rate limits.
  - ( ) Add user-facing policy toggle: "Prefer cheapest" vs "Prefer highest quota" vs "Prefer fastest".

- ( ) **MARCH1-MODEL-GOV-001**: User model governance (kullanıcı model seçimi).
  - ( ) Add per-task model allowlist UI.
  - ( ) Add per-task model denylist UI.
  - ( ) Add provider-level hard disable switches.
  - ( ) Enforce governance on planner + router + runtime fallback layers.
  - ( ) Emit audit log when governance blocks a candidate model.

- ( ) **MARCH1-VALIDATION-001**: Worker output verification and enforcement.
  - ( ) Add stage-level acceptance validator templates.
  - ( ) Add reviewer retry policy (`maxRetriesPerStage`).
  - ( ) Add structured fail report format (`failureType`, `evidence`, `suggestedFix`).
  - ( ) Add escalation threshold to President/user after repeated reviewer failures.

- ( ) **MARCH1-RECOVERY-OPS-001**: Recovery orchestration on app crash/close.
  - ( ) Persist in-flight context every N seconds and on every major transition.
  - ( ) On startup, run recovery scanner for unfinished tasks.
  - ( ) Reconcile DB state vs in-memory cache; choose authoritative source by sequence id.
  - ( ) Resume execution with deterministic ordering of pending stages.
  - ( ) Show "Recovered Session" banner with summary of resumed actions.

- ( ) **MARCH1-RECOVERY-OPS-002**: Quota exhaustion continuation path.
  - ( ) Trigger `QUOTA_EXHAUSTED` interrupt with structured metadata.
  - ( ) Persist interrupted stage context snapshot immediately.
  - ( ) Route to next eligible account/model from deterministic fallback chain.
  - ( ) Continue same stage and tag timeline with `forced_model_switch`.
  - ( ) Notify user with before/after model-account details.

- ( ) **MARCH1-SECURITY-001**: Security and guardrails for multi-agent execution.
  - ( ) Validate tool-call allowlist per stage and per model.
  - ( ) Prevent agent cross-task data leakage (task isolation checks).
  - ( ) Redact secrets from inter-agent and user-visible transcripts.
  - ( ) Add prompt injection detection for external tool/web content.
  - ( ) Add security audit log for privileged actions.

- ( ) **MARCH1-OBS-001**: Observability and operational metrics.
  - ( ) Add metrics: stage duration, reassignment count, fallback count, success/failure rates.
  - ( ) Add per-model reliability dashboard data feed.
  - ( ) Add cost telemetry per task and per stage.
  - ( ) Add alert thresholds for repeated fallback and repeated reviewer failures.
  - ( ) Add "time-to-first-plan" and "time-to-first-output" KPIs.

- ( ) **MARCH1-TEST-001**: Scenario-based E2E testing matrix.
  - ( ) Happy path: plan -> approval -> execution -> completion.
  - ( ) Reject flow: proposal rejected -> regenerate -> approve.
  - ( ) Quota-end flow: model switch and continuation.
  - ( ) Provider-down flow: reroute and continuation.
  - ( ) Crash flow: close app mid-stage and resume.
  - ( ) Multi-agent help flow: helper joins and merge accepted.
  - ( ) Governance flow: blocked model rejected and alternate chosen.

- ( ) **MARCH1-RELEASE-001**: Release readiness and fallback plan for March 1.
  - ( ) Define minimum shippable feature set (must-have vs can-slip).
  - ( ) Add feature flags for council modules (planning, routing, teamwork, recovery).
  - ( ) Add kill-switch for unstable providers/models.
  - ( ) Prepare rollback procedure and on-call playbook.
  - ( ) Final go/no-go checklist with owners and deadlines.

### Prompt Templates (Directly Usable)

- (x) **MARCH1-PROMPTS-001**: Add production prompt pack for council architecture.
  - (x) Council President (System Prompt):
```text
You are the Council President for a multi-agent coding system.
Goal: deliver the user's requested outcome with minimum risk and approved cost.
Rules:
1) Before execution, create a stage-by-stage plan with acceptance criteria per stage.
2) Select model/account per stage using quota + capability + user constraints.
3) Present plan, routing, fallbacks, and estimated cost/time to user.
4) Do not execute until explicit approval is received.
5) During execution, supervise workers, validate outputs, and reassign idle workers.
6) If quota/provider fails, switch to next eligible option and continue from checkpoint.
7) Persist every major transition for crash-safe recovery.
Output format (JSON):
{
  "planVersion": "string",
  "stages": [{ "id": "S1", "goal": "...", "acceptance": ["..."], "dependsOn": [] }],
  "routing": [{ "stageId": "S1", "model": "...", "account": "...", "fallback": ["...", "..."] }],
  "estimates": { "tokens": 0, "costUsd": 0, "durationMin": 0 },
  "requiresUserApproval": true
}
```
  - (x) Planner Agent (System Prompt):
```text
You are the Planner Agent.
Convert user request into atomic executable stages.
For each stage provide:
- objective
- inputs
- output contract
- acceptance checks
- risk notes
Hard constraints:
- no hidden assumptions
- explicit dependencies
- each stage must be independently testable
Output strict JSON only.
```
  - (x) Quota Router Agent (System Prompt):
```text
You are the Quota Router Agent.
Given stage requirements and account/model quota snapshot:
1) pick best model/account by capability + remaining quota + reliability.
2) produce deterministic fallback chain.
3) explain why rejected candidates were not selected.
Respect user allow/deny model list strictly.
Output strict JSON:
{ "selected": {...}, "fallbacks": [...], "rejections": [...] }
```
  - (x) Worker Agent (System Prompt):
```text
You are a Worker Agent.
Execute assigned stage only.
Do not change scope without asking Council President.
Return:
1) result
2) files changed
3) tests run
4) known limitations
If blocked, emit BLOCKED report with exact reason and requested help.
```
  - (x) Reviewer Agent (System Prompt):
```text
You are a Reviewer Agent.
Validate worker output against stage acceptance criteria.
Return verdict:
- PASS
- FAIL_WITH_FIXES
- ESCALATE_TO_USER
Include concrete evidence and minimal fix list.
```
  - (x) Helper Agent (System Prompt):
```text
You are a Helper Agent.
You assist a primary worker when reassigned.
Do not override ownership; produce merge-ready sub-results with clear boundaries.
Return exact handoff notes for the primary worker.
```
  - (x) Recovery Agent (System Prompt):
```text
You are a Recovery Agent.
Given checkpoint state after crash/interruption:
1) detect last consistent transition
2) rebuild pending queue and active ownership
3) produce safe resume plan
Never repeat completed irreversible actions.
Output strict JSON with resume steps.
```

- (x) **MARCH1-PROMPTS-002**: Add operator prompts (user-facing control actions).
  - (x) Approve plan prompt text.
  - (x) Reject plan prompt text with required reason.
  - (x) Manual model override prompt text.
  - (x) Continue after fallback confirmation prompt text.

---

## Quick Wins (Fast-Makeable)

Selected small/contained tasks that are realistic to ship quickly:

### Pending Quick Wins
  - [x] `src/main/ipc/mcp-marketplace.ts` (`registerMcpMarketplaceHandlers`)
  - [/] `src/renderer/features/projects/components/ProjectWorkspace.tsx`
  - [x] `src/renderer/features/settings/components/ImageSettingsTab.tsx`
  - ( ) Applied targeted lint override to unblock quality gate; follow-up refactor remains.
- [x] **AUD-2026-02-20-08**: Refactor oversized legacy functions in marketplace/workspace/image settings to remove file-specific lint override and improve maintainability.
  - [x] `src/renderer/features/extensions/hooks/useExtensions.ts`
  - [x] `src/renderer/features/projects/hooks/useAgentHandlers.ts`
  - [x] `src/renderer/features/projects/hooks/useWorkspaceManager.ts`
  - [x] `src/shared/utils/extension.util.ts`
- (x) **AUD-2026-02-20-06**: Resolve npm audit backlog (39 vulnerabilities: 35 high / 4 moderate) via phased dependency upgrades (`electron-builder`, `eslint`, `@electron/rebuild`, `typescript-eslint`).
- (x) **AUD-2026-02-20-07**: Investigate `npm run build` timeout in CI/dev shell and document stable timeout/memory settings for local and GitHub Actions.
---

## High Priority

Owner tags:
- [owner:platform-ipc] IPC + contract safety tasks
- [owner:marketplace-core] Marketplace backend/services tasks
- [owner:renderer-experience] Marketplace UI/UX tasks
- [owner:quality-automation] Test and quality gate tasks

### Marketplace System (VSCode-style Extensions)

#### Core Infrastructure & Centralization
- ( ) **MKT-INFRA-09**: Implement Centralized Marketplace Indexer Service (VPS-side).
  - ( ) Migrate HF/Ollama scraping from client-side to VPS for improved privacy and performance.
  - ( ) Build automated metadata crawler for extensions, prompts, and model presets.
  - ( ) Create secure REST API for model discovery and searching.
  - ( ) Implement caching layer for fast search results across all clients.

#### UI Components
  - Location: `src/renderer/features/marketplace/`
  - ( ) Create responsive grid layout
  - ( ) Add category navigation sidebar
  - ( ) Implement featured extensions carousel
  - ( ) Add trending extensions section
  - ( ) Create recently updated section
  - ( ) Add personalized recommendations
  - ( ) Implement search with filters

  - ( ) Display rating, download count, description
  - ( ) Add install/uninstall button states
  - ( ) Show compatibility indicators
  - ( ) Add screenshot preview gallery
  - ( ) Implement hover preview
  - ( ) Add quick actions menu
  - ( ) Show update available badge

  - ( ) Full-text search across extensions
  - ( ) Filter by categories and tags
  - ( ) Sort by popularity, rating, recent updates
  - ( ) Save search preferences
  - ( ) Add search suggestions
  - ( ) Implement search history
  - ( ) Add advanced search syntax

  - ( ) README rendering with markdown support
  - ( ) Reviews and ratings section
  - ( ) Version history and changelog
  - ( ) Related extensions suggestions
  - ( ) Add dependency tree view
  - ( ) Show permission requirements
  - ( ) Add installation statistics

  - ( ) List all installed extensions
  - ( ) Update all / update individual
  - ( ) Configure extension settings
  - ( ) View extension logs
  - ( ) Add extension diagnostics
  - ( ) Show extension resource usage
  - ( ) Implement extension profiles

  - ( ) Show installation progress
  - ( ) Display permission requests
  - ( ) Add configuration steps
  - ( ) Show installation summary

  - ( ) Add star rating component
  - ( ) Create review form
  - ( ) Show rating distribution
  - ( ) Add helpful vote system

  - ( ) Side-by-side comparison
  - ( ) Feature matrix
  - ( ) Rating comparison
  - ( ) Download statistics

#### Extension Types
  - ( ) Allow custom MCP server implementations
  - ( ) Provide SDK for MCP server development
  - ( ) Add MCP server configuration UI
  - ( ) Create MCP server templates
  - ( ) Add MCP server debugging
  - ( ) Implement MCP server testing
  - ( ) Add MCP server documentation generator

  - ( ) Custom color schemes and UI themes
  - ( ) Icon packs and font options
  - ( ) Syntax highlighting themes
  - ( ) Add theme preview
  - ( ) Implement theme mixing
  - ( ) Add theme import/export
  - ( ) Create theme editor

  - ( ) Custom slash commands for chat
  - ( ) Keyboard shortcut bindings
  - ( ) Command palette integration
  - ( ) Add command autocomplete
  - ( ) Implement command chaining
  - ( ) Add command history
  - ( ) Create command builder UI

  - ( ) Language server protocol support
  - ( ) Custom syntax highlighting
  - ( ) Code formatter integration
  - ( ) Add language detection
  - ( ) Implement multi-language support
  - ( ) Add language-specific tools
  - ( ) Create language configuration

  - ( ) Pre-configured agent personas
  - ( ) Custom tool configurations
  - ( ) Agent behavior modifiers
  - ( ) Add template marketplace
  - ( ) Implement template sharing
  - ( ) Add template versioning
  - ( ) Create template builder

  - ( ) Custom dashboard widgets
  - ( ) Sidebar panels
  - ( ) Status bar items
  - ( ) Add widget configuration
  - ( ) Implement widget communication
  - ( ) Add widget theming
  - ( ) Create widget gallery

  - ( ) External service integrations
  - ( ) Webhook handlers
  - ( ) API connectors
  - ( ) Add OAuth flow support
  - ( ) Implement credential management
  - ( ) Add integration testing
  - ( ) Create integration templates

#### Security
  - ( ) Implement code signing for extensions
  - ( ) Verify signatures before installation
  - ( ) Add trusted publisher system
  - ( ) Create signing key management
  - ( ) Add signature revocation
  - ( ) Implement certificate pinning
  - ( ) Add signature timestamping

  - ( ) Isolate extension code from main process
  - ( ) Resource usage limits (CPU, memory, time)
  - ( ) Network request filtering
  - ( ) Add sandbox escape detection
  - ( ) Implement sandbox logging
  - ( ) Add sandbox configuration
  - ( ) Create sandbox testing tools

  - ( ) Automated security scanning
  - ( ) Manual review process for new extensions
  - ( ) Report malicious extension
  - ( ) Add vulnerability database
  - ( ) Implement dependency scanning
  - ( ) Add security score
  - ( ) Create security advisory system

  - ( ) Verified purchase/download reviews
  - ( ) Rating aggregation and display
  - ( ) Review moderation
  - ( ) Add review helpfulness voting
  - ( ) Implement review spam detection
  - ( ) Add review response system
  - ( ) Create review analytics

  - ( ) Optional usage analytics
  - ( ) Automatic crash report submission
  - ( ) Performance metrics collection
  - ( ) Add telemetry opt-out
  - ( ) Implement data anonymization
  - ( ) Add telemetry dashboard
  - ( ) Create compliance reporting

#### Developer Experience
  - ( ) Add development server with hot reload
  - ( ) Create extension testing framework
  - ( ) Add extension debugging tools
  - ( ) Implement extension profiling
  - ( ) Add extension documentation generator

- ( ) **MKT-DEV-02**: Extension developer documentation
  - ( ) Getting started guide
  - ( ) API reference
  - ( ) Best practices
  - ( ) Example extensions
  - ( ) Add video tutorials
  - ( ) Create API playground
  - ( ) Add interactive examples

- [x] **MKT-DEV-03**: Local extension development mode
  - [x] Hot reload for local extensions
  - [x] Debug logging and inspection
  - [x] Extension DevTools panel
  - ( ) Add extension reload shortcut
  - ( ) Implement extension state inspection
  - ( ) Add performance profiling
  - ( ) Create memory debugging

- ( ) **MKT-DEV-04**: Extension publishing workflow
  - ( ) CLI publish command
  - ( ) Version validation
  - ( ) Automated testing before publish
  - ( ) Add publishing checklist
  - ( ) Implement release notes generation
  - ( ) Add publishing preview
  - ( ) Create rollback capability

- ( ) **MKT-DEV-05**: Extension analytics dashboard
  - ( ) Download statistics
  - ( ) User engagement metrics
  - ( ) Error rate tracking
  - ( ) Add revenue tracking
  - ( ) Implement A/B testing
  - ( ) Add user demographics
  - ( ) Create custom reports

---

## Medium Priority

### Image Generation

  - Location: `src/main/services/llm/local-image.service.ts:407`
  - ( ) Add WebSocket connection to ComfyUI
  - ( ) Implement workflow execution
  - ( ) Handle workflow templates
  - ( ) Add workflow editor
  - ( ) Implement workflow sharing
  - ( ) Add workflow testing
  - ( ) Create workflow documentation

  - ( ) Store generated images with metadata
  - ( ) Allow regeneration with same parameters
  - ( ) Image comparison view
  - ( ) Add image search
  - ( ) Implement image export
  - ( ) Add image analytics
  - ( ) Create image testing

  - ( ) Inpainting/outpainting support
  - ( ) Image-to-image transformation
  - ( ) Style transfer
  - ( ) Add editing presets
  - ( ) Implement editing history
  - ( ) Add editing analytics
  - ( ) Create editing testing

  - Location: `src/renderer/features/chat/components/GalleryView.tsx`
  - ( ) Masonry layout
  - ( ) Image zoom and pan
  - ( ) Batch download
  - ( ) Add gallery search
  - ( ) Implement gallery filtering
  - ( ) Add gallery analytics
  - ( ) Create gallery testing

  - Location: `src/main/ipc/sd-cpp.ts`
  - ( ) Memory optimization for large models
  - ( ) Batch generation
  - ( ) Model switching without restart
  - ( ) Add performance monitoring
  - ( ) Implement model caching
  - ( ) Add generation queue
  - ( ) Create generation testing

  - ( ) Style presets
  - ( ) Size presets
  - ( ) Quality presets
  - ( ) Add preset sharing
  - ( ) Implement preset validation
  - ( ) Add preset analytics
  - ( ) Create preset testing

  - ( ) Queue management
  - ( ) Priority scheduling
  - ( ) Resource allocation
  - ( ) Add scheduling UI
  - ( ) Implement scheduling analytics
  - ( ) Add scheduling alerts
  - ( ) Create scheduling testing

  - ( ) Side-by-side comparison
  - ( ) Parameter comparison
  - ( ) Quality metrics
  - ( ) Add comparison export
  - ( ) Implement comparison sharing
  - ( ) Add comparison analytics
  - ( ) Create comparison testing

### SSH & Remote Development

  - SSH/remote development backlog items completed and removed.

---

## Low Priority / Future Enhancements

### Internationalization

  - ( ) Audit missing keys in all language files
  - ( ) Add context comments for translators
  - ( ) Implement translation memory


---

## Technical Debt

### Architecture

- ( ) **DEBT-01**: Migrate to React Server Components
  - ( ) Evaluate feasibility for Electron
  - ( ) Identify components for migration
  - ( ) Performance benchmarking

## Feature Requests

### User-Requested Features

  - ( ) Speech-to-text integration
  - ( ) Voice commands
  - ( ) Multi-language support
  - Progress: Speech-to-text and voice output foundations are implemented (`useSpeechRecognition`/`useVoiceInput`, `useTextToSpeech`, chat input/audio overlay wiring, and localized voice UI strings); explicit voice-command intent layer is still pending.

- ( ) **FEAT-02**: Add collaborative editing
  - ( ) Real-time collaboration
  - ( ) Presence indicators
  - ( ) Conflict resolution

  - ( ) Safe code execution
  - ( ) Multiple language support
  - ( ) Output visualization 

### New Ideas & Systems

- ( ) **AI-SYS-01**: Build a no-code "Create Your Own AI" Studio (local-first)
  - ( ) Create guided wizard: Goal -> Data -> Train -> Evaluate -> Deploy
  - ( ) Allow users to build assistants without writing code
  - ( ) Include template presets (Support bot, Research bot, Sales bot, Coding bot)
  - ( ) Add one-click local runtime setup (Ollama/llama.cpp profiles)
  - ( ) Save and version each user-created AI configuration

- ( ) **AI-SYS-02**: Add dataset onboarding and preparation pipeline
  - ( ) Upload files/folders/URLs and auto-ingest into a project dataset
  - ( ) Auto-cleaning and chunking pipeline with preview
  - ( ) PII/sensitive-data detection and redaction suggestions
  - ( ) Dataset quality score (coverage, duplicates, noise)
  - ( ) Dataset versioning and rollback

- ( ) **AI-SYS-03**: Add no-code training/fine-tuning workflows
  - ( ) Training mode selector (RAG, prompt-tuning, LoRA/fine-tune)
  - ( ) Hardware-aware profile picker (CPU/GPU/VRAM budget)
  - ( ) Estimated time/cost/resources before run
  - ( ) Start/pause/resume/cancel training jobs
  - ( ) Training artifacts registry and reproducibility metadata

- ( ) **AI-SYS-04**: Create evaluation and benchmark dashboard for custom AIs
  - ( ) Golden test set builder for user-defined tasks
  - ( ) Side-by-side model output comparison
  - ( ) Metrics: quality, latency, hallucination rate, cost
  - ( ) Regression alerts when performance drops
  - ( ) Exportable evaluation reports

- ( ) **AI-SYS-05**: Add AI deployment and packaging flow
  - ( ) Deploy custom AI as local app profile, API endpoint, or extension helper
  - ( ) Package/share AI bundles with dependencies and manifest
  - ( ) Environment checks before deployment (models, storage, permissions)
  - ( ) Rollback to previous deployed version
  - ( ) Health monitoring for deployed AIs

- ( ) **AI-SYS-06**: Build "AI Marketplace for User-Created AIs"
  - ( ) Publish private/public AI blueprints
  - ( ) Import community templates with compatibility checks
  - ( ) Rating/review and usage telemetry opt-in
  - ( ) Semantic search and category browsing
  - ( ) Trust/safety badges for verified templates

- ( ) **AI-SYS-07**: Add conversational AI builder assistant
  - ( ) User describes desired AI in plain language
  - ( ) Assistant generates full AI config + workflow automatically
  - ( ) Interactive refinement loop ("make it more strict/faster/cheaper")
  - ( ) Auto-generate starter evaluation suite and guardrails
  - ( ) Explainability panel: why each config choice was made

- ( ) **AI-SYS-08**: Add observability and feedback loop for created AIs
  - ( ) Session traces for prompts, retrieved context, and responses
  - ( ) Failure clustering (timeouts, low quality, unsafe responses)
  - ( ) User feedback capture ("good/bad answer") into retraining queue
  - ( ) Suggested fixes generated from telemetry
  - ( ) Continuous improvement cycle per AI version

- ( ) **AI-SYS-09**: Add safety and governance layer for user-created AIs
  - ( ) Prompt-injection and jailbreak protection presets
  - ( ) Content policy filters and blocked-topic controls
  - ( ) Permission scopes per AI (file/network/tool access)
  - ( ) Audit log for training/deployment/config changes
  - ( ) Compliance export for enterprise users

- ( ) **AI-SYS-10**: Add onboarding flow for non-technical users
  - ( ) "Build your first AI in 10 minutes" interactive tutorial
  - ( ) Plain-language explanations for all technical options
  - ( ) Automatic recommended defaults by goal
  - ( ) Built-in troubleshooting assistant for failed setup/training
  - ( ) Success checklist with next-step recommendations

- ( ) **AI-SYS-11**: Add autonomous "AI Architect" mode
  - ( ) User describes business/problem in plain language
  - ( ) System proposes end-to-end AI architecture (data, model, infra, eval)
  - ( ) Generates phased implementation plan with estimated effort
  - ( ) Creates one-click starter project scaffold + runbook
  - ( ) Provides tradeoff matrix (cost/latency/quality/privacy)

- ( ) **AI-SYS-12**: Build local "AI Red Team" simulator
  - ( ) Run jailbreak/prompt-injection/adversarial tests on created AIs
  - ( ) Generate exploit report with reproducible attack traces
  - ( ) Auto-suggest guardrail patches and policy updates
  - ( ) Track security score per AI version
  - ( ) Integrate pass/fail gate before deployment

- ( ) **AI-SYS-13**: Add continuous AI retraining autopilot
  - ( ) Collect low-rated conversations into retraining candidates
  - ( ) Periodic retrain jobs with canary evaluation
  - ( ) Automatic rollback if quality/security regress
  - ( ) Human approval checkpoints for high-impact updates
  - ( ) Drift monitoring and proactive retrain recommendations

---

## Extended AI Systems (New Ideas Added 2026-02-17)

### Voice & Speech AI

  - ( ) Implement local wake-word model (Porcupine/precise)
  - ( ) Background listening when app minimized
  - ( ) Custom wake-word training option
  - ( ) Add voice command quick actions
  - ( ) Implement voice activity detection
  - ( ) Add continuous voice mode for extended conversation
  - ( ) Create voice settings calibration UI
  - ( ) Add multi-language wake-word support

  - ( ) Low-latency voice input processing
  - ( ) Real-time voice synthesis with voice cloning
  - ( ) Conversation turn-taking detection
  - ( ) Add interrupt handling during speech
  - ( ) Implement voice emotion detection
  - ( ) Add custom voice profile selection
  - ( ) Create voice quality settings
  - ( ) Add ambient noise cancellation

  - ( ) Automatic transcription of voice memos
  - ( ) Key point extraction from recordings
  - ( ) Meeting notes AI assistant
  - ( ) Add speaker diarization
  - ( ) Implement timestamped highlights
  - ( ) Create voice memo search
  - ( ) Add automatic follow-up task creation

### Advanced Agent Capabilities

  - Advanced agent capability backlog items completed and removed.

### Development Tools AI


### Cloud & Infrastructure


### Collaboration Features


- ( ) **COLLAB-02**: Implement team knowledge base
  - ( ) AI-powered documentation search
  - ( ) Auto-generated summaries
  - ( ) Knowledge graph creation
  - ( ) Add Q&A from documentation
  - ( ) Implement team learning system
  - ( ) Create knowledge suggestions
  - ( ) Add content recommendations
  - ( ) Version-controlled wiki

### UI/UX Enhancements


### Data & Analytics

- ( ) **DATA-01**: Add AI-powered analytics dashboard
  - ( ) Usage pattern learning
  - ( ) Predictive resource allocation
  - ( ) Anomaly detection
  - ( ) Add trend visualization
  - ( ) Implement forecasting
  - ( ) Create custom metrics
  - ( ) Add alert automation
  - ( ) Export capabilities

- ( ) **DATA-02**: Implement user behavior learning
  - ( ) Learn from repeated actions
  - ( ) Predict next actions
  - ( ) Personalize AI responses
  - ( ) Add preference inference
  - ( ) Implement adaptive UI
  - ( ) Create smart defaults
  - ( ) Add learning transparency
  - ( ) Privacy controls

### Local AI Enhancements

- ( ) **LOCAL-01**: Add model fine-tuning interface
  - ( ) Upload training data
  - ( ) Configure training parameters
  - ( ) Progress monitoring
  - ( ) Add model evaluation
  - ( ) Implement model versioning
  - ( ) Create fine-tuned model registry
  - ( ) Add inference testing
  - ( ) Export fine-tuned models

- ( ) **LOCAL-02**: Implement custom embedding training
  - ( ) Domain-specific embeddings
  - ( ) Training data selection
  - ( ) Similarity search optimization
  - ( ) Add embedding comparison
  - ( ) Implement dimension reduction
  - ( ) Create embedding visualization
  - ( ) Add batch processing
  - ( ) Performance benchmarking

## Massive Backlog Expansion (500 Realistic TODOs)

Generated from current repository modules (`src/main`, `src/renderer`, `src/shared`) to capture realistic ideas for new systems, potential bugs, and missing implementations.

### Backlog Range: BACKLOG-0001 to BACKLOG-0050


### Backlog Range: BACKLOG-0051 to BACKLOG-0100


### Backlog Range: BACKLOG-0151 to BACKLOG-0200


### Backlog Range: BACKLOG-0201 to BACKLOG-0250


### Backlog Range: BACKLOG-0251 to BACKLOG-0300


### Backlog Range: BACKLOG-0301 to BACKLOG-0350
- ( ) **BACKLOG-0335**: Add telemetry events and health dashboards for AgentCollaborationService.
- ( ) **BACKLOG-0336**: Profile performance and define regression budgets for AgentCollaborationService.
- ( ) **BACKLOG-0337**: Improve loading, empty, and failure-state UX tied to AgentCollaborationService.
- ( ) **BACKLOG-0339**: Write an operational runbook and troubleshooting guide for AgentCollaborationService.
- (x) **BACKLOG-0340**: Complete threat-model and abuse-case review for AgentCollaborationService.
- ( ) **BACKLOG-0345**: Add telemetry events and health dashboards for AgentCheckpointService.
- ( ) **BACKLOG-0346**: Profile performance and define regression budgets for AgentCheckpointService.
- ( ) **BACKLOG-0347**: Improve loading, empty, and failure-state UX tied to AgentCheckpointService.
- ( ) **BACKLOG-0349**: Write an operational runbook and troubleshooting guide for AgentCheckpointService.
- (x) **BACKLOG-0350**: Complete threat-model and abuse-case review for AgentCheckpointService.


### Backlog Range: BACKLOG-0351 to BACKLOG-0400


### Backlog Range: BACKLOG-0401 to BACKLOG-0450
- ( ) **BACKLOG-0401**: Add comprehensive unit tests for edge cases in RateLimitService.
- ( ) **BACKLOG-0402**: Add integration and regression coverage for critical flows in RateLimitService.
- ( ) **BACKLOG-0403**: Harden input validation and schema guards in RateLimitService.
- ( ) **BACKLOG-0404**: Standardize error codes, retry policy, and fallback behavior in RateLimitService.
- ( ) **BACKLOG-0405**: Add telemetry events and health dashboards for RateLimitService.
- ( ) **BACKLOG-0406**: Profile performance and define regression budgets for RateLimitService.
- ( ) **BACKLOG-0407**: Improve loading, empty, and failure-state UX tied to RateLimitService.
- ( ) **BACKLOG-0408**: Add full i18n key coverage for user-facing strings surfaced by RateLimitService.
- ( ) **BACKLOG-0409**: Write an operational runbook and troubleshooting guide for RateLimitService.
- (x) **BACKLOG-0410**: Complete threat-model and abuse-case review for RateLimitService.
- ( ) **BACKLOG-0411**: Add comprehensive unit tests for edge cases in ProxyService.
- ( ) **BACKLOG-0412**: Add integration and regression coverage for critical flows in ProxyService.
- ( ) **BACKLOG-0413**: Harden input validation and schema guards in ProxyService.
- ( ) **BACKLOG-0414**: Standardize error codes, retry policy, and fallback behavior in ProxyService.
- ( ) **BACKLOG-0415**: Add telemetry events and health dashboards for ProxyService.
- ( ) **BACKLOG-0416**: Profile performance and define regression budgets for ProxyService.
- ( ) **BACKLOG-0417**: Improve loading, empty, and failure-state UX tied to ProxyService.
- ( ) **BACKLOG-0418**: Add full i18n key coverage for user-facing strings surfaced by ProxyService.
- ( ) **BACKLOG-0419**: Write an operational runbook and troubleshooting guide for ProxyService.
- (x) **BACKLOG-0420**: Complete threat-model and abuse-case review for ProxyService.
- ( ) **BACKLOG-0421**: Add comprehensive unit tests for edge cases in QuotaService.
- ( ) **BACKLOG-0422**: Add integration and regression coverage for critical flows in QuotaService.
- ( ) **BACKLOG-0423**: Harden input validation and schema guards in QuotaService.
- ( ) **BACKLOG-0424**: Standardize error codes, retry policy, and fallback behavior in QuotaService.
- ( ) **BACKLOG-0425**: Add telemetry events and health dashboards for QuotaService.
- ( ) **BACKLOG-0426**: Profile performance and define regression budgets for QuotaService.
- ( ) **BACKLOG-0427**: Improve loading, empty, and failure-state UX tied to QuotaService.
- ( ) **BACKLOG-0428**: Add full i18n key coverage for user-facing strings surfaced by QuotaService.
- ( ) **BACKLOG-0429**: Write an operational runbook and troubleshooting guide for QuotaService.
- (x) **BACKLOG-0430**: Complete threat-model and abuse-case review for QuotaService.
- ( ) **BACKLOG-0431**: Add comprehensive unit tests for edge cases in WorkflowService.
- ( ) **BACKLOG-0432**: Add integration and regression coverage for critical flows in WorkflowService.
- ( ) **BACKLOG-0433**: Harden input validation and schema guards in WorkflowService.
- ( ) **BACKLOG-0434**: Standardize error codes, retry policy, and fallback behavior in WorkflowService.
- ( ) **BACKLOG-0435**: Add telemetry events and health dashboards for WorkflowService.
- ( ) **BACKLOG-0436**: Profile performance and define regression budgets for WorkflowService.
- ( ) **BACKLOG-0437**: Improve loading, empty, and failure-state UX tied to WorkflowService.
- ( ) **BACKLOG-0438**: Add full i18n key coverage for user-facing strings surfaced by WorkflowService.
- ( ) **BACKLOG-0439**: Write an operational runbook and troubleshooting guide for WorkflowService.
- (x) **BACKLOG-0440**: Complete threat-model and abuse-case review for WorkflowService.
- ( ) **BACKLOG-0441**: Add comprehensive unit tests for edge cases in FeatureFlagService.
- ( ) **BACKLOG-0442**: Add integration and regression coverage for critical flows in FeatureFlagService.
- ( ) **BACKLOG-0443**: Harden input validation and schema guards in FeatureFlagService.
- ( ) **BACKLOG-0444**: Standardize error codes, retry policy, and fallback behavior in FeatureFlagService.
- ( ) **BACKLOG-0445**: Add telemetry events and health dashboards for FeatureFlagService.
- ( ) **BACKLOG-0446**: Profile performance and define regression budgets for FeatureFlagService.
- ( ) **BACKLOG-0447**: Improve loading, empty, and failure-state UX tied to FeatureFlagService.
- ( ) **BACKLOG-0448**: Add full i18n key coverage for user-facing strings surfaced by FeatureFlagService.
- ( ) **BACKLOG-0449**: Write an operational runbook and troubleshooting guide for FeatureFlagService.
- (x) **BACKLOG-0450**: Complete threat-model and abuse-case review for FeatureFlagService.


### Backlog Range: BACKLOG-0451 to BACKLOG-0500
- ( ) **BACKLOG-0451**: Add comprehensive unit tests for edge cases in MonitoringService.
- ( ) **BACKLOG-0452**: Add integration and regression coverage for critical flows in MonitoringService.
- ( ) **BACKLOG-0453**: Harden input validation and schema guards in MonitoringService.
- ( ) **BACKLOG-0454**: Standardize error codes, retry policy, and fallback behavior in MonitoringService.
- ( ) **BACKLOG-0455**: Add telemetry events and health dashboards for MonitoringService.
- ( ) **BACKLOG-0456**: Profile performance and define regression budgets for MonitoringService.
- ( ) **BACKLOG-0457**: Improve loading, empty, and failure-state UX tied to MonitoringService.
- ( ) **BACKLOG-0458**: Add full i18n key coverage for user-facing strings surfaced by MonitoringService.
- ( ) **BACKLOG-0459**: Write an operational runbook and troubleshooting guide for MonitoringService.
- (x) **BACKLOG-0460**: Complete threat-model and abuse-case review for MonitoringService.
- ( ) **BACKLOG-0461**: Add comprehensive unit tests for edge cases in TelemetryService.
- ( ) **BACKLOG-0462**: Add integration and regression coverage for critical flows in TelemetryService.
- ( ) **BACKLOG-0463**: Harden input validation and schema guards in TelemetryService.
- ( ) **BACKLOG-0464**: Standardize error codes, retry policy, and fallback behavior in TelemetryService.
- ( ) **BACKLOG-0465**: Add telemetry events and health dashboards for TelemetryService.
- ( ) **BACKLOG-0466**: Profile performance and define regression budgets for TelemetryService.
- ( ) **BACKLOG-0467**: Improve loading, empty, and failure-state UX tied to TelemetryService.
- ( ) **BACKLOG-0468**: Add full i18n key coverage for user-facing strings surfaced by TelemetryService.
- ( ) **BACKLOG-0469**: Write an operational runbook and troubleshooting guide for TelemetryService.
- (x) **BACKLOG-0470**: Complete threat-model and abuse-case review for TelemetryService.
- ( ) **BACKLOG-0471**: Add comprehensive unit tests for edge cases in ThemeService.
- ( ) **BACKLOG-0472**: Add integration and regression coverage for critical flows in ThemeService.
- ( ) **BACKLOG-0473**: Harden input validation and schema guards in ThemeService.
- ( ) **BACKLOG-0474**: Standardize error codes, retry policy, and fallback behavior in ThemeService.
- ( ) **BACKLOG-0475**: Add telemetry events and health dashboards for ThemeService.
- ( ) **BACKLOG-0476**: Profile performance and define regression budgets for ThemeService.
- ( ) **BACKLOG-0477**: Improve loading, empty, and failure-state UX tied to ThemeService.
- ( ) **BACKLOG-0478**: Add full i18n key coverage for user-facing strings surfaced by ThemeService.
- ( ) **BACKLOG-0479**: Write an operational runbook and troubleshooting guide for ThemeService.
- (x) **BACKLOG-0480**: Complete threat-model and abuse-case review for ThemeService.
- ( ) **BACKLOG-0481**: Add comprehensive unit tests for edge cases in DataService.
- ( ) **BACKLOG-0482**: Add integration and regression coverage for critical flows in DataService.
- ( ) **BACKLOG-0483**: Harden input validation and schema guards in DataService.
- ( ) **BACKLOG-0484**: Standardize error codes, retry policy, and fallback behavior in DataService.
- ( ) **BACKLOG-0485**: Add telemetry events and health dashboards for DataService.
- ( ) **BACKLOG-0486**: Profile performance and define regression budgets for DataService.
- ( ) **BACKLOG-0487**: Improve loading, empty, and failure-state UX tied to DataService.
- ( ) **BACKLOG-0488**: Add full i18n key coverage for user-facing strings surfaced by DataService.
- ( ) **BACKLOG-0489**: Write an operational runbook and troubleshooting guide for DataService.
- (x) **BACKLOG-0490**: Complete threat-model and abuse-case review for DataService.
- ( ) **BACKLOG-0491**: Add comprehensive unit tests for edge cases in DatabaseService.
- ( ) **BACKLOG-0492**: Add integration and regression coverage for critical flows in DatabaseService.
- ( ) **BACKLOG-0493**: Harden input validation and schema guards in DatabaseService.
- ( ) **BACKLOG-0494**: Standardize error codes, retry policy, and fallback behavior in DatabaseService.
- ( ) **BACKLOG-0495**: Add telemetry events and health dashboards for DatabaseService.
- ( ) **BACKLOG-0496**: Profile performance and define regression budgets for DatabaseService.
- ( ) **BACKLOG-0497**: Improve loading, empty, and failure-state UX tied to DatabaseService.
- ( ) **BACKLOG-0498**: Add full i18n key coverage for user-facing strings surfaced by DatabaseService.
- ( ) **BACKLOG-0499**: Write an operational runbook and troubleshooting guide for DatabaseService.
- (x) **BACKLOG-0500**: Complete threat-model and abuse-case review for DatabaseService.

### Website Backend Security Hardening (Execution Order)
- (x) **WEBSEC-P0-001**: Replace legacy password hashing with PBKDF2/Argon2-compatible secure format and legacy-hash migration on login.
- (x) **WEBSEC-P0-002**: Replace custom auth token with standards-based JWT (exp/iat/nbf/iss/aud) and refresh token rotation.
- (x) **WEBSEC-P0-003**: Move auth rate-limits and admin abuse-protection from in-memory to Redis-backed distributed throttling.
- (x) **WEBSEC-P0-004**: Enforce production HTTPS end-to-end (proxy trust, forwarded proto validation, strict redirect policy, secure cookies).
- (x) **WEBSEC-P0-005**: Add backend integration tests for auth/admin/analytics security-critical paths (authorization bypass, malformed payloads, replay).
- (x) **WEBSEC-P1-001**: Add centralized request schema validation and standardized error code model for all website backend endpoints.
- (x) **WEBSEC-P1-002**: Add audit trail for admin actions and security events with trace id propagation.
- (x) **WEBSEC-P1-003**: Add Redis queue + batch ingestion for analytics events with retry/dead-letter handling.
- (x) **WEBSEC-P1-004**: Add bot/AI traffic confidence scoring (UA + behavior + ASN/reverse DNS) with risk labels.
- (x) **WEBSEC-P2-001**: Add Linux CI parity pipeline (build + lint + smoke test) and release artifact checks.
- (x) **WEBSEC-P2-002**: Add retention/deletion policy tooling for analytics data (privacy controls and compliance workflows).

### Security Audit Findings (2026-02-27)
- [x] **AUD-2026-02-27-01**: Remove access-token exposure from auth IPC response (`auth:poll-token` returns raw token).
  - [x] Return account metadata only; never return `access_token` to renderer.
  - [x] Add regression test to assert token is not present in IPC payload.
  - [x] Verify Copilot/GitHub link flow still works after response contract change.
- [x] **AUD-2026-02-27-02**: Harden local API token handling in `ApiServerService`.
  - [x] Remove query-string token fallback (`?token=`) to prevent token leakage in logs/history.
  - [x] Deprecate or gate `/api/auth/token` behind explicit one-time consent/nonce handshake.
  - [x] Add tests covering denied query token and local-only endpoint abuse attempts.
- [x] **AUD-2026-02-27-03**: Restrict `shell:runCommand` IPC surface with allowlist + policy layer.
  - [x] Enforce executable allowlist and per-command argument schema.
  - [x] Add blocked-command audit logs and rate limiting for execution attempts.
  - [x] Add security tests for path traversal and arbitrary executable invocation.


