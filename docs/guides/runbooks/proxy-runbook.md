# ProxyService Runbook

**Service ID:** B-0419
**Source:** `src/main/services/proxy/proxy.service.ts`
**Extends:** `BaseService`
**Owner:** Infrastructure Team

---

## 1. Service Overview

ProxyService manages the AI proxy layer in Tengra. It handles authentication with upstream providers (GitHub/Copilot, Antigravity/Google, Claude, Codex/OpenAI), manages the proxy process lifecycle, routes LLM requests through a local proxy server, and enforces per-provider rate limiting with queuing and priority support.

### Responsibilities

- Start/stop the local proxy process via `ProxyProcessManager`
- Authenticate with GitHub (device code OAuth flow), Google/Antigravity, Claude, and Codex
- Route API requests to LLM providers through the proxy
- Enforce per-provider sliding-window rate limits with priority queues
- Manage proxy authentication keys and auth store encryption
- Emit rate limit warnings via EventBus
- Fetch available models from the proxy

### Dependencies

| Dependency | Purpose |
|---|---|
| `SettingsService` | Proxy configuration and settings |
| `DataService` | File paths for auth data and config |
| `SecurityService` | Encryption for auth store key |
| `ProxyProcessManager` | Proxy binary lifecycle management |
| `QuotaService` | Quota fetching for providers |
| `AuthService` | Account and token management |
| `EventBusService` | Event emission for rate limits and token refreshes |

---

## 2. Configuration Parameters

### Default Port

- **Port:** `8317` (configurable via settings)

### Provider Rate Limit Defaults

| Provider | Window (ms) | Max Requests | Warning Threshold | Max Queue | Premium Bypass |
|---|---|---|---|---|---|
| `github` | 60,000 | 60 | 85% | 100 | No |
| `codex` | 60,000 | 80 | 85% | 120 | Yes |
| `claude` | 60,000 | 70 | 85% | 100 | Yes |
| `antigravity` | 60,000 | 80 | 85% | 120 | Yes |
| `proxy` | 60,000 | 120 | 90% | 200 | Yes |
| `default` | 60,000 | 60 | 85% | 100 | No |

### Performance Budgets

| Operation | Budget (ms) |
|---|---|
| Start proxy | 10,000 |
| Stop proxy | 5,000 |
| API request | 30,000 |
| Authentication | 30,000 |
| Health check | 5,000 |
| Initialize | 10,000 |
| Config generation | 2,000 |
| Get models | 15,000 |

### GitHub OAuth Clients

| App ID | Client ID | Scope |
|---|---|---|
| `profile` | `01ab8ac9400c4e429b23` | `read:user user:email repo` |
| `copilot` | `01ab8ac9400c4e429b23` | `read:user user:email` |

---

## 3. Common Failure Modes

### 3.1 PROXY_NOT_INITIALIZED

**Symptom:** Requests fail with `PROXY_NOT_INITIALIZED` error.

**Cause:** Proxy process hasn't started or failed during startup.

**Resolution:**
1. Check proxy process status via `ProxyProcessManager`
2. Verify the proxy binary exists at the expected path
3. Check port 8317 is not in use: `netstat -ano | findstr :8317`
4. Review startup logs for `PROXY_BINARY_NOT_FOUND` or `PROXY_PORT_IN_USE`

### 3.2 PROXY_AUTH_FAILED

**Symptom:** Authentication requests return `PROXY_AUTH_FAILED`.

**Cause:** Invalid tokens, expired sessions, or auth store encryption issues.

**Resolution:**
1. Verify the auth store encryption key is initialized (`ensureAuthStoreKey()`)
2. Check if the proxy key is set (`ensureProxyKey()`)
3. Re-authenticate the affected provider
4. Check EventBus for `token:refreshed` events

### 3.3 Rate Limit Queue Full

**Symptom:** Error `Rate limit queue full for provider <name>`.

**Cause:** Provider rate limit is consistently exceeded and the queue has reached `maxQueueSize`.

**Resolution:**
1. Check `getProviderRateLimitMetrics()` for the affected provider
2. Increase `maxQueueSize` or `maxRequests` via `setProviderRateLimitConfig()`
3. Investigate if there's a request amplification loop
4. Check if the upstream provider has reduced their limits

### 3.4 PROXY_CONNECTION_FAILED

**Symptom:** Proxy requests fail with connection errors.

**Resolution:**
1. Verify proxy process is running
2. Check network connectivity
3. Verify proxy port is accessible: `Test-NetConnection -ComputerName localhost -Port 8317`
4. Restart proxy process

### 3.5 PROXY_START_FAILED

**Symptom:** Proxy fails to start during initialization.

**Resolution:**
1. Check if the proxy binary exists in the expected location
2. Verify no other process is using port 8317
3. Check filesystem permissions on the proxy binary
4. Review process manager logs for crash details

