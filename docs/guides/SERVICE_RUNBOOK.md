# Service Operational Runbook

> Operational guide for troubleshooting and maintaining Tengra backend services.

## General Troubleshooting

1. Check logs in `logs/` directory (format: `{service}_{date}.log`)
2. Verify service initialization in startup logs — look for `Initializing...` messages from `appLogger`
3. Use health endpoints (`getHealth` / `getMetrics` / `getTelemetry`) for diagnostics where available
4. Review `AppErrorCode` in `src/shared/utils/error.util.ts` for global error codes
5. Run `npm run build && npm run lint && npm run type-check` to verify service integrity

---

## AgentCollaborationService

### Overview

Multi-model collaboration orchestrating voting sessions, consensus building, debate rounds, and intelligent model routing by task type (code generation, review, debugging, etc.).

### Health Check

- No dedicated health endpoint; monitor via `AgentCollaborationTelemetryEvent` events
- Check for `agent_collab_*` telemetry events (`VOTING_SESSION_CREATED`, `VOTING_COMPLETED`, `CONSENSUS_REACHED`, `CONSENSUS_FAILED`, `DEBATE_STARTED`, `DEBATE_COMPLETED`)
- Verify LLM service connectivity for model routing

### Common Issues

- **Voting timeout**: Voting budget is 30 000 ms (`EXECUTE_VOTING_MS`). Check LLM service connectivity and model availability
- **Consensus failure**: Consensus budget is 30 000 ms (`BUILD_CONSENSUS_MS`). Verify that enough models are available to participate
- **Routing mismatch**: Review `DEFAULT_ROUTING_RULES` — GPT-4o handles code_generation/debugging, Claude handles code_review/planning/refactoring
- **Debate timeout**: Debate budget is 60 000 ms (`DEBATE_SESSION_MS`). Ensure participating models are responsive
- **Collaboration loop detected**: The service detects repeated collaboration requests; check for `COLLABORATION_LOOP_DETECTED` errors in logs

### Error Codes

Uses `AgentCollaborationError` (custom error class with string `code` property):

| Code | Description |
|------|-------------|
| `MISSING_TASK_ID` | Required taskId not provided |
| `MISSING_AGENT_ID` | Required agentId not provided |
| `MISSING_TOPIC` | Debate topic not provided |
| `MISSING_DECISION` | Final decision not provided for resolution |
| `MISSING_STAGE_ID` | Required stageId not provided |
| `INVALID_OPTIONS` | Fewer than 2 voting options provided |
| `INVALID_ROUTING_RULES` | Routing rules validation failed |
| `INVALID_DEBATE_ARGUMENT` | Debate argument validation failed |
| `INVALID_COLLABORATION_INTENT` | Unsupported collaboration intent |
| `VOTING_SESSION_INVALID` | Failed to create a valid voting session |
| `VOTING_SESSION_NOT_FOUND` | Voting session ID not found |
| `DEBATE_SESSION_NOT_FOUND` | Debate session ID not found |
| `COLLABORATION_PAYLOAD_TOO_LARGE` | Payload has too many keys |
| `COLLABORATION_PAYLOAD_KEY_TOO_LONG` | Payload key exceeds length limit |
| `COLLABORATION_PAYLOAD_VALUE_TOO_LONG` | Payload value exceeds length limit |
| `COLLABORATION_LOOP_DETECTED` | Repeated collaboration request detected |

---

## AgentCheckpointService

### Overview

Agent task checkpoint management: save, restore, and rollback task state with gzip-compressed snapshots and automatic deduplication.

### Health Check

- No dedicated health endpoint; verify database connectivity
- Check checkpoint count per task — maximum is 200 (`MAX_CHECKPOINTS_PER_TASK`)
- Monitor save/restore performance budgets: save 2 000 ms, restore 2 000 ms, rollback 5 000 ms

### Common Issues

- **Save failure**: Check disk space and database connection. Look for `SAVE_FAILED` error code in logs
- **Restore failure**: Verify checkpoint data integrity — snapshots use gzip compression (`gzip:` prefix). Decompression errors indicate data corruption
- **Serialization failure**: `SERIALIZATION_FAILED` indicates the state object cannot be serialized to a snapshot
- **Checkpoint limit reached**: Each task is limited to 200 checkpoints. Prune old checkpoints if limit is hit

