# March 1, 2026 Critical Path (AI-Assisted Mini Code Editor)

> Extracted from TODO.md — remaining tasks only

## Core Tasks

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
- ( ) **MARCH1-QUALITY-001**: Stabilize project-agent operational gaps blocking March 1 launch.

## Detailed Execution Plan (Project System)

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

## Expanded Backlog (Meclis Sistemi - Detailed)

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

- ( ) **MARCH1-AGENT-PROTOCOL-001**: Agent-to-agent communication protocol (remaining).

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
