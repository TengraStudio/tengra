# Agent Checkpoint Service — Operational Runbook

## Overview

The `AgentCheckpointService` manages save, load, and rollback of agent task state snapshots. It stores gzip-compressed, schema-validated snapshots in PGlite via `DatabaseService.uac` and emits telemetry for every operation.

**Location:** `src/main/services/project/agent/agent-checkpoint.service.ts`

---

## Architecture

```
AgentCheckpointService
  ├── saveCheckpoint()       → gzip + validate + DB insert + trim
  ├── loadCheckpoint()       → DB read + decompress + hydrate dates
  ├── getCheckpoints()       → list checkpoints for a task
  ├── getLatestCheckpoint()  → latest checkpoint for a task
  ├── prepareRollback()      → save pre-rollback + load target
  ├── createPlanVersion()    → versioned plan snapshots
  ├── getPlanVersions()      → list plan versions
  └── getHealthMetrics()     → operational dashboard metrics
```

**Dependencies:**
- `DatabaseService` — persistence via `uac` (user-agent-checkpoint) queries
- `TelemetryService` — optional, wired via `setTelemetryService()`

---

## Performance Budgets

| Operation | Budget (ms) | Constant |
|---|---|---|
| Save checkpoint | 2 000 | `SAVE_CHECKPOINT_MS` |
| Load checkpoint | 2 000 | `RESTORE_CHECKPOINT_MS` |
| Delete checkpoint | 500 | `DELETE_CHECKPOINT_MS` |
| Rollback | 5 000 | `ROLLBACK_MS` |
| Compress | 1 000 | `COMPRESS_MS` |
| List checkpoints | 500 | `LIST_CHECKPOINTS_MS` |
| Initialize | 100 | `INITIALIZE_MS` |

Budget breaches are logged at WARN level and counted in `getHealthMetrics().budgetBreaches`.

---

## Telemetry Events

| Event | When |
|---|---|
| `agent_checkpoint_saved` | After every save (includes `success: false` on failure) |
| `agent_checkpoint_restored` | After loading a checkpoint |
| `agent_checkpoint_deleted` | After deleting a checkpoint |
| `agent_checkpoint_rollback_started` | Before rollback begins |
| `agent_checkpoint_rollback_completed` | After rollback finishes |
| `agent_checkpoint_compressed` | After snapshot compression |
| `agent_checkpoint_limit_reached` | When trim discards old checkpoints |

All events include `taskId`, `durationMs`, and operation-specific context.

---

## Health Dashboard

Call `agentCheckpointService.getHealthMetrics()` to get:

```ts
{
  totalSaves: number;
  totalLoads: number;
  totalRollbacks: number;
  totalErrors: number;
  avgSaveDurationMs: number;
  avgLoadDurationMs: number;
  budgetBreaches: number;
}
```

**Alert thresholds (recommended):**

| Metric | Warning | Critical |
|---|---|---|
| `totalErrors` | > 5 in 1h | > 20 in 1h |
| `avgSaveDurationMs` | > 1 500 | > 2 000 |
| `budgetBreaches` | > 3 in 1h | > 10 in 1h |

---

## Error Codes

| Code | Meaning | Resolution |
|---|---|---|
| `MISSING_TASK_ID` | `taskId` was empty | Caller bug — ensure taskId is passed |
| `SAVE_FAILED` | DB insert or validation failed | Check PGlite logs, disk space |
| `LOAD_FAILED` | DB read or decompression failed | Snapshot may be corrupt — delete and re-save |
| `SERIALIZATION_FAILED` | Zod validation or gzip failed | State shape changed — check `AgentTaskStateSchema` |
| `CHECKPOINT_NOT_FOUND` | Requested checkpoint ID missing | May have been trimmed (max 200/task) |
| `ROLLBACK_FAILED` | prepareRollback failed | Check nested error — usually LOAD_FAILED or SAVE_FAILED |

---

## Troubleshooting

### Checkpoints not saving
1. Check logs for `AgentCheckpointService` entries at ERROR level.
2. Verify `DatabaseService` is initialized (`uac` queries require schema migration).
3. Confirm disk space is available for PGlite.
4. Validate the agent state shape matches `AgentTaskStateSchema`.

### Slow save/load operations
1. Check `getHealthMetrics().avgSaveDurationMs` — compare against 2 000 ms budget.
2. Look for WARN logs: `Performance budget exceeded for saveCheckpoint`.
3. Large `eventHistory` or `providerHistory` arrays increase snapshot size — consider pruning old entries before save.
4. Check PGlite performance (WAL size, vacuum status).

### Rollback fails with CHECKPOINT_NOT_FOUND
1. Checkpoints are trimmed to 200 per task — old ones are discarded.
2. Confirm the checkpoint ID exists: `getCheckpoints(taskId)`.
3. If deleted, the task must re-execute from the last available checkpoint.

### Corrupt snapshot / decompression errors
1. Error: `Invalid compressed checkpoint snapshot`.
2. The snapshot may have been written by an older schema version or truncated.
3. Delete the corrupt checkpoint and rely on the next available one.
4. If recurring, check for DB write interruptions (crash during save).

### Telemetry not appearing
1. Confirm `setTelemetryService()` was called during startup (check `services.ts`).
2. Verify telemetry is enabled in settings.
3. Check `TelemetryService.getHealth().telemetryEnabled`.

---

## Operational Procedures

### Manual snapshot
```ts
await agentCheckpointService.saveCheckpoint(taskId, stepIndex, state, 'manual_snapshot');
```

### Force rollback
```ts
const { resumedCheckpoint, preRollbackCheckpointId } =
    await agentCheckpointService.prepareRollback(targetCheckpointId, currentState);
// Apply resumedCheckpoint.state to the agent executor
```

### Purge checkpoints for a task
```ts
// Use DatabaseService directly:
await databaseService.uac.deleteCheckpoints(taskId);
```

### Check service health
```ts
const health = agentCheckpointService.getHealthMetrics();
if (health.totalErrors > 0 || health.budgetBreaches > 0) {
    // Investigate
}
```

---

## Configuration

| Constant | Value | Location |
|---|---|---|
| `MAX_CHECKPOINTS_PER_TASK` | 200 | `agent-checkpoint.service.ts` |
| `CHECKPOINT_SNAPSHOT_PREFIX` | `gzip:` | Snapshot format marker |
| Performance budgets | See table above | `AGENT_CHECKPOINT_PERFORMANCE_BUDGETS` |

---

## Related Files

- `src/main/services/project/agent/agent-checkpoint.service.ts` — Service implementation
- `src/shared/schemas/agent-checkpoint.schema.ts` — Zod schemas
- `src/shared/types/project-agent.ts` — TypeScript types
- `src/renderer/features/projects/components/agent/CheckpointList.tsx` — UI component
- `src/renderer/features/projects/hooks/useAgentHistory.ts` — Frontend hook
- `src/main/startup/services.ts` — Service wiring
