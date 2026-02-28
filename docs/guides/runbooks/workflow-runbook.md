# WorkflowService Runbook

**Service ID:** B-0439
**Source:** `src/main/services/workflow/workflow.service.ts`
**Extends:** `BaseService`
**Owner:** Platform Team

---

## 1. Service Overview

WorkflowService manages the creation, persistence, and execution of user-defined automation workflows in Tengra. Workflows consist of triggers (manual or event-based) and actions (commands, LLM prompts, agent tasks) that are executed sequentially by the WorkflowRunner.

### Responsibilities

- CRUD operations for workflows (create, read, update, delete)
- Persist workflows to disk as JSON (`workflows.json` in userData)
- Register and manage trigger handlers (manual triggers)
- Execute workflows through the WorkflowRunner with action handlers
- Validate workflow input/output using Zod schemas
- Track workflow execution results and status

### Dependencies

| Dependency | Purpose |
|---|---|
| `LLMService` (optional) | LLM prompt action execution |
| `ProjectAgentService` (optional) | Agent workflow action execution |
| `WorkflowRunner` | Core workflow execution engine |
| `ManualTriggerHandler` | Manual trigger registration and firing |
| `CommandActionHandler` | Shell command execution |
| `LLMPromptAction` | LLM-based workflow steps |
| `AgentWorkflowAction` | Agent-based workflow steps |

### Action Types

| Action | Handler | Dependency |
|---|---|---|
| Command | `CommandActionHandler` | None (always registered) |
| LLM Prompt | `LLMPromptAction` | Requires `LLMService` |
| Agent | `AgentWorkflowAction` | Requires `ProjectAgentService` |

---

## 2. Configuration Parameters

### Storage

- **File path:** `{userData}/workflows.json`
- **Format:** JSON array of `Workflow` objects
- **Encoding:** UTF-8 with 2-space indentation

### Performance Budgets

| Operation | Budget (ms) |
|---|---|
| Create workflow | 500 |
| Update workflow | 500 |
| Delete workflow | 500 |
| Execute workflow | 300,000 (5 min) |
| Load from disk | 2,000 |
| Save to disk | 2,000 |

### Validation

- IDs must be non-empty strings
- Create/update inputs validated via Zod: `CreateWorkflowInputSchema`, `UpdateWorkflowInputSchema`
- Execution context validated via `WorkflowContextInputSchema`
- Workflow IDs are UUIDv4, auto-generated on creation

---

## 3. Common Failure Modes

### 3.1 WORKFLOW_NOT_FOUND

**Symptom:** Error thrown when accessing a workflow by ID that doesn't exist.

**Cause:** Invalid ID, workflow was deleted, or not loaded from disk.

**Resolution:**
1. Verify the workflow ID exists via `getAllWorkflows()`
2. Check if `workflows.json` contains the expected workflow
3. Re-load workflows by restarting the service

### 3.2 WORKFLOW_INVALID_INPUT

**Symptom:** Zod validation error on create/update operations.

**Cause:** Input doesn't match the expected schema.

**Resolution:**
1. Check the error message for specific field validation failures
2. Review `CreateWorkflowInputSchema` / `UpdateWorkflowInputSchema` for requirements
3. Ensure all required fields are provided with correct types

### 3.3 WORKFLOW_DISABLED

**Symptom:** Execution fails with "Workflow is disabled" error.

**Cause:** Trying to execute a workflow that has `enabled: false`.

**Resolution:**
1. Enable the workflow: `updateWorkflow(id, { enabled: true })`
2. Or check if the workflow should be enabled

### 3.4 SAVE_FAILED

**Symptom:** `WorkflowError` with code `SAVE_FAILED` on any mutation operation.

**Cause:** File system error writing `workflows.json`.

**Resolution:**
1. Check disk space availability
2. Verify write permissions on `{userData}/` directory
3. Check if the file is locked by another process
4. Verify the userData path exists

### 3.5 Load Failure (ENOENT)

**Symptom:** Log: "No workflows file found, starting with empty workflows".

**Cause:** First run or `workflows.json` was deleted. This is normal on first launch.

**Resolution:** No action needed — the service starts with an empty workflow set.

### 3.6 Load Failure (Parse Error)

**Symptom:** Log: "Failed to load workflows" with JSON parse error.

