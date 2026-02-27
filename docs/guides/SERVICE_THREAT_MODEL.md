# Service Threat Model & Abuse Case Review

> Security analysis of Tengra backend services. Covers threat vectors, mitigations, and abuse scenarios.
>
> **Backlog Items**: BACKLOG-0340, 0350, 0410, 0420, 0430, 0440, 0450, 0460, 0470, 0480, 0490, 0500

---

## General Security Principles

- All services use `appLogger` (never `console.log`) to prevent log injection and accidental credential leakage
- Input validation on all public methods via Zod schemas and manual guards
- Error codes are standardized per-service (`enum ...ErrorCode`) to prevent information leakage
- Rate limiting applied to expensive operations via `RateLimitService` token buckets
- Secrets managed through `SecurityService.encryptSync()` — never hardcoded or logged
- File paths validated with `DataService.validatePath()` to prevent traversal attacks
- JSON parsing uses `safeJsonParse` to prevent prototype pollution

---

## AgentCollaborationService

**Source**: `src/main/services/project/agent/agent-collaboration.service.ts`

### Threat Vectors

- **T-COLLAB-01: Prompt injection via voting requests** — The `requestVotes()` method constructs LLM prompts embedding user-supplied `question` and `options` strings directly into a prompt template. A crafted question could manipulate model behavior or leak system prompt context.
  - Mitigation: `VotingSessionSchema` (Zod) validates session structure before creation; options require minimum length of 2; LLM responses are parsed with regex JSON extraction rather than raw `eval`.

- **T-COLLAB-02: Resource exhaustion via voting sessions** — Unbounded creation of voting sessions stored in an in-memory `Map` could exhaust process memory.
  - Mitigation: Rate limiting on `agent:execution` operations (20 req/min, burst 3). Voting configuration enforces `autoResolveTimeoutMs` (60s default) to prevent session accumulation.

- **T-COLLAB-03: Routing rule manipulation** — `setRoutingRules()` allows overriding model routing. Malicious rules could redirect all tasks to a compromised or expensive provider.
  - Mitigation: Rules validated with `z.array(ModelRoutingRuleSchema).parse()` before acceptance. Routing falls back to `availableProviders` filter, so non-existent providers are excluded.

### Abuse Cases

- Flooding `createVotingSession()` to exhaust LLM API quotas across multiple providers
- Injecting adversarial text in step descriptions to bias `detectTaskType()` regex matching toward expensive model selections
- Manipulating debate arguments to produce biased consensus outcomes that skip safety checks

---

## AgentCheckpointService

**Source**: `src/main/services/project/agent/agent-checkpoint.service.ts`

### Threat Vectors

- **T-CKPT-01: Deserialization of compressed snapshots** — `parseSnapshot()` decompresses gzip data and passes it through `safeJsonParse`. Maliciously crafted compressed payloads (zip bombs) could consume excessive memory during `gunzipSync`.
  - Mitigation: Snapshot validation via `AgentCheckpointSnapshotV1Schema.parse()` before compression; `AgentTaskStateSchema.parse()` validates state on save; `safeJsonParse` returns `null` on failure rather than throwing.

- **T-CKPT-02: Checkpoint storage exhaustion** — Continuous checkpoint saves could fill database storage.
  - Mitigation: `MAX_CHECKPOINTS_PER_TASK = 200` enforced by `trimCheckpoints()` after each save. Duplicate detection via SHA-256 fingerprinting in `skipIfDuplicate()` prevents redundant saves for `auto_state_sync` triggers.

- **T-CKPT-03: Rollback to tampered state** — If a checkpoint's serialized state is modified in the database, `prepareRollback()` would restore corrupted application state.
  - Mitigation: SHA-256 content fingerprinting enables tamper detection. Schema validation (`AgentCheckpointSnapshotV1Schema`) is applied during deserialization. Pre-rollback snapshots are saved to allow recovery.

### Abuse Cases

- Repeatedly calling `saveCheckpoint()` with unique states to bypass deduplication and exhaust the 200-checkpoint limit, pushing out valid recovery points
- Submitting invalid `taskId` values to pollute the checkpoint namespace across tasks

---

## RateLimitService

**Source**: `src/main/services/security/rate-limit.service.ts`

### Threat Vectors

