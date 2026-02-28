# TelemetryService Runbook

**Service ID:** B-0469
**Source:** `src/main/services/analysis/telemetry.service.ts`
**Extends:** `BaseService`
**Owner:** Observability Team

---

## 1. Service Overview

TelemetryService is Tengra's event telemetry pipeline. It collects, validates, queues, and flushes structured telemetry events. The service respects user opt-in/opt-out via SettingsService and implements queue overflow protection, batch processing, retry logic with exponential backoff, and performance budgeting.

### Responsibilities

- Track individual and batch telemetry events with validation
- Queue events in-memory with overflow protection (max 10,000 events)
- Flush events periodically (every 60 seconds) or on demand
- Retry failed flushes up to 3 times with exponential backoff
- Respect user telemetry opt-in/opt-out preference
- Provide health metrics including queue size, totals, and session info
- Validate event names and properties for security and correctness

### Dependencies

| Dependency | Purpose |
|---|---|
| `SettingsService` | Check telemetry enabled/disabled setting |

---

## 2. Configuration Parameters

### Queue and Batching

| Parameter | Value |
|---|---|
| Max queue size | 10,000 events |
| Flush interval | 60,000ms (1 minute) |
| Max batch size | 500 events per `trackBatch()` call |
| Max event name length | 256 characters |
| Event name pattern | `^[a-zA-Z0-9._-]+$` |
| Max properties size | 100,000 bytes (100KB JSON) |

### Retry Configuration

| Parameter | Value |
|---|---|
| Max retry attempts | 3 |
| Base retry delay | 1,000ms |
| Backoff strategy | Linear (delay × attempt) |

### Performance Budgets

| Operation | Budget (ms) |
|---|---|
| `track` (single) | 10 |
| `flush` | 5,000 |
| `initialize` | 1,000 |
| `cleanup` | 2,000 |
| `trackBatch` | 10 × N events |

### Telemetry Setting Path

```typescript
settings?.telemetry?.enabled  // boolean, default: false
```

---

## 3. Common Failure Modes

### 3.1 TELEMETRY_DISABLED

**Symptom:** `track()` returns `{ success: false, error: 'TELEMETRY_DISABLED' }`.

**Cause:** User has not opted in to telemetry.

**Resolution:**
1. This is expected behavior — respect user preference
2. Enable via Settings: set `telemetry.enabled = true`

### 3.2 QUEUE_OVERFLOW

**Symptom:** `track()` returns `{ success: false, error: 'QUEUE_OVERFLOW' }`.

**Cause:** Queue has reached 10,000 events without being flushed.

**Resolution:**
1. Trigger manual flush: `await telemetryService.flush()`
2. Check if flush interval timer is running
3. Investigate why events are being produced faster than flushed
4. Check if the flush endpoint (PostHog, Mixpanel, etc.) is reachable

### 3.3 INVALID_EVENT_NAME

**Symptom:** `track()` returns `{ success: false, error: 'INVALID_EVENT_NAME' }`.

**Cause:** Event name is empty, too long, or contains invalid characters.

**Resolution:**
1. Use alphanumeric characters, dots, dashes, and underscores only
2. Keep name ≤ 256 characters
3. Example valid names: `workflow_executed`, `proxy.request.sent`

### 3.4 INVALID_PROPERTIES

**Symptom:** `track()` returns `{ success: false, error: 'INVALID_PROPERTIES' }`.

**Cause:** Properties object exceeds 100KB when JSON stringified, or is not serializable.

**Resolution:**
1. Reduce properties payload size
2. Remove large nested objects
3. Ensure properties are JSON-serializable

### 3.5 INVALID_BATCH

**Symptom:** `trackBatch()` returns `{ success: false, error: 'INVALID_BATCH' }`.

**Cause:** Events array is empty, not an array, or exceeds 500 items.

**Resolution:**
1. Ensure events is a non-empty array
2. Keep batch size ≤ 500

### 3.6 FLUSH_FAILED

**Symptom:** All 3 flush retry attempts fail.

**Cause:** Network error, endpoint unavailable, or configuration issue.

**Resolution:**
1. Events are re-queued on failure (if queue has space)
2. If queue is full after failure, events are dropped with a log warning
3. Check network connectivity to telemetry endpoint
4. Check for flush-related error logs

---

## 4. Health Check Procedures

### Programmatic Health Check

```typescript
const health = telemetryService.getHealth();
// Returns: TelemetryHealth
```

### TelemetryHealth Fields

