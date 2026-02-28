# QuotaService Runbook

**Service ID:** B-0429
**Source:** `src/main/services/proxy/quota.service.ts`
**Extends:** None (standalone class)
**Owner:** Infrastructure Team

---

## 1. Service Overview

QuotaService manages quota tracking and usage monitoring for all external AI providers in Tengra. It fetches, parses, and exposes quota information for Antigravity/Google, Codex/OpenAI, Claude/Anthropic, and Copilot/GitHub accounts, enabling the UI to display remaining capacity and alerting when quotas are low.

### Responsibilities

- Fetch and parse quota data from Antigravity/Google upstream APIs
- Fetch Codex/OpenAI usage data from the WHAM API
- Fetch Claude/Anthropic quota and session management
- Fetch Copilot/GitHub quota with account deduplication
- Validate inputs (ports, session keys, account objects)
- Start the `tengra-quota-service` background process
- Provide legacy quota compatibility endpoint

### Dependencies

| Dependency | Purpose |
|---|---|
| `SettingsService` | Codex configuration and API keys |
| `AuthService` | Account retrieval and token management |
| `ProcessManagerService` | Start `tengra-quota-service` process |
| `TokenService` | Token management for Antigravity |

### Delegated Handlers

| Handler | Provider | Source |
|---|---|---|
| `AntigravityHandler` | Antigravity/Google | `quota/antigravity-handler.ts` |
| `CodexHandler` | Codex/OpenAI | `quota/codex-handler.ts` |
| `ClaudeHandler` | Claude/Anthropic | `quota/claude-handler.ts` |
| `CopilotHandler` | Copilot/GitHub | `quota/copilot-handler.ts` |

---

## 2. Configuration Parameters

### Performance Budgets

| Operation | Budget (ms) |
|---|---|
| `fetchQuota` | 10,000 |
| `fetchCodexUsage` | 10,000 |
| `fetchClaudeQuota` | 10,000 |
| `fetchCopilotQuota` | 10,000 |
| `saveSession` | 1,000 |

### Validation Rules

| Parameter | Rule |
|---|---|
| `proxyPort` | Integer, 1–65535 |
| `proxyKey` | Non-empty string after trim |
| `sessionKey` | Non-empty string after trim |
| `accountId` | Non-empty string (if provided) |
| `LinkedAccount` | Must have non-empty `id` and `provider` |

### Background Process

- **Name:** `quota-service`
- **Executable:** `tengra-quota-service`
- **Persistent:** Yes (started on construction)

---

## 3. Common Failure Modes

### 3.1 QUOTA_FETCH_FAILED

**Symptom:** `getQuota()` throws `QuotaError` with code `FETCH_FAILED`.

**Cause:** Network error, upstream API unavailable, or invalid account data.

**Resolution:**
1. Check network connectivity to upstream providers
2. Verify accounts exist via `authService.getAllAccountsFull()`
3. Check if tokens have expired (`QUOTA_AUTH_EXPIRED`)
4. Review handler-specific logs for detailed error

### 3.2 QUOTA_AUTH_EXPIRED

**Symptom:** Quota response returns `{ success: false, authExpired: true, status: 'Expired' }`.

**Cause:** Account access token has expired.

**Resolution:**
1. Re-authenticate the affected provider via ProxyService
2. Check `AuthService` for token refresh mechanisms
3. Verify token expiration timestamps

### 3.3 QUOTA_EXCEEDED

**Symptom:** Quota response returns `{ success: false, status: 'Exceeded' }`.

**Cause:** Provider quota has been consumed.

**Resolution:**
1. Wait for quota reset (check `next_reset` field)
2. Switch to an alternative provider if available
3. Review usage patterns and optimize request frequency

### 3.4 QUOTA_ACCOUNT_LOCKED

**Symptom:** Quota response returns `{ success: false, status: 'Locked' }`.

**Cause:** Provider account has been locked (billing, abuse, etc.).

**Resolution:**
1. Contact the provider to resolve account issues
2. Remove the locked account from Tengra
3. Use an alternative account

### 3.5 QUOTA_INVALID_SESSION_KEY

**Symptom:** `saveClaudeSession()` returns `{ success: false, code: 'QUOTA_INVALID_SESSION_KEY' }`.

**Resolution:**
1. Verify the session key is a non-empty string
2. Re-obtain the Claude session key from the provider

### 3.6 Background Process Failure