---

## 4. Health Check Procedures

### Rate Limit Metrics

```typescript
const metrics = proxyService.getProviderRateLimitMetrics();
// Returns: { generatedAt: number, providers: ProviderRateLimitSnapshot[] }
```

Each provider snapshot includes:
- `limit` / `remaining` — current window utilization
- `queued` — requests waiting in queue
- `blocked` / `allowed` / `bypassed` — lifetime counters
- `warnings` — rate limit warning count
- `resetAt` — when the current window resets

### Health Indicators

| Indicator | Healthy | Warning | Critical |
|---|---|---|---|
| Proxy process | Running | Restarting | Down |
| Provider `remaining` | > 20% of limit | 5–20% | < 5% or 0 |
| Queue depth (`queued`) | 0 | 1–50 | > 50 |
| `blocked` rate | < 5/min | 5–20/min | > 20/min |

### Manual Verification

1. Check proxy process status via ProcessManager
2. Run `getProviderRateLimitMetrics()` and inspect all providers
3. Attempt a test request through the proxy
4. Verify `getProviderRateLimitConfig()` matches expected defaults

---

## 5. Recovery Procedures

### Scenario: Proxy Process Crashed

1. Check ProcessManager for crash status and exit code
2. Verify binary integrity
3. Kill any orphaned proxy processes
4. Call `processManager.start()` or restart the service
5. `cleanup()` force-kills all proxy processes including orphaned ones

### Scenario: Authentication Expired

1. Check EventBus for `token:refreshed` events
2. Re-initiate auth flow for the affected provider:
   - GitHub: `initiateGitHubAuth()` → `waitForGitHubToken()`
   - Google/Antigravity: `getAntigravityAuthUrl()`
3. Verify new tokens are stored via `AuthService`

### Scenario: Rate Limit Storm

1. Identify affected providers via `getProviderRateLimitMetrics()`
2. Temporarily increase limits: `setProviderRateLimitConfig(provider, { maxRequests: 200 })`
3. Identify and fix the root cause of excessive requests
4. Reset limits to defaults after resolution

### Scenario: Full Service Restart

1. `cleanup()` — stops proxy, clears queue timers, force-kills processes
2. `initialize()` — re-creates auth keys, proxy key, and rate limit configs
3. All queued rate limit requests will be rejected on cleanup

---

## 6. Monitoring Alerts and Thresholds

### Telemetry Events

| Event | Description |
|---|---|
| `proxy_started` | Proxy process started |
| `proxy_stopped` | Proxy process stopped |
| `proxy_request_sent` | Request routed through proxy |
| `proxy_request_failed` | Proxy request failed |
| `proxy_auth_initiated` | OAuth flow started |
| `proxy_auth_completed` | OAuth flow succeeded |
| `proxy_auth_failed` | OAuth flow failed |
| `proxy_health_check` | Health check performed |

### EventBus Events

| Event | Payload |
|---|---|
| `proxy:rate-limit-warning` | `{ provider, limit, remaining, queued, resetAt, timestamp }` |
| `token:refreshed` | `{ provider }` |

### Recommended Alerts

| Alert | Condition | Severity |
|---|---|---|
| Proxy process down | Process not running | Critical |
| Rate limit warning | `proxy:rate-limit-warning` event fired | Warning |
| Queue full | `Rate limit queue full` error | Critical |
| Auth failure spike | > 3 `proxy_auth_failed` in 5 min | Warning |
| High blocked rate | `blocked` > 50/min for any provider | Warning |
| Request timeout | Request exceeds 30s budget | Warning |

---

## 7. Log Locations and What to Look For

### Log Output

All logs via `appLogger` tagged `ProxyService`.

### Key Log Patterns

| Pattern | Meaning |
|---|---|
| `Token refreshed for <provider>` | Token was auto-refreshed |
| `initialize exceeded budget` | Startup took too long |
| `Proxy service stopped (force killed all proxy processes)` | Clean shutdown |
| `Failed to stop proxy during cleanup` | Unclean shutdown |
| `Rate limit queue full for provider` | Queue overflow (error) |

### Provider Normalization

Provider names are normalized before rate limiting:
- `github`, `copilot` → `github`
- `anthropic`, `claude` → `claude`
- `antigravity`, `google`, `gemini` → `antigravity`
- `codex`, `openai` → `codex`

### Debugging Tips

- Use `getProviderRateLimitConfig()` to dump all provider configs
- Use `getProviderRateLimitMetrics()` to get real-time snapshots
- Monitor EventBus `proxy:rate-limit-warning` for early detection
- Check `bypassed` counter to verify premium bypass is working correctly
- Log files in `logs/` directory, tagged with `ProxyService`
