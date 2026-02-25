# ADR-2026-03-01: Council Execution Model Boundaries

## Status
Accepted

## Context
The March 1 scope requires a multi-agent "Council" execution system with quota-aware routing, user approval gates, and crash-safe continuation.

Without strict boundaries, roles overlap, ownership becomes unclear, and recovery/fallback behavior becomes inconsistent.

## Decision
Define six non-overlapping council components:

1. President
- Owns full workflow lifecycle: plan proposal, user approval gate, assignment, supervision, escalation.
- Final authority for stage transitions and reroute decisions.

2. Planner
- Converts request into stage graph with explicit dependencies and acceptance criteria.
- Does not execute stages.

3. Router
- Selects model/account using quota, capability, user constraints, and deterministic fallback order.
- Does not mutate stage execution state directly.

4. Worker
- Executes assigned stage only and returns stage-bounded output.
- Must emit blocker reports when unable to continue.

5. Reviewer
- Validates worker output against acceptance criteria.
- Can request fixes or escalate to President.

6. Recovery
- Restores runtime from latest consistent checkpoint.
- Reconstructs pending stage queue and ownership map after crash/interruption.

## Responsibility and No-Overlap Rules
- President is the only role that can:
  - authorize execution start after user approval,
  - reassign ownership,
  - finalize interrupt handling decisions.
- Planner cannot execute or route.
- Router cannot approve/reject plans.
- Worker cannot alter plan scope.
- Reviewer cannot reassign ownership.
- Recovery cannot modify accepted plan structure, only runtime continuation state.

## Failure Domains and Ownership
- Planning failure: Planner -> President retries/escalates.
- Routing/quota failure: Router -> President fallback decision or block-by-quota.
- Execution failure: Worker -> Reviewer -> President escalation chain.
- Validation failure: Reviewer -> Worker fix loop (bounded retries).
- Crash/restart failure: Recovery -> President manual intervention request.

## Data Ownership
- Plan metadata: `uac_council_plans`
- Stage lifecycle: `uac_council_plan_stages`
- Assignment history: `uac_council_assignments`
- Decision/audit log: `uac_council_decisions`
- Interrupt log: `uac_council_interrupts`

## Consequences
Positive:
- Clear ownership and escalation paths.
- Deterministic behavior under quota/provider interruptions.
- Better auditability and crash recovery.

Tradeoffs:
- More explicit contracts and schema surface to maintain.
- Requires stricter IPC/service validation for role transitions.