### Error Codes

Uses `AgentCheckpointError` (custom error class with string `code` property):

| Code | Description |
|------|-------------|
| `MISSING_TASK_ID` | Required taskId not provided |
| `SAVE_FAILED` | Checkpoint persistence failed |
| `SERIALIZATION_FAILED` | Snapshot serialization/compression failed |

---

## RateLimitService

### Overview

Token-bucket rate limiting for 30+ provider types including LLM APIs, MCP servers, and agent operations. Implements per-minute limits with burst allowances and automatic bucket cleanup.

### Health Check

- `getHealth()` — returns active bucket count and provider list
- Check for stale buckets (cleanup runs every 5 minutes; max age 30 minutes)

### Common Issues

- **Wait timeout**: Token wait exceeds 100 iterations (`MAX_WAIT_ITERATIONS`) or 60 000 ms (`WAIT_FOR_TOKEN_MS`). Reduce request rate or increase provider limits
- **Invalid provider**: Provider string not recognized. Check `PROVIDER_LIMITS` configuration
- **Burst exhaustion**: Burst tokens are consumed first; sustained high traffic depletes them. Monitor burst vs. sustained rate
- **Stale buckets**: Buckets older than 30 minutes are auto-cleaned. If memory grows, check cleanup interval

### Error Codes

```typescript
enum RateLimitErrorCode {
    INVALID_PROVIDER  = 'RATE_LIMIT_INVALID_PROVIDER',
    INVALID_CONFIG    = 'RATE_LIMIT_INVALID_CONFIG',
    WAIT_EXCEEDED     = 'RATE_LIMIT_WAIT_EXCEEDED',
    SERVICE_NOT_INITIALIZED = 'RATE_LIMIT_NOT_INITIALIZED'
}
```

### Provider Limits (examples)

| Provider | Requests/min | Burst |
|----------|-------------|-------|
| OpenAI / Gemini | 60 | 10 |
| Anthropic | 50 | 5 |
| MCP Filesystem | 200 | 30 |
| MCP Database | 100 | 20 |
| Agent Execution | 20 | — |
| Embedding | 100 | — |

---

## ProxyService

### Overview

Manages the LLM proxy server lifecycle, authentication (GitHub Device Flow), and request routing to external model providers with integrated rate limiting and quota tracking.

### Health Check

- Verify proxy process is running on the expected port
- Check authentication state — tokens may expire and need refresh
- Monitor `HEALTH_CHECK_MS` (5 000 ms) for connectivity verification

### Common Issues

- **Startup failure**: Proxy process fails to start within 10 000 ms (`START_MS`). Check port availability and process permissions
- **Authentication failure**: GitHub Device Flow auth fails or token expires. Verify network access to `github.com/login/device/code` and `github.com/login/oauth/access_token`
- **Request timeout**: Requests timeout after 30 000 ms (`REQUEST_MS`). Check upstream provider availability
- **Connection failure**: Proxy connection drops. Verify proxy process health and network stability

### Error Codes

```typescript
enum ProxyErrorCode {
    NOT_INITIALIZED   = 'PROXY_NOT_INITIALIZED',
    START_FAILED      = 'PROXY_START_FAILED',
    STOP_FAILED       = 'PROXY_STOP_FAILED',
    AUTH_FAILED       = 'PROXY_AUTH_FAILED',
    REQUEST_FAILED    = 'PROXY_REQUEST_FAILED',
    INVALID_CONFIG    = 'PROXY_INVALID_CONFIG',
    CONNECTION_FAILED = 'PROXY_CONNECTION_FAILED',
    TIMEOUT           = 'PROXY_TIMEOUT'
}
```

---

## QuotaService

### Overview

Fetches and caches API usage quotas across multiple providers (Antigravity, Codex/OpenAI, Claude, Copilot/GitHub). Tracks remaining usage per provider and model.

### Health Check

- No dedicated health endpoint; verify quota data freshness
- Check authentication status for each provider
- Monitor fetch operations — budget is 10 000 ms (`FETCH_QUOTA_MS`)