**Cause:** `workflows.json` is corrupted.

**Resolution:**
1. Back up the corrupted file
2. Delete `workflows.json` to start fresh
3. Re-create workflows manually

---

## 4. Health Check Procedures

### Programmatic Health Check

```typescript
const health = workflowService.getHealth();
// Returns: { totalWorkflows: number, enabledWorkflows: number, workflowIds: string[] }
```

### Health Indicators

| Indicator | Healthy | Warning | Critical |
|---|---|---|---|
| `totalWorkflows` | > 0 (if expected) | 0 (if workflows expected) | — |
| `enabledWorkflows` | > 0 | 0 (none active) | — |
| Last execution status | `success` | `partial` | `failed` |
| Save latency | < 500ms | 500ms–2s | > 2s |

### Manual Verification

1. Call `getAllWorkflows()` and verify expected workflows exist
2. Check each workflow's `lastRunStatus` and `lastRunAt`
3. Trigger a manual workflow and verify execution completes
4. Check `workflows.json` file is writable and valid JSON

---

## 5. Recovery Procedures

### Scenario: Corrupted workflows.json

1. Stop the service
2. Back up: `copy workflows.json workflows.json.bak`
3. Delete `workflows.json`
4. Restart the service (starts with empty workflows)
5. Re-create workflows or restore from backup

### Scenario: Workflow Execution Stuck

1. Check if the WorkflowRunner has a long-running action
2. The execution budget is 300,000ms (5 minutes)
3. Identify which action handler is blocking (Command, LLM, or Agent)
4. Kill any stuck child processes if command action is involved
5. Restart the service to reset execution state

### Scenario: Missing Action Handlers

1. Check if `LLMService` was injected — without it, `LLMPromptAction` won't register
2. Check if `ProjectAgentService` was injected — without it, `AgentWorkflowAction` won't register
3. `CommandActionHandler` is always registered (no dependencies)
4. Look for log: "Registered LLMPromptAction handler" / "Registered AgentWorkflowAction handler"

### Scenario: Triggers Not Firing

1. Verify the workflow has `enabled: true`
2. Check that triggers are registered: `registerWorkflowTriggers()` runs on init
3. For manual triggers, use `triggerManualWorkflow(triggerId, context)`
4. Triggers are re-registered after any workflow update

---

## 6. Monitoring Alerts and Thresholds

### Telemetry Events

| Event | Description |
|---|---|
| `workflow_created` | New workflow created |
| `workflow_updated` | Workflow updated |
| `workflow_deleted` | Workflow deleted |
| `workflow_executed` | Workflow execution completed |
| `workflow_execution_failed` | Workflow execution failed |
| `workflow_loaded_from_disk` | Workflows loaded from file |
| `workflow_saved_to_disk` | Workflows saved to file |

### Recommended Alerts

| Alert | Condition | Severity |
|---|---|---|
| Execution failure | `workflow_execution_failed` event | Warning |
| Save failure | `SAVE_FAILED` error thrown | Critical |
| Load failure | Non-ENOENT load error | Warning |
| Execution timeout | Execution exceeds 300s budget | Critical |
| No enabled workflows | `enabledWorkflows` = 0 (if expected > 0) | Info |

---

## 7. Log Locations and What to Look For

### Log Output

Logs via `BaseService` logging methods (`logInfo`, `logError`), tagged `WorkflowService`.

### Key Log Patterns

| Pattern | Meaning |
|---|---|
| `Initializing WorkflowService...` | Service starting |
| `Registered LLMPromptAction handler` | LLM action available |
| `Registered AgentWorkflowAction handler` | Agent action available |
| `Loaded N workflows from disk` | Successful load |
| `No workflows file found` | First run (normal) |
| `Failed to load workflows` | Load error (investigate) |
| `Created workflow: <name> (<id>)` | Workflow created |
| `Updated workflow: <name> (<id>)` | Workflow updated |
| `Deleted workflow: <name> (<id>)` | Workflow deleted |
| `Executing workflow: <name> (<id>)` | Execution started |
| `Saved N workflows to disk` | Successful save |
| `Failed to save workflows` | Save error (critical) |
| `WorkflowService initialized successfully` | Startup complete |

### File Locations

- **Workflow data:** `{userData}/workflows.json`
- **Logs:** `logs/` directory, entries tagged `WorkflowService`