**Symptom:** Log: `Failed to start quota service: <error>`.

**Cause:** `tengra-quota-service` binary missing or failed to start.

**Resolution:**
1. Verify the binary exists in the expected location
2. Check ProcessManager for process status
3. Restart the application

---

## 4. Health Check Procedures

### Provider Quota Check

```typescript
// Antigravity/Google quota
const quota = await quotaService.getQuota(proxyPort, proxyKey);
// Returns: { accounts: [{ success, status, models, accountId, email }] }

// Codex usage
const codex = await quotaService.getCodexUsage();
// Returns: { accounts: [{ usage, accountId, email }] }

// Claude quota
const claude = await quotaService.getClaudeQuota();
// Returns: { accounts: [ClaudeQuota[]] }

// Copilot quota
const copilot = await quotaService.getCopilotQuota();
// Returns: { accounts: [CopilotQuota[]] }
```

### Health Indicators

| Indicator | Healthy | Warning | Critical |
|---|---|---|---|
| Quota remaining | > 30% | 10–30% | < 10% |
| `authExpired` | `false` | — | `true` |
| Account status | Active | — | Locked/Exceeded |
| Background process | Running | — | Not running |
| Fetch latency | < 5s | 5–10s | > 10s |

### Manual Verification

1. Call `getQuota()` for each provider and verify `success: true`
2. Check that `models[]` array contains expected models
3. Verify `remainingFraction` > 0 for active models
4. Confirm background process is running via ProcessManager

---

## 5. Recovery Procedures

### Scenario: All Accounts Show Auth Expired

1. Re-authenticate each provider through ProxyService auth flows
2. Verify tokens are stored via `AuthService.getAllAccountsFull()`
3. Retry quota fetch after re-authentication

### Scenario: Quota Exceeded for Primary Provider

1. Check `next_reset` for when quota will refresh
2. Switch chat/request routing to an alternative provider
3. Review and reduce unnecessary API calls

### Scenario: Background Service Crash

1. Check ProcessManager for `tengra-quota-service` status
2. Restart: `processManager.startService({ name: 'quota-service', executable: 'tengra-quota-service', persistent: true })`
3. If persistent failures, check binary integrity

### Scenario: Copilot Account Deduplication Issues

1. The service deduplicates copilot accounts by email/token
2. If duplicate accounts appear, check `AuthService` for duplicate entries
3. The service prefers `github` provider over `copilot` when both exist

---

## 6. Monitoring Alerts and Thresholds

### Telemetry Events

| Event | Description |
|---|---|
| `quota_fetched` | Quota successfully retrieved |
| `quota_fetch_failed` | Quota fetch failed |
| `quota_codex_usage_fetched` | Codex usage data retrieved |
| `quota_claude_quota_fetched` | Claude quota retrieved |
| `quota_copilot_quota_fetched` | Copilot quota retrieved |
| `quota_auth_expired` | Authentication expired for a provider |

### Recommended Alerts

| Alert | Condition | Severity |
|---|---|---|
| Quota low | `remainingFraction` < 0.1 for any model | Warning |
| Quota exhausted | `remainingFraction` = 0 | Critical |
| Auth expired | Any account returns `authExpired: true` | Warning |
| Account locked | Any account returns `status: 'Locked'` | Critical |
| Fetch failure | Repeated `QUOTA_FETCH_FAILED` errors | Warning |
| Background process down | `tengra-quota-service` not running | Critical |

---

## 7. Log Locations and What to Look For

### Log Output

Logs via `appLogger` tagged `QuotaService`.

### Key Log Patterns

| Pattern | Meaning |
|---|---|
| `Failed to start quota service: <err>` | Background process failed |
| `getQuota: invalid proxyPort` | Invalid port passed to getQuota |
| `getQuota: proxyKey must be a non-empty string` | Missing proxy key |
| `Failed to get quota: <err>` | Quota fetch error |
| `Account locked: <err>` | Provider account is locked |
| `Failed to get Antigravity models: <err>` | Model list fetch failed |
| `Failed to fetch Codex quota: <err>` | Codex quota fetch failed |

### Debugging Tips

- Use `fetchAntigravityQuota()` to test individual provider connectivity
- Check `AuthService.getAllAccountsFull()` to verify account state
- Monitor the `tengra-quota-service` process via ProcessManager
- Compare quota data across providers to identify which is limiting
- Log files in `logs/` directory, tagged with `QuotaService`