### Common Issues

- **Auth expired**: Provider authentication tokens have expired. Re-authenticate through ProxyService
- **Fetch failure**: Upstream quota API unreachable. Check network and provider status
- **No linked accounts**: Provider requires linked accounts that are missing. Verify account linking in settings
- **Parse failure**: Quota response format changed or is malformed. Check provider API version compatibility

### Error Codes

```typescript
enum QuotaErrorCode {
    INVALID_SESSION_KEY = 'QUOTA_INVALID_SESSION_KEY',
    FETCH_FAILED        = 'QUOTA_FETCH_FAILED',
    AUTH_EXPIRED         = 'QUOTA_AUTH_EXPIRED',
    NO_ACCOUNTS          = 'QUOTA_NO_ACCOUNTS',
    PARSE_FAILED         = 'QUOTA_PARSE_FAILED'
}
```

---

## WorkflowService

### Overview

Manages workflow definitions, execution, and persistence. Supports manual triggers, LLM prompts, and agent actions via a plugin-based runner. Workflows stored in `userData/workflows.json`.

### Health Check

- `getHealth()` — returns total workflow count, enabled workflow count, and workflow IDs
- Verify `workflows.json` file exists and is readable

### Common Issues

- **Workflow not found**: Requested workflow ID does not exist. Verify ID and reload workflows
- **Disabled workflow**: Attempting to execute a disabled workflow. Enable it first via settings
- **Execution timeout**: Workflow execution budget is 300 000 ms (5 min, `EXECUTE_MS`). Break large workflows into smaller steps
- **Load/Save failure**: Disk I/O error on `workflows.json`. Check file permissions and disk space. Load/save budget is 2 000 ms each

### Error Codes

```typescript
enum WorkflowErrorCode {
    NOT_FOUND        = 'WORKFLOW_NOT_FOUND',
    DISABLED         = 'WORKFLOW_DISABLED',
    INVALID_INPUT    = 'WORKFLOW_INVALID_INPUT',
    SAVE_FAILED      = 'WORKFLOW_SAVE_FAILED',
    LOAD_FAILED      = 'WORKFLOW_LOAD_FAILED',
    EXECUTION_FAILED = 'WORKFLOW_EXECUTION_FAILED'
}
```

---

## FeatureFlagService

### Overview

Manages feature flags with optional rollout percentages. Persists flags to disk and merges with compile-time defaults on load.

### Health Check

- `getHealth()` — returns total flag count, enabled flag count, and flag IDs
- Flag evaluation budget is 1 ms (`IS_ENABLED_MS`) — flags should resolve near-instantly

### Common Issues

- **Load failure**: Config directory or flags file inaccessible. On first run, the service gracefully falls back to defaults
- **Save failure**: Cannot write flags to disk. Check directory permissions and disk space
- **Flag not found**: Requested flag ID doesn't exist. Verify flag was registered in defaults or created at runtime
- **Invalid flag ID**: Flag ID format validation failed

### Error Codes

```typescript
enum FeatureFlagErrorCode {
    INVALID_FEATURE_ID = 'FEATURE_FLAG_INVALID_ID',
    LOAD_FAILED        = 'FEATURE_FLAG_LOAD_FAILED',
    SAVE_FAILED        = 'FEATURE_FLAG_SAVE_FAILED',
    NOT_FOUND          = 'FEATURE_FLAG_NOT_FOUND'
}
```

---

## MonitoringService

### Overview

Captures system metrics (CPU, memory, battery) via OS-specific commands with platform-specific implementations for Windows (`wmic`), Linux (`top`), and macOS (`pmset`).

### Health Check

- `getTelemetry()` — returns service state and whether telemetry collection is enabled
- Monitor command execution — budget is 6 000 ms for system monitor and battery status

### Common Issues

- **Unsupported platform**: Service only supports Windows, Linux, and Darwin. Other platforms receive `MONITORING_UNSUPPORTED_PLATFORM`
- **Command timeout**: OS commands (wmic, top, pmset) timeout after 5 000 ms. Check system load and command availability
- **Command failure**: Underlying OS command failed to execute. Verify command exists and has permissions
- **Output truncation**: Command output exceeded 1 MB limit and was truncated. This is informational, not an error