- **T-RATE-01: Bucket configuration tampering** — `setLimit()` is a public method that allows runtime reconfiguration of rate limits. A compromised caller could set `requestsPerMinute` to an extremely high value, effectively disabling rate limiting for a provider.
  - Mitigation: Validation ensures `requestsPerMinute > 0` and `maxBurst >= 0`. However, there is no upper bound or authorization check — this relies on the caller being trusted internal code.

- **T-RATE-02: Provider key enumeration** — Unknown provider strings silently bypass rate limiting (`tryAcquire` returns `true` if no bucket exists). An attacker could use novel provider strings to avoid all rate controls.
  - Mitigation: Default limits are set during `initialize()` for all known providers (30+ entries including MCP categories). Unknown providers are allowed through by design to avoid blocking legitimate new integrations.

- **T-RATE-03: Timing-based DoS via waitForToken** — The `waitForToken()` loop sleeps for `msPerToken` intervals up to `MAX_WAIT_ITERATIONS = 100`, which could tie up an async context for extended periods.
  - Mitigation: Bounded iteration count (100 max). `RateLimitErrorCode.WAIT_EXCEEDED` thrown when limit reached. Performance budget of 60s for `WAIT_FOR_TOKEN_MS`.

### Abuse Cases

- Calling `setLimit()` with extremely high `requestsPerMinute` to bypass rate controls on expensive LLM operations
- Using provider names not registered during initialization to bypass all rate limiting checks
- Flooding `waitForToken()` calls to tie up the Node.js event loop with stacked timer callbacks

---

## ProxyService

**Source**: `src/main/services/proxy/proxy.service.ts`

### Threat Vectors

- **T-PROXY-01: Token/credential exposure via proxy requests** — ProxyService handles OAuth tokens (GitHub, Claude, Antigravity, Codex) and proxy API keys. Tokens flow through `makeRequest()`, `initiateGitHubAuth()`, and account linking methods. Credential leakage could occur via error messages or logs.
  - Mitigation: `appLogger` used consistently (never `console.log`). `safeJsonParse` for response handling. Auth tokens managed via `AuthService.linkAccount()` with encrypted storage. Proxy key generated via `crypto` and stored with `SecurityService`.

- **T-PROXY-02: Rate limit bypass via premium flag** — `waitForRateLimit()` accepts `isPremiumBypass: true` which skips the sliding window check entirely for providers with `allowPremiumBypass: true` (codex, claude, antigravity, proxy).
  - Mitigation: Premium bypass is only available for providers where it's explicitly configured. GitHub provider has `allowPremiumBypass: false`. Internal callers control the flag — not exposed to renderer/IPC directly.

- **T-PROXY-03: SSRF via proxy endpoint** — `makeRequest()` constructs URLs using `127.0.0.1:${this.currentPort}`. If `currentPort` is manipulated, requests could target unintended local services.
  - Mitigation: Port defaults to `8317` and is only set via `startEmbeddedProxy()` options or proxy status sync. The proxy process is managed by `ProxyProcessManager` which binds to specific ports.

### Abuse Cases

- Repeated OAuth initiation (`initiateGitHubAuth`) to trigger GitHub rate limiting on the device code endpoint, causing denial of service for legitimate auth flows
- Manipulating provider normalization logic (e.g., strings containing "copilot") to route requests through unintended rate limit buckets
- Exploiting the queue-based rate limiter by filling the `maxQueueSize` (100-200) to block legitimate requests

---

## QuotaService

**Source**: `src/main/services/proxy/quota.service.ts`

### Threat Vectors

- **T-QUOTA-01: Credential leakage via quota responses** — `getQuota()`, `getCodexUsage()`, `getClaudeQuota()`, and `getCopilotQuota()` iterate over all linked accounts and include `accountId` and `email` in responses. These responses flow to the renderer process.
  - Mitigation: Only account identifiers (not tokens) are included in quota responses. Token access is delegated to handler classes (`AntigravityHandler`, `ClaudeHandler`) which use `AuthService` internally.

- **T-QUOTA-02: Session key injection via Claude save** — `saveClaudeSession()` accepts a `sessionKey` string that is persisted. Malformed session keys could be used for injection attacks downstream.
  - Mitigation: Input validated as non-empty string with `trim().length > 0` check. Delegation to `ClaudeHandler.saveClaudeSession()` for actual persistence.

- **T-QUOTA-03: Account enumeration via quota endpoints** — The multi-account iteration pattern in `getQuota()` reveals the number and type of linked accounts to any caller.
  - Mitigation: Quota endpoints are internal IPC handlers, not exposed externally. Account filtering by provider type (`antigravity`, `codex`, `claude`, `copilot`) limits scope.

