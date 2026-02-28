# RateLimitService Runbook

**Service ID:** B-0409
**Source:** `src/main/services/security/rate-limit.service.ts`
**Extends:** `BaseService`
**Owner:** Security Team

---

## 1. Service Overview

RateLimitService implements token-bucket rate limiting for all outbound API calls and expensive internal operations in Tengra. It prevents abuse, protects upstream provider quotas, and ensures fair resource distribution across LLM providers, MCP plugins, file operations, and agent executions.

### Responsibilities

- Enforce per-provider request rate limits using the token bucket algorithm
- Provide both blocking (`waitForToken`) and non-blocking (`tryAcquire`) token acquisition
- Auto-refill token buckets based on configured `requestsPerMinute`
- Periodically clean up stale/unused buckets (every 5 minutes, 30-minute TTL)
- Expose health data for monitoring dashboards via `getHealth()`

### Dependencies

- `appLogger` — structured logging
- No external service dependencies (standalone in-memory service)

---

## 2. Configuration Parameters

### Default Provider Limits

| Provider Key | Requests/Min | Max Burst | Use Case |
|---|---|---|---|
| `openai` | 60 | 10 | OpenAI API calls |
| `anthropic` | 50 | 5 | Anthropic/Claude API calls |
| `gemini` | 60 | 10 | Google Gemini API calls |
| `ssh:execute` | 120 | 20 | SSH command execution |
| `chat:stream` | 60 | 5 | Chat streaming (~1/sec) |
| `files:search` | 20 | 2 | File search (expensive) |
| `files:read` | 300 | 50 | File read (high frequency) |
| `files:write` | 100 | 10 | File write (restricted) |
| `api:request` | 600 | 50 | General API requests |
| `ollama:chat` | 30 | 5 | Local LLM calls |
| `ollama:operation` | 60 | 10 | General Ollama operations |
| `model-registry` | 30 | 5 | Model registry queries |
| `ideas:generation` | 10 | 2 | Idea generation (expensive) |
| `ideas:research` | 20 | 3 | Research pipeline |
| `agent:execution` | 20 | 3 | Agent task execution |
| `code-intelligence` | 30 | 5 | Code analysis ops |
| `embedding` | 100 | 20 | Embedding generation |
| `memory:operation` | 60 | 10 | Memory operations |
| `mcp:*` | 30–200 | 5–30 | MCP plugin categories |

### Validation Constraints

| Parameter | Constraint |
|---|---|
| Provider key length | Max 256 characters |
| `requestsPerMinute` | Must be > 0, ≤ 100,000 |
| `maxBurst` | Must be ≥ 0 (finite) |

### Performance Budgets

| Operation | Budget (ms) |
|---|---|
| `tryAcquire` | 1 |
| `waitForToken` | 60,000 |
| `setLimit` | 1 |
| `cleanupOldBuckets` | 100 |

---

## 3. Common Failure Modes

### 3.1 RATE_LIMIT_WAIT_EXCEEDED

**Symptom:** Error thrown with code `RATE_LIMIT_WAIT_EXCEEDED` after 100 retry iterations.

**Cause:** The provider is under sustained heavy load exceeding its configured rate.

**Resolution:**
1. Check which provider is affected from the error message
2. Increase `requestsPerMinute` for the provider via `setLimit()`
3. Check if the calling code is in a retry loop amplifying requests
4. Verify upstream provider hasn't lowered their own limits

### 3.2 RATE_LIMIT_INVALID_PROVIDER

**Symptom:** Error thrown when provider key is empty, whitespace-only, or exceeds 256 chars.

**Resolution:**
1. Audit calling code to ensure valid provider strings are passed
2. Check for encoding issues in provider names

### 3.3 RATE_LIMIT_INVALID_CONFIG

**Symptom:** Error thrown when setting limits with invalid `requestsPerMinute` or `maxBurst`.

**Resolution:**
1. Ensure `requestsPerMinute` is a positive finite number ≤ 100,000
2. Ensure `maxBurst` (if provided) is a non-negative finite number