| Field | Description |
|---|---|
| `isHealthy` | `true` if queue < 90% capacity |
| `queueSize` | Current number of queued events |
| `maxQueueSize` | Maximum queue capacity (10,000) |
| `sessionId` | Current session UUID |
| `flushIntervalMs` | Flush frequency (60,000ms) |
| `telemetryEnabled` | Whether user has opted in |
| `lastFlushTime` | Timestamp of last successful flush |
| `totalTrackedEvents` | Lifetime tracked count |
| `totalFlushedEvents` | Lifetime flushed count |

### Health Indicators

| Indicator | Healthy | Warning | Critical |
|---|---|---|---|
| `isHealthy` | `true` | — | `false` |
| `queueSize` | < 5,000 | 5,000–9,000 | > 9,000 |
| Queue fill rate | < 90% | 90–95% | > 95% |
| `lastFlushTime` | < 2 min ago | 2–5 min ago | > 5 min ago |
| Tracked vs flushed delta | < 1,000 | 1,000–5,000 | > 5,000 |

### Manual Verification

1. Check `getHealth()` — verify `isHealthy` is `true`
2. Verify `queueSize` is not growing unboundedly
3. Check `lastFlushTime` is recent (within 2 minutes)
4. Track a test event: `telemetryService.track('test.event', { test: true })`
5. Verify `totalTrackedEvents` incremented

---

## 5. Recovery Procedures

### Scenario: Queue Approaching Overflow

1. Trigger immediate flush: `await telemetryService.flush()`
2. Check if the flush interval is active (should be set on `initialize()`)
3. Investigate event production rate — which service is tracking the most events
4. Consider increasing flush frequency or reducing event volume

### Scenario: Flush Continuously Failing

1. Check `lastFlushTime` — if null, no successful flush has ever occurred
2. Currently flushes are local-only (logged/simulated) — check for code changes
3. If endpoint-backed, verify network connectivity
4. Events are re-queued on failure up to `maxQueueSize`
5. Restart the service to reset state

### Scenario: Telemetry Disabled After Being Enabled

1. Check `SettingsService.getSettings()?.telemetry?.enabled`
2. If accidentally disabled, re-enable in settings
3. Events tracked while disabled are silently dropped (not queued)

### Scenario: Session ID Mismatch

1. Each service instance generates a new UUID session ID
2. Session ID changes on service restart
3. Use `getHealth().sessionId` to verify current session

### Scenario: Full Service Reset

1. `cleanup()` — clears flush interval, triggers final flush
2. `initialize()` — starts new flush interval
3. Queue, counters, and session ID reset on new instance creation

---

## 6. Monitoring Alerts and Thresholds

### Error Codes for Monitoring

| Code | Meaning |
|---|---|
| `TELEMETRY_DISABLED` | User opted out |
| `INVALID_EVENT_NAME` | Bad event name |
| `INVALID_PROPERTIES` | Properties too large or unserializable |
| `INVALID_BATCH` | Invalid batch array |
| `QUEUE_OVERFLOW` | Queue at capacity |
| `FLUSH_FAILED` | All flush retries failed |
| `SETTINGS_ERROR` | Settings service issue |

### Recommended Alerts

| Alert | Condition | Severity |
|---|---|---|
| Queue high | `queueSize` > 8,000 | Warning |
| Queue overflow | `QUEUE_OVERFLOW` error | Critical |
| Flush failure | All retries failed | Warning |
| No flush for 5 min | `lastFlushTime` > 5 min ago | Warning |
| Performance budget | Any operation exceeds budget | Info |
| Events dropped | Log: "Queue full after flush failure" | Critical |

---

## 7. Log Locations and What to Look For

### Log Output

Logs via `appLogger` tagged `TelemetryService` or `Telemetry`.

### Key Log Patterns

| Pattern | Meaning |
|---|---|
| `Initializing Telemetry Service...` | Service starting |
| `Tracked event: <name>` | Event tracked (debug level) |
| `Invalid event name rejected` | Bad event name (warn) |
| `Invalid properties rejected` | Properties validation failed (warn) |
| `Queue overflow, dropping event` | Queue full (warn) |
| `Batch too large` | Batch exceeds 500 items (warn) |
| `Flush attempt N/3 failed` | Retry in progress (warn) |
| `All flush attempts failed, re-queued events` | Re-queued after failure (error) |
| `Queue full after flush failure, dropping events` | Events lost (error) |
| `Performance budget exceeded for <op>` | Slow operation (warn) |

### Debugging Tips

- Check `getHealth()` periodically to monitor queue growth
- Compare `totalTrackedEvents` vs `totalFlushedEvents` for pipeline health
- Events are only tracked when `telemetry.enabled = true` in settings
- The flush mechanism is currently a simulation — check if an actual endpoint is configured
- Log files in `logs/` directory, tagged `TelemetryService` or `Telemetry`