### Error Codes

```typescript
enum MonitoringErrorCode {
    UNSUPPORTED_PLATFORM = 'MONITORING_UNSUPPORTED_PLATFORM',
    COMMAND_TIMEOUT      = 'MONITORING_COMMAND_TIMEOUT',
    COMMAND_FAILED       = 'MONITORING_COMMAND_FAILED',
    OUTPUT_TRUNCATED     = 'MONITORING_OUTPUT_TRUNCATED'
}
```

---

## TelemetryService

### Overview

Queues and flushes telemetry events with retry logic, batch processing, and size validation. Events are flushed periodically (every 60 s) with up to 3 retry attempts.

### Health Check

- `getHealth()` — returns queue size, flush status, total events count, and session ID
- Monitor queue size — maximum is 10 000 events (`MAX_QUEUE_SIZE`)

### Common Issues

- **Queue overflow**: More than 10 000 events queued; new events are dropped. Increase flush frequency or reduce event volume
- **Invalid event name**: Event names must match `/^[a-zA-Z0-9._-]+$/` and be ≤ 256 characters
- **Oversized properties**: Event properties exceed 100 KB (`MAX_PROPERTIES_SIZE`). Reduce property data
- **Flush failure**: Flush failed after 3 retry attempts (`MAX_RETRY_ATTEMPTS`). Events are re-queued if space permits. Check network connectivity
- **Telemetry disabled**: User has disabled telemetry in settings. Events are silently dropped

### Error Codes

```typescript
enum TelemetryErrorCode {
    TELEMETRY_DISABLED = 'TELEMETRY_DISABLED',
    INVALID_EVENT_NAME = 'INVALID_EVENT_NAME',
    QUEUE_OVERFLOW     = 'QUEUE_OVERFLOW',
    FLUSH_FAILED       = 'FLUSH_FAILED',
    SETTINGS_ERROR     = 'SETTINGS_ERROR'
}
```

---

## ThemeService

### Overview

Loads, validates, and installs theme manifests from the filesystem. Manages built-in themes (`black`, `white`) and custom themes with 20 required HSL color fields. Themes directory: `userData/runtime/themes`.

### Health Check

- `getMetrics()` — returns operation success/failure counts, averages, and last errors
- Verify themes directory exists and is writable

### Common Issues

- **Invalid manifest**: Theme JSON missing required fields (`id`, `name`, `displayName`, `colors`). Validate against the 20 required HSL color fields
- **Permission denied**: Cannot create themes directory or write theme files. Check filesystem permissions
- **Disk full**: Theme installation fails due to insufficient disk space
- **Corrupt theme file**: JSON parse error on theme file. Remove or repair the corrupt file
- **Uninstall built-in blocked**: Cannot uninstall built-in themes (`black`, `white`). This is by design

### Error Codes

```typescript
enum ThemeErrorCode {
    INVALID_MANIFEST   = 'THEME_INVALID_MANIFEST',
    THEME_NOT_FOUND    = 'THEME_NOT_FOUND',
    INSTALL_FAILED     = 'THEME_INSTALL_FAILED',
    UNINSTALL_FAILED   = 'THEME_UNINSTALL_FAILED',
    UNINSTALL_BUILTIN  = 'THEME_UNINSTALL_BUILTIN',
    VALIDATION_FAILED  = 'THEME_VALIDATION_FAILED',
    PERMISSION_DENIED  = 'THEME_PERMISSION_DENIED',
    DISK_FULL          = 'THEME_DISK_FULL',
    CORRUPT_THEME_FILE = 'THEME_CORRUPT_FILE'
}
```

---

## DataService

### Overview

Centralized data directory management and file migration. Organizes application data (`auth`, `db`, `config`, `logs`, `models`, `gallery`, `galleryImages`, `galleryVideos`) into a standardized structure under `userData/data` with path traversal protection.

### Health Check

- `isInitialized()` — boolean check for initialization status
- Verify base directory exists at `userData/data`
- Initialization budget is 5 000 ms (`INITIALIZE_MS`)

### Common Issues