### Abuse Cases

- Repeatedly calling quota fetch methods to trigger upstream API rate limits on provider quota endpoints (Anthropic, OpenAI, GitHub)
- Using `saveClaudeSession()` with crafted session keys to corrupt Claude authentication state

---

## WorkflowService

**Source**: `src/main/services/workflow/workflow.service.ts`

### Threat Vectors

- **T-WFLOW-01: Command injection via workflow steps** — `WorkflowRunner` executes `CommandActionHandler` which runs shell commands defined in workflow steps. User-created workflows with malicious command strings could execute arbitrary system commands.
  - Mitigation: Workflow creation validates `name` as non-empty string, `triggers` and `steps` as arrays. `CommandActionHandler` is registered as an action handler with its own execution context. Workflows must be explicitly enabled before execution.

- **T-WFLOW-02: Workflow file tampering** — Workflows are persisted as `workflows.json` in `userData` directory using `JSON.parse(data)` without schema validation on load.
  - Mitigation: File is in user-controlled `app.getPath('userData')` with OS-level permissions. Workflow IDs are UUID v4. `updateWorkflow` prevents ID and `createdAt` mutation.

- **T-WFLOW-03: Unbounded workflow execution** — `executeWorkflow()` delegates to `WorkflowRunner` which may execute long-running LLM prompts or agent tasks without timeout.
  - Mitigation: Performance budget `EXECUTE_MS: 300000` (5 min) defined. Disabled workflows are rejected with `WorkflowErrorCode.DISABLED`. ID validation via `validateId()` on all public methods.

### Abuse Cases

- Creating workflows with shell commands that exfiltrate data or install malware via `CommandActionHandler`
- Modifying `workflows.json` on disk to inject malicious steps that execute on next app startup
- Triggering rapid manual workflow executions to exhaust LLM API quotas via `LLMPromptAction`

---

## FeatureFlagService

**Source**: `src/main/services/external/feature-flag.service.ts`

### Threat Vectors

- **T-FLAG-01: Feature flag file tampering** — Flags are loaded from `features.json` on disk using `safeJsonParse`. A tampered file could enable experimental or security-sensitive features.
  - Mitigation: Config directory created with `mode: 0o700` (owner-only access). `safeJsonParse` returns empty array on parse failure. Flags merged with defaults — unknown flags from disk are still loaded but have no effect unless code checks for them.

- **T-FLAG-02: Flag injection via enable/disable** — `enable()` and `disable()` methods only operate on existing flags (checked via `this.flags.get()`), but there is no authorization check on who can toggle flags.
  - Mitigation: Input validation ensures `featureId` is a non-empty string. Only pre-existing flags can be toggled (no creation of new flags through enable/disable). All changes are logged via `logInfo`.

### Abuse Cases

- Editing `features.json` to enable hidden experimental features that bypass safety controls
- Rapidly toggling feature flags to cause inconsistent application state across components that cache flag values

---

## MonitoringService

**Source**: `src/main/services/analysis/monitoring.service.ts`

### Threat Vectors

- **T-MON-01: Command injection via system commands** — `getSystemMonitor()` and `getBatteryStatus()` execute platform-specific shell commands using Node.js `exec()`. While commands are hardcoded, the `exec()` function inherits the full shell environment.
  - Mitigation: All commands are hardcoded strings — no user input is interpolated. `executeWithTimeout()` validates command is non-empty string and timeout is bounded (1-30000ms). `maxBuffer` set to 1MB to prevent buffer overflow.

- **T-MON-02: Command output injection on Linux** — `getBatteryStatus()` on Linux pipes `upower -e` output directly into a second `upower -i ${stdout}` command. If `upower -e` returns unexpected output, it could be used for command injection.
  - Mitigation: Output is `.trim()`'d before interpolation. The 5-second timeout limits execution window. Output size capped at `maxCommandOutputSize` (1MB).

- **T-MON-03: Information disclosure via system metrics** — `getUsage()` exposes CPU load averages and memory utilization percentages that could be used to fingerprint the system or detect when security monitoring is degraded.
  - Mitigation: Metrics are only exposed via internal IPC, not over network. Response format is minimal (`cpu: number, memory: number`) without process-level detail.

### Abuse Cases

