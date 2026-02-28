# MonitoringService Runbook

**Service ID:** B-0459
**Source:** `src/main/services/analysis/monitoring.service.ts`
**Extends:** `BaseService`
**Owner:** Observability Team

---

## 1. Service Overview

MonitoringService provides real-time system monitoring capabilities for Tengra, collecting CPU, memory, and battery metrics using OS-level commands. It supports custom metric recording, threshold-based alerting, and aggregated metric collection with per-platform command execution.

### Responsibilities

- Collect CPU usage (via `os.loadavg()`) and memory usage (via `os.totalmem()`/`os.freemem()`)
- Execute platform-specific commands for detailed system monitoring (Windows, Linux, macOS)
- Collect battery status using platform-specific commands
- Record custom named metrics with timestamps
- Configure metric thresholds and alert rules
- Aggregate all metrics in a single `collectAllMetrics()` call with failure isolation
- Retry transient command failures with exponential backoff

### Dependencies

- `os` module — CPU and memory statistics
- `child_process.exec` — platform-specific command execution
- `withRetry` utility — retry logic for transient failures

---

## 2. Configuration Parameters

### Command Execution

| Parameter | Value |
|---|---|
| Command timeout | 5,000ms |
| Max output size | 1MB (1,048,576 bytes) |
| Retry attempts | 2 |
| Retry base delay | 500ms |
| Max timeout allowed | 30,000ms |

### Metric Recording

| Parameter | Value |
|---|---|
| Max metric name length | 128 characters |
| Metric name pattern | `^[a-zA-Z][a-zA-Z0-9._-]*$` |
| Max stored metrics | 1,000 |
| Max threshold value | 1,000,000 |

### Performance Budgets

| Operation | Budget (ms) |
|---|---|
| `getUsage` | 100 |
| `getSystemMonitor` | 6,000 |
| `getBatteryStatus` | 6,000 |
| `collectAllMetrics` | 15,000 |
| `initialize` | 100 |
| `cleanup` | 100 |

### Platform Commands

| Platform | System Monitor | Battery |
|---|---|---|
| Windows | `wmic cpu get loadpercentage /value` | `Get-CimInstance Win32_Battery` |
| Linux | `top -bn1 \| grep "Cpu(s)"` | `upower -e \| grep battery` → `upower -i` |
| macOS | `top -l 1 -n 0` | `pmset -g batt` |

---

## 3. Common Failure Modes

### 3.1 MONITORING_COMMAND_TIMEOUT

**Symptom:** Error: `Command timed out after 5000ms`.

**Cause:** System command took too long (high system load, process contention).

**Resolution:**
1. Check system load — high CPU/IO may delay command execution
2. The service retries up to 2 times with 500ms+ delay between attempts
3. If persistent, investigate system-level issues (disk I/O, swap usage)

### 3.2 MONITORING_COMMAND_FAILED

**Symptom:** Command execution returns an error.

**Cause:** Command not found, permission denied, or platform-specific issue.

**Resolution:**
1. Verify the command exists on the current platform
2. Check application permissions for running system commands
3. On Linux, ensure `upower` is installed for battery monitoring
4. On Windows, verify `wmic` is available (deprecated on newer Windows)

### 3.3 MONITORING_UNSUPPORTED_PLATFORM

**Symptom:** Returns `{ success: false, error: 'MONITORING_UNSUPPORTED_PLATFORM' }`.

**Cause:** Running on an unsupported OS (not win32, linux, or darwin).

**Resolution:** This service only supports Windows, Linux, and macOS.

### 3.4 MONITORING_NO_BATTERY

**Symptom:** Returns `{ success: false, error: 'MONITORING_NO_BATTERY' }`.

**Cause:** No battery device detected (desktop machine or VM).

**Resolution:** Expected behavior on desktops — not an error condition.

### 3.5 MONITORING_OUTPUT_TRUNCATED

**Symptom:** Warning log: "getSystemMonitor output truncated".

**Cause:** Command output exceeds 1MB limit.

**Resolution:**
1. Output is auto-truncated to 1MB for safety
2. If needed, investigate why the command produces excessive output

### 3.6 Max Metrics Count Reached

**Symptom:** `recordMetric()` returns `{ success: false, error: 'Maximum number of metrics (1000) reached' }`.

**Resolution:**
1. Check for metric name proliferation (dynamic names)
2. Cleanup old metrics by restarting the service
3. Use consistent metric names to avoid exceeding the limit

---

## 4. Health Check Procedures

### Programmatic Health Check