### 3.4 Performance Budget Exceeded

**Symptom:** Warning log: `Performance budget exceeded for <operation>`.

**Cause:** `tryAcquire` taking > 1ms or cleanup taking > 100ms, indicating bucket map is very large.

**Resolution:**
1. Check `getHealth().activeBuckets` count — if unusually high, dynamic providers may be leaking
2. Reduce cleanup interval or lower the 30-minute stale TTL
3. Investigate if provider keys are being dynamically generated (should be static)

---

## 4. Health Check Procedures

### Programmatic Health Check

```typescript
const health = rateLimitService.getHealth();
// Returns: { activeBuckets: number, providers: string[] }
```

### Health Indicators

| Indicator | Healthy | Warning | Critical |
|---|---|---|---|
| `activeBuckets` | < 100 | 100–500 | > 500 |
| Bucket growth rate | Stable | Increasing | Rapidly increasing |
| `tryAcquire` latency | < 1ms | 1–5ms | > 5ms |

### Manual Verification Steps

1. Call `getHealth()` via IPC and verify `activeBuckets` is within expected range
2. Confirm all expected providers are present in `providers[]`
3. Test `tryAcquire('openai')` returns `true` under normal load

---

## 5. Recovery Procedures

### Scenario: All Tokens Exhausted for a Provider

1. Wait for token refill (automatic based on `requestsPerMinute`)
2. If urgent, call `setLimit(provider, { requestsPerMinute: <higher>, maxBurst: <higher> })`
3. Restart the service if bucket state is corrupted

### Scenario: Cleanup Interval Stopped

1. Check if `cleanupInterval` is `undefined` after initialization
2. Restart the service — `initialize()` recreates the interval
3. The service cleanup (`cleanup()`) clears the interval and all buckets

### Scenario: Service Restart

1. Call `cleanup()` to clear all state and intervals
2. Call `initialize()` to reset default limits and start cleanup timer
3. All previously configured dynamic limits will be lost (defaults only)

---

## 6. Monitoring Alerts and Thresholds

### Telemetry Events

| Event | Description |
|---|---|
| `rate_limit_token_acquired` | Token successfully consumed |
| `rate_limit_token_rejected` | Token request denied |
| `rate_limit_wait_started` | Blocking wait initiated |
| `rate_limit_wait_completed` | Blocking wait succeeded |
| `rate_limit_wait_exceeded` | Wait exceeded max iterations |
| `rate_limit_bucket_cleanup` | Stale buckets cleaned |
| `rate_limit_limit_set` | Rate limit configured |

### Recommended Alerts

| Alert | Condition | Severity |
|---|---|---|
| Token rejection spike | `token_rejected` > 50/min for any provider | Warning |
| Wait exceeded | Any `RATE_LIMIT_WAIT_EXCEEDED` error | Critical |
| Bucket count high | `activeBuckets` > 200 | Warning |
| Performance budget | Any `tryAcquire` budget warning | Warning |
| Cleanup slow | Cleanup budget exceeded | Info |

---

## 7. Log Locations and What to Look For

### Log Output

All logs go through `appLogger` with service name `RateLimitService`.

### Key Log Patterns

| Pattern | Meaning |
|---|---|
| `Initializing rate limit service...` | Service starting up |
| `Rate limiting initialized for N providers` | Startup complete, N buckets created |
| `Performance budget exceeded for tryAcquire` | Token acquisition is slow |
| `Performance budget exceeded for cleanupOldBuckets` | Too many buckets to clean |
| `Cleaning up rate limit service...` | Shutdown initiated |
| `Rate limit service cleaned up` | Shutdown complete |

### Debugging Tips

- Enable debug logging to see individual `tryAcquire`/`waitForToken` calls
- Monitor `getHealth()` periodically to track bucket growth
- Check for repeated `WAIT_EXCEEDED` errors indicating sustained overload
- Compare `activeBuckets` count before and after cleanup cycles

### Log Files

- Primary: `logs/` directory (as per project convention)
- Format: `{service}_{date}.log`
- Look for entries tagged with `RateLimitService`