- Repeatedly calling `getSystemMonitor()` to trigger frequent `exec()` invocations, degrading system performance
- Using system metrics to time attacks when CPU/memory usage indicates the machine is under heavy load (and monitoring may be degraded)

---

## TelemetryService

**Source**: `src/main/services/analysis/telemetry.service.ts`

### Threat Vectors

- **T-TEL-01: Queue memory exhaustion** — The telemetry event queue is an in-memory array. While capped at `MAX_QUEUE_SIZE = 10000`, each event includes arbitrary `properties` objects up to 100KB, allowing up to ~1GB of memory consumption.
  - Mitigation: `MAX_QUEUE_SIZE` enforced with `QUEUE_OVERFLOW` error code. Properties validated with `MAX_PROPERTIES_SIZE = 100000` (100KB limit via JSON.stringify length check). Queue overflow events are logged.

- **T-TEL-02: Event name injection** — Telemetry event names flow to external analytics endpoints. Crafted event names could pollute dashboards or inject tracking data.
  - Mitigation: Strict validation regex `/^[a-zA-Z0-9._-]+$/` limits event names to alphanumeric, dots, dashes, and underscores. Maximum length of 256 characters enforced. Invalid names rejected with `INVALID_EVENT_NAME` error.

- **T-TEL-03: Telemetry data exfiltration** — Properties attached to events could inadvertently include sensitive data (tokens, passwords, user content) that gets flushed to external endpoints.
  - Mitigation: Telemetry is opt-in via `settingsService.getSettings().telemetry.enabled`. Properties are size-validated but not content-filtered. Currently events are only processed locally (no external endpoint configured).

### Abuse Cases

- Flooding `track()` with maximum-size properties payloads (100KB each) to consume ~1GB of memory before queue cap is reached
- Using telemetry events to exfiltrate sensitive data by embedding it in event properties when telemetry is enabled

---

## ThemeService

**Source**: `src/main/services/theme/theme.service.ts`

### Threat Vectors

- **T-THEME-01: Path traversal via theme ID** — `installTheme()` uses `manifest.id` to construct the file path: `path.join(themesDir, \`${manifest.id}.theme.json\`)`. A crafted ID like `../../etc/config` could write outside the themes directory.
  - Mitigation: `uninstallTheme()` validates ID with `/^[a-zA-Z0-9_-]+$/` regex (max 256 chars). However, `installTheme()` relies on `validateManifest()` which only checks `id` is a non-empty string — the path traversal regex is **not** applied on install. This is a potential gap.

- **T-THEME-02: CSS injection via theme colors** — Theme manifests define CSS color values as strings (e.g., `'0 0% 100%'`). Malicious color values could inject CSS expressions or break layout rendering in the renderer process.
  - Mitigation: `validateManifest()` checks that all 19 required color fields are strings, but does not validate the string format. Color values are applied as CSS custom properties, limiting injection scope to CSS variable contexts.

- **T-THEME-03: Built-in theme deletion protection bypass** — Built-in themes (`black`, `white`) are protected from deletion by ID check, but a custom theme could overwrite them via `installTheme()` since it writes to the same filename.
  - Mitigation: Built-in theme IDs are hardcoded and re-installed on every `initialize()` call, so overwrites are reverted on next startup.

### Abuse Cases

- Installing a theme with a path-traversal ID to overwrite application configuration files
- Crafting theme color values with CSS injection payloads to manipulate the renderer UI

---

## DataService

**Source**: `src/main/services/data/data.service.ts`

### Threat Vectors

- **T-DATA-01: Path traversal in migration operations** — `migrate()` constructs file paths using `app.getPath()` return values and performs `rename()` operations. If `app.getPath()` returns unexpected values or migration entries are tampered with, files could be moved to unintended locations.
  - Mitigation: Migration paths are hardcoded in the `migrations` array — no user input involved. `pathExists()` checks are performed before each operation. `validatePath()` method exists for external callers to verify path containment.

- **T-DATA-02: Directory permission escalation** — `ensureDirectories()` creates directories with `mode: 0o700` (owner-only). On Windows, POSIX mode flags are not enforced, potentially creating world-readable data directories.
  - Mitigation: Windows relies on NTFS ACL inheritance from parent directories. The `userData` path from Electron is in the user's AppData directory which has appropriate ACLs by default. Explicit `0o700` mode provides defense-in-depth on Unix platforms.