- **Initialization failure**: Cannot create base data directory. Check filesystem permissions and disk space
- **Directory creation failure**: Subdirectory creation failed. Verify parent directory exists and is writable
- **Migration failure**: File migration failed or timed out (budget: 30 000 ms). Check source/destination paths
- **Path traversal blocked**: `validatePath()` rejects paths attempting directory traversal attacks. This is a security protection
- **Invalid data type**: Requested `DataType` is not one of the 9 valid values

### Error Codes

```typescript
enum DataServiceErrorCode {
    INITIALIZATION_FAILED  = 'DATA_SERVICE_INIT_FAILED',
    DIRECTORY_CREATE_FAILED = 'DATA_SERVICE_DIR_CREATE_FAILED',
    MIGRATION_FAILED       = 'DATA_SERVICE_MIGRATION_FAILED',
    MIGRATION_PATH_INVALID = 'DATA_SERVICE_MIGRATION_PATH_INVALID',
    PATH_TYPE_INVALID      = 'DATA_SERVICE_PATH_TYPE_INVALID',
    FILE_OPERATION_FAILED  = 'DATA_SERVICE_FILE_OP_FAILED',
    PERMISSION_DENIED      = 'DATA_SERVICE_PERMISSION_DENIED'
}
```

---

## DatabaseService

### Overview

Core database service managing SQLite/vector database operations with repositories for Chat, Project, Knowledge, System, and User Account Control (UAC). Includes slow query logging, vector search caching, and token usage tracking.

### Health Check

- `getConnectionHealth(timeoutMs?)` — delegates to `dbClient.testConnection()`, returns `{ healthy: boolean, latencyMs: number }`
- DatabaseClientService: `getHealth()` calls `GET /health` endpoint
- Health retries: up to 30 attempts (`MAX_HEALTH_RETRIES`) with 500 ms delay (`HEALTH_RETRY_DELAY_MS`)

### Common Issues

- **Connection failure**: Database connection failed. Check that the database process is running and port is accessible. Max sockets: 10, timeout: 60 000 ms
- **Slow queries**: Queries exceeding 250 ms (`slowQueryThresholdMs`) are logged. Review query patterns and indexes. Max slow query log: 200 entries
- **Query timeout**: Queries timeout after 30 000 ms (`queryTimeoutMs`). Optimize query or increase timeout
- **Migration failure**: Database migration exceeded 60 000 ms budget. Check migration scripts for errors
- **Pending request overflow**: More than 200 concurrent pending requests (`maxPendingRequests`). Reduce concurrency or increase pool size

### Performance Budgets

| Operation | Budget |
|-----------|--------|
| Query | 5 000 ms |
| Batch | 10 000 ms |
| Backup | 30 000 ms |
| Restore | 30 000 ms |
| Migration | 60 000 ms |
| Initialize | 10 000 ms |
| Cleanup | 5 000 ms |

### Repositories

| Repository | Domain |
|------------|--------|
| `ChatRepository` | Chat sessions and messages |
| `ProjectRepository` | Project metadata and configuration |
| `KnowledgeRepository` | Knowledge base and vector search |
| `SystemRepository` | System settings and state |
| `UacRepository` | User account control and checkpoints |

### Error Codes

```typescript
enum DatabaseServiceErrorCode {
    INVALID_ID        = 'DB_INVALID_ID',
    INVALID_QUERY     = 'DB_INVALID_QUERY',
    NOT_INITIALIZED   = 'DB_NOT_INITIALIZED',
    OPERATION_FAILED  = 'DB_OPERATION_FAILED',
    CONNECTION_FAILED = 'DB_CONNECTION_FAILED'
}
```

Additional database-related codes from `AppErrorCode`:

| Code | Description |
|------|-------------|
| `DB_CONNECTION_FAILED` | Database connection failure |
| `DB_QUERY_TIMEOUT` | Query exceeded timeout |
| `DB_MIGRATION_FAILED` | Migration script error |
| `DB_VALIDATION_FAILED` | Data validation error |
| `DB_CONSTRAINT_VIOLATION` | Unique/foreign key violation |
| `DB_NOT_INITIALIZED` | Database not yet initialized |
| `DB_SHARDING_ERROR` | Sharding operation error |
| `DB_COMPRESSION_ERROR` | Data compression error |