```typescript
const telemetry = monitoringService.getTelemetry();
// Returns: { serviceName: string, initialized: boolean, telemetryEnabled: boolean }
```

### Quick Usage Check

```typescript
const usage = await monitoringService.getUsage();
// Returns: { success: boolean, result?: { cpu: number, memory: number } }
```

### Full Metrics Collection

```typescript
const all = await monitoringService.collectAllMetrics();
// Returns: { success, result: { usage, systemMonitor, battery, errors[] } }
```

### Health Indicators

| Indicator | Healthy | Warning | Critical |
|---|---|---|---|
| `telemetryEnabled` | `true` | — | `false` |
| CPU usage | < 80% | 80–95% | > 95% |
| Memory usage | < 80% | 80–95% | > 95% |
| Command timeout rate | 0% | < 10% | > 10% |
| Metric count | < 500 | 500–900 | > 900 |
| `collectAllMetrics` | All 3 succeed | 1–2 fail | All fail |

### Manual Verification

1. Call `getUsage()` and verify CPU/memory values are reasonable
2. Call `getSystemMonitor()` and verify platform command output
3. Call `getBatteryStatus()` (expect NO_BATTERY on desktops)
4. Record a test metric: `recordMetric('test.metric', 42)`
5. Retrieve it: `getMetric('test.metric')`

---

## 5. Recovery Procedures

### Scenario: All Metric Collectors Failing

1. Check `collectAllMetrics()` → `result.errors[]` for specific failures
2. Each collector is independent — one failure doesn't affect others
3. Verify OS commands are available on the platform
4. Check system permissions for command execution
5. Restart the service: `cleanup()` → `initialize()`

### Scenario: Command Execution Stuck

1. Commands have a 5-second timeout with automatic rejection
2. Retries happen up to 2 times with 500ms+ base delay
3. If all retries fail, the error is propagated
4. Check system load — commands may time out under heavy load

### Scenario: Metrics Not Recording

1. Verify the service is initialized (`telemetryEnabled = true`)
2. Check metric name validity (starts with letter, valid chars only)
3. Check if the 1,000-metric limit has been reached
4. Restart the service to clear metric storage

### Scenario: Alerts Not Firing

1. Verify alert configuration: `configureAlert({ metricName, threshold, direction, enabled: true })`
2. Ensure `direction` is `'above'` or `'below'`
3. Verify `threshold` is non-negative and ≤ 1,000,000
4. Check `enabled` is explicitly `true`

---

## 6. Monitoring Alerts and Thresholds

### Telemetry Events

| Event | Description |
|---|---|
| `monitoring_usage_checked` | CPU/memory check completed |
| `monitoring_system_monitor_checked` | System monitor command ran |
| `monitoring_battery_checked` | Battery status checked |
| `monitoring_command_timeout` | Command timed out |
| `monitoring_command_failed` | Command execution failed |

### Alert Configuration

```typescript
monitoringService.configureAlert({
    metricName: 'cpu.usage',
    threshold: 90,
    direction: 'above',
    enabled: true
});
```

### Recommended Alerts

| Alert | Condition | Severity |
|---|---|---|
| High CPU | CPU load > 90% sustained | Warning |
| High memory | Memory > 90% | Warning |
| Critical memory | Memory > 95% | Critical |
| Command timeout | > 3 timeouts in 5 min | Warning |
| All collectors fail | `collectAllMetrics` returns all null | Critical |
| Metric limit near | Stored metrics > 900 | Warning |

---

## 7. Log Locations and What to Look For

### Log Output

Logs via `BaseService` methods and `appLogger`, tagged `MonitoringService`.

### Key Log Patterns

| Pattern | Meaning |
|---|---|
| `Initializing monitoring service...` | Service starting |
| `Monitoring service initialized` | Startup complete |
| `Cleaning up monitoring service...` | Shutdown starting |
| `Monitoring service cleaned up` | Shutdown complete |
| `Performance budget exceeded for <method>` | Operation too slow |
| `getSystemMonitor output truncated` | Output exceeded 1MB |
| `executeWithTimeout retrying` | Command retry in progress |
| `collectAllMetrics: <label> returned failure` | Individual collector failed |
| `collectAllMetrics: <label> threw` | Individual collector threw exception |

### Debugging Tips

- Use `getUsage()` for lightweight health pings (no subprocess)
- Use `collectAllMetrics()` for comprehensive checks
- Monitor `errors[]` in `collectAllMetrics()` response for partial failures
- On Windows, `wmic` may be deprecated — check for PowerShell alternatives
- Log files in `logs/` directory, tagged `MonitoringService`
