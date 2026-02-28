# Agent Collaboration Service — Operational Runbook

> **Service**: `AgentCollaborationService`
> **Location**: `src/main/services/project/agent/agent-collaboration.service.ts`
> **Owner**: Core Platform Team

---

## 1. Service Overview

The Agent Collaboration Service manages multi-model AI collaboration in Tengra:

| Capability | Description |
|---|---|
| Per-step model assignment | Assign specific LLM providers to individual project steps |
| Task-type routing | Automatically route tasks to the best-fit model |
| Voting mechanism | Multi-model voting for critical decisions |
| Consensus building | Merge or arbitrate conflicting model outputs |
| Multi-agent debate | Structured pro/con debates with quality scoring |
| Worker availability | Track agent readiness and score helper candidates |
| Collaboration messaging | Inter-agent message passing with anti-loop protection |
| Telemetry & health | Event tracking and health dashboard metrics |

---

## 2. Health Monitoring

### Key Metrics

| Metric | Source | Alert Threshold |
|---|---|---|
| Deadlocked voting sessions | `getHealthDashboardMetrics()` | > 2 sessions |
| Agent failure rate | `healthSignals[].failureRate` | > 0.4 = critical |
| Performance budget violations | `appLogger.warn` with "Performance budget exceeded" | Any occurrence |
| Active voting sessions | `getHealthDashboardMetrics().activeVotingSessions` | > 10 |

### Performance Budgets

Defined in `AGENT_COLLABORATION_PERFORMANCE_BUDGETS`:

| Operation | Budget (ms) |
|---|---|
| Create voting session | 500 |
| Execute voting | 30 000 |
| Build consensus | 30 000 |
| Route model | 100 |
| Debate session | 60 000 |
| Initialize | 1 000 |

### Health Dashboard

Call `getHealthDashboardMetrics()` to retrieve:

```typescript
{
  activeVotingSessions: number;
  activeDebateSessions: number;
  deadlockedSessions: number;
  agentHealthSummary: { healthy: number; warning: number; critical: number };
  overallHealthStatus: 'healthy' | 'warning' | 'critical';
  updatedAt: number;
}
```

---

## 3. Common Issues & Troubleshooting

### 3.1 Voting Deadlock

**Symptoms**: `VotingSession.status === 'deadlocked'`, telemetry event `CONFLICT_DETECTED` fires.

**Diagnosis**:
1. Check session votes via `getVotingSession(sessionId)`.
2. Review `deadlockThreshold` in voting configuration.
3. Check if `minimumVotes` is set too low.

**Resolution**:
- Use `overrideVotingDecision(sessionId, decision, reason)` to manually resolve.
- Adjust `updateVotingConfiguration({ deadlockThreshold: 0.8 })` to be more permissive.

### 3.2 Consensus Arbitration Failure

**Symptoms**: `buildConsensus()` returns `{ agreed: false, resolutionMethod: 'manual' }`.

**Diagnosis**:
1. Check if the arbitrator LLM (Claude) is reachable.
2. Review log entries: `"Arbitration failed"`.
3. Verify outputs are sufficiently distinct (Jaccard similarity < 0.8).

**Resolution**:
- Ensure the `anthropic` provider is configured and has quota.
- Reduce the number of conflicting outputs by pre-filtering.
- Manually merge outputs and set the result.

### 3.3 Performance Budget Exceeded

**Symptoms**: Log warns `Performance budget exceeded: <operation> took Xms (budget: Yms)`.

**Diagnosis**:
1. Check LLM response latency (for `buildConsensus`, `requestVotes`).
2. Review voting session size (large vote counts slow resolution).
3. Check system resource utilization.

**Resolution**:
- Reduce the number of participating models.
- Increase timeout budgets if consistently over budget in high-load scenarios.
- Check LLM provider health and network latency.

### 3.4 Collaboration Loop Detected

**Symptoms**: `AgentCollaborationError` with code `COLLABORATION_LOOP_DETECTED`.

**Diagnosis**:
1. Review recent collaboration messages for the task via `getCollaborationMessages()`.
2. Check if agents are sending identical payloads repeatedly.

**Resolution**:
- The anti-loop threshold is 3 identical messages within 5 minutes.
- Investigate the agent logic that's generating repeated requests.
- Call `cleanupExpiredCollaborationMessages(taskId)` to clear stale messages.

### 3.5 Agent Health Critical

**Symptoms**: `getTeamworkAnalytics().healthSignals` shows `status: 'critical'` (failure rate > 40%).

**Resolution**:
- Reduce task load for the affected agent.
- Check if the agent's LLM provider is experiencing issues.
- Review task assignment patterns; route complex tasks to healthier agents.

---

## 4. Telemetry Events

| Event | Trigger |
|---|---|
| `TASK_ASSIGNED` | Model manually assigned to a step |
| `MODEL_ROUTED` | Model auto-selected by task type |
| `VOTING_SESSION_CREATED` | New voting session started |
| `VOTING_COMPLETED` | Voting resolved automatically |
| `CONFLICT_DETECTED` | Voting deadlock or output disagreement |
| `CONSENSUS_REACHED` | Outputs agreed (unanimous or majority) |
| `CONSENSUS_FAILED` | Arbitration failed, manual resolution needed |
| `DEBATE_STARTED` | New debate session created |
| `DEBATE_COMPLETED` | Debate session resolved |
| `AGENT_JOINED` | New agent registered as available |
| `RESULT_MERGED` | Conflicting outputs merged via arbitration |

---

## 5. Configuration Reference

### Voting Configuration

```typescript
updateVotingConfiguration({
  minimumVotes: 2,          // Min votes before resolution attempt
  deadlockThreshold: 0.9,   // Weight ratio for tie detection (0.5–1.0)
  autoResolve: true,         // Auto-resolve when minimum votes met
  autoResolveTimeoutMs: 60000 // Timeout for auto-resolution
});
```

### Routing Rules

Default routing assigns models by task type and priority. Override with:

```typescript
setRoutingRules([
  { taskType: 'code_generation', provider: 'openai', model: 'gpt-4o', priority: 100 },
  { taskType: 'code_review', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 100 }
]);
```

---

## 6. Escalation Procedures

| Severity | Condition | Action |
|---|---|---|
| Low | Single performance budget warning | Monitor; no immediate action |
| Medium | Repeated deadlocks or > 2 active deadlocked sessions | Adjust voting config or manually override |
| High | Agent health critical (failure rate > 40%) | Reduce agent workload, check provider status |
| Critical | Consensus arbitration consistently failing | Check LLM provider connectivity, escalate to on-call |

---

## 7. Maintenance Tasks

- **Cleanup expired messages**: Call `cleanupExpiredCollaborationMessages()` periodically.
- **Review analytics**: Check `getTeamworkAnalytics()` weekly for efficiency trends.
- **Rotate routing rules**: Update model priorities when new LLM versions are released.
- **Monitor telemetry**: Watch for spikes in `CONFLICT_DETECTED` or `CONSENSUS_FAILED` events.