- **T-DATA-03: Invalid DataType exploitation** — `getPath()` validates input against `VALID_DATA_TYPES` array. If a new data type is added to the code but not to the validation array, it would be silently rejected.
  - Mitigation: `validateDataType()` checks against the canonical `VALID_DATA_TYPES` constant. Invalid types throw with `DataServiceErrorCode.PATH_TYPE_INVALID`. Telemetry events track all path access.

### Abuse Cases

- Calling `getPath()` with crafted type strings to probe directory structure (mitigated by validation)
- Exploiting race conditions during `migrate()` to intercept files being renamed between old and new locations

---

## DatabaseService

**Source**: `src/main/services/data/database.service.ts`

### Threat Vectors

- **T-DB-01: SQL injection via query/exec methods** — `query()` and `exec()` accept raw SQL strings. While parameterized queries are supported, `exec()` does not accept parameters, and `executeBatch()` iterates statements calling `exec()` with raw SQL.
  - Mitigation: `validateSql()` ensures SQL is a non-empty string. Parameterized queries are available via `query()` and `prepare()`. Query analytics detect dangerous patterns (`UPDATE/DELETE without WHERE`, `SELECT *`, leading wildcard `LIKE`).

- **T-DB-02: Denial of service via slow queries** — Unbounded `SELECT` queries without `LIMIT` could return massive result sets, consuming memory and blocking the database connection.
  - Mitigation: `queryTimeoutMs = 30000` enforced via `Promise.race` in `trackQuery()`. Slow query detection at 250ms threshold with logging. `analyzeQuery()` flags missing `LIMIT` clauses. Connection pool limits configurable via `setConnectionPoolConfig()`.

- **T-DB-03: Migration tampering** — Migration files include checksums, but if the `migration_history` table is tampered with, previously applied migrations could be re-executed or skipped.
  - Mitigation: `DatabaseMigration` interface includes `checksum` field. Migration history stored in a dedicated table with version, name, checksum, and timestamps. Schema validation via `SchemaValidationResult` detects missing tables.

### Abuse Cases

- Passing raw SQL through `exec()` to perform destructive operations (DROP TABLE, data exfiltration)
- Flooding `executeBatch()` with thousands of statements to overwhelm the database connection pool
- Exploiting `analyzeQueryPlan()` with crafted `EXPLAIN` statements to probe database schema

---

## Summary Matrix

| Service | Primary Risk | Severity | Key Mitigation |
|---------|-------------|----------|----------------|
| AgentCollaboration | Prompt injection, resource exhaustion | High | Zod schema validation, rate limiting |
| AgentCheckpoint | Zip bomb decompression, storage exhaustion | Medium | SHA-256 fingerprinting, 200-checkpoint cap |
| RateLimit | Config tampering, provider bypass | Medium | Input validation, bounded iteration |
| Proxy | Token exposure, SSRF, rate limit bypass | High | Encrypted storage, hardcoded endpoints, per-provider limits |
| Quota | Credential leakage, upstream rate limit abuse | Medium | Token isolation in handlers, input validation |
| Workflow | Command injection, file tampering | Critical | Hardcoded action handlers, UUID IDs, enabled check |
| FeatureFlag | File tampering, unauthorized toggle | Low | Owner-only file permissions, existing-flag guard |
| Monitoring | Command injection, info disclosure | Medium | Hardcoded commands, output size limits, timeouts |
| Telemetry | Memory exhaustion, data exfiltration | Medium | Queue cap (10K), property size limit (100KB), opt-in |
| Theme | Path traversal, CSS injection | Medium | ID regex on uninstall, manifest validation, auto-repair |
| Data | Path traversal, permission issues | Low | Hardcoded migrations, `validatePath()`, `0o700` mode |
| Database | SQL injection, DoS via slow queries | High | Parameterized queries, 30s timeout, query analysis |

---

## Recommendations

1. **ThemeService**: Apply the `/^[a-zA-Z0-9_-]+$/` ID regex in `installTheme()` (currently only enforced in `uninstallTheme()`)
2. **RateLimitService**: Add upper bounds to `setLimit()` configuration values and restrict caller access
3. **MonitoringService**: Sanitize `upower -e` output before interpolation in the Linux battery status path
4. **WorkflowService**: Add schema validation when loading `workflows.json` from disk (currently uses raw `JSON.parse`)
5. **DatabaseService**: Audit all `exec()` call sites to ensure no user input reaches raw SQL execution
6. **TelemetryService**: Add content filtering for sensitive data patterns (tokens, emails) in event properties
