# DatabaseService Runbook

**Service ID:** B-0499
**Source:** `src/main/services/data/database.service.ts`
**Extends:** `BaseService`
**Owner:** Platform Team

---

## 1. Service Overview

DatabaseService is Tengra's primary data persistence layer. It wraps a remote database client (PGlite) with query analytics, slow query detection, migration management, vector search caching, connection pool management, batch operations, and repository pattern access for all domain entities.

### Responsibilities

- Initialize and manage the database client connection
- Provide typed repository access (Chats, Projects, Knowledge, System, UAC)
- Track query performance metrics and detect slow queries
- Analyze queries for optimization recommendations
- Manage database migrations with versioning, checksums, and rollback
- Cache vector search results with TTL
- Monitor connection pool health and support pool recycling
- Emit events via EventBus (`db:ready`, `db:error`)

### Dependencies

| Dependency | Purpose |
|---|---|
| `DataService` | File paths for data, migrations, backups |
| `EventBusService` | Event emission for db ready/error |
| `DatabaseClientService` | Actual database connection and query execution |
| `TimeTrackingService` | Performance time tracking |

### Repositories

| Repository | Domain |
|---|---|
| `ChatRepository` | Chats, messages, folders |
| `ProjectRepository` | Projects, prompts |
| `KnowledgeRepository` | Semantic fragments, episodic memory, code symbols, file diffs |
| `SystemRepository` | System settings, audit logs, job state |
| `UacRepository` | Linked accounts, user access control |

---

## 2. Configuration Parameters

### Query Execution

| Parameter | Value |
|---|---|
| Query timeout | 30,000ms |
| Slow query threshold | 250ms |
| Max slow query log entries | 200 |

### Vector Search Cache

| Parameter | Value |
|---|---|
| Cache TTL | 60,000ms (1 minute) |
| Max cache entries | 200 |

### Performance Budgets

| Operation | Budget (ms) |
|---|---|
| Single query | 5,000 |
| Batch operations | 10,000 |
| Backup | 30,000 |
| Restore | 30,000 |
| Migration | 60,000 |
| Initialize | 10,000 |
| Cleanup | 5,000 |

### Migration Infrastructure

- **History table:** `migration_history` (version, name, checksum, applied_at, rolled_back_at)
- **Known migrations:**
  - v1: `bootstrap-production-indexes` (messages, chats indexes)
  - v2: `linked_accounts_provider_idx` (provider, is_active indexes)

### Query Recommendations

The service automatically detects and warns about:
- `SELECT *` in production paths
- Missing `LIMIT` on unbounded SELECTs
- Leading wildcard `LIKE` patterns
- `UPDATE`/`DELETE` without `WHERE`

---

## 3. Common Failure Modes

### 3.1 DB_NOT_INITIALIZED

**Symptom:** Queries fail with "Database client not connected".

**Cause:** `initialize()` hasn't completed or failed.

**Resolution:**
1. Check EventBus for `db:error` events
2. Review `initError` for the root cause
3. Check `DatabaseClientService` connection status
4. Verify the database server/process is running
5. Retry initialization

### 3.2 DB_CONNECTION_FAILED

**Symptom:** Connection errors during query execution.

**Cause:** Database client disconnected, network issue, or process crash.

**Resolution:**
1. Check connection health: `await getConnectionHealth(5000)`
2. If unhealthy, try `recycleConnectionPool()`
3. Check `DatabaseClientService` for underlying errors
4. Restart the database client if needed

### 3.3 Query Timeout

**Symptom:** Error: "Query timeout after 30000ms".

**Cause:** Query is too slow or database is under heavy load.

**Resolution:**
1. Check `getSlowQueries()` for recent slow queries
2. Analyze the query plan: `await analyzeQueryPlan(sql, params)`
3. Check `getQueryRecommendations()` for optimization suggestions
4. Add missing indexes if `missing-limit` or `select-star` recommendations appear
5. Check database server resource utilization

### 3.4 Migration Conflict

**Symptom:** Error: "Migration conflict detected for versions: X, Y".

**Cause:** Checksum mismatch between applied and known migrations.

**Resolution:**
1. This indicates the migration SQL was modified after being applied
2. Check `getMigrationHistory()` for applied checksums
3. Compare with `getKnownMigrations()` expected checksums
4. Resolve by either updating the known checksum or rolling back and re-applying

### 3.5 DB_INVALID_QUERY

**Symptom:** Error with code `DB_INVALID_QUERY`.

**Cause:** Empty or non-string SQL statement passed.

**Resolution:** Check calling code for empty/null SQL strings.

### 3.6 Slow Query Accumulation

**Symptom:** Growing `slowQueryLogs` and `queryAnalytics` maps.

**Cause:** Queries consistently exceeding 250ms threshold.

**Resolution:**
1. Review `getSlowQueries(50)` for worst offenders
2. Check `getQueryAnalysis(50)` for aggregate statistics
3. Review recommendations and optimize queries
4. Add indexes via migrations for frequently queried columns
5. Clear analytics: `clearQueryAnalytics()`

---

## 4. Health Check Procedures

### Connection Health

```typescript
const health = await databaseService.getConnectionHealth(5000);
// Returns: { healthy: boolean, latencyMs: number }
```

### Connection Pool Metrics

```typescript
const pool = databaseService.getConnectionPoolMetrics();
// Returns pool utilization data
```

### Query Performance

```typescript
const analysis = databaseService.getQueryAnalysis(50);
// Returns: QueryAnalysisEntry[] sorted by total duration

const slowQueries = databaseService.getSlowQueries(50);
// Returns: SlowQueryLogEntry[] most recent first

const recommendations = databaseService.getQueryRecommendations(50);
// Returns: unique QueryRecommendation[]
```

### Migration Status

```typescript
const history = await databaseService.getMigrationHistory();
// Returns: MigrationHistoryEntry[]
```

### Schema Validation

```typescript
const schema = await databaseService.validateSchema();
// Returns: { version, tablesPresent[], tablesMissing[], warnings[], valid }
```

### Health Indicators

| Indicator | Healthy | Warning | Critical |
|---|---|---|---|
| Connection health | `healthy: true` | Latency > 500ms | `healthy: false` |
| Connection latency | < 100ms | 100–500ms | > 500ms |
| Slow queries (last hour) | 0 | 1–10 | > 10 |
| Query timeout rate | 0% | < 5% | > 5% |
| Migration version | Latest | Behind | Conflict |
| Schema validation | `valid: true` | Warnings | `valid: false` |
| Vector cache hit rate | > 50% | 20–50% | < 20% |

---

## 5. Recovery Procedures

### Scenario: Database Connection Lost

1. Check `getConnectionHealth()` for status
2. Try `recycleConnectionPool()` to reset connections
3. Check `DatabaseClientService.isConnected()` status
4. Verify the underlying database process is running
5. Full restart: `cleanup()` → `initialize()`

### Scenario: Migration Failure

1. Check `runMigrations({ dryRun: true })` to preview pending migrations
2. Review the specific failing SQL statement
3. A backup is automatically created before each migration
4. Rollback the last migration: `await rollbackLastMigration()`
5. Fix the migration and retry

### Scenario: Slow Query Degradation

1. Get analysis: `getQueryAnalysis(50)`
2. Focus on queries with highest `totalDurationMs` and `slowCalls`
3. Run `analyzeQueryPlan(sql)` on slow queries
4. Check recommendations from `getQueryRecommendations()`
5. Add indexes or rewrite queries as needed
6. Clear analytics after optimization: `clearQueryAnalytics()`

### Scenario: Schema Mismatch

1. Run `validateSchema()` to identify missing/present tables
2. Expected tables: `chats`, `messages`, `projects`, `folders`, `prompts`, `linked_accounts`
3. Run pending migrations: `await runMigrations()`
4. If tables are missing, check if repository `ensureTables()` ran
5. Check `SystemRepository.ensureProductionIndexes()` status

### Scenario: Vector Search Cache Issues

1. Cache has a 60-second TTL and max 200 entries
2. Stale results will naturally expire
3. Cache is fully in-memory — restart clears it
4. Monitor `VectorSearchAnalytics` for hit rates

### Scenario: Connection Pool Exhaustion

1. Check `getConnectionPoolMetrics()` for current state
2. Increase limits: `setConnectionPoolConfig({ maxSockets: 20 })`
3. Recycle the pool: `await recycleConnectionPool()`
4. Investigate which operations are holding connections open

---

## 6. Monitoring Alerts and Thresholds

### Telemetry Events

| Event | Description |
|---|---|
| `db_query_executed` | Query completed successfully |
| `db_query_failed` | Query execution failed |
| `db_batch_executed` | Batch operation completed |
| `db_backup_created` | Backup file created |
| `db_backup_restored` | Backup restored |
| `db_migration_run` | Migration executed |
| `db_connection_opened` | Connection established |
| `db_connection_closed` | Connection closed |

### EventBus Events

| Event | Payload |
|---|---|
| `db:ready` | `{ timestamp }` — Database initialized |
| `db:error` | `{ error }` — Initialization failed |

### Recommended Alerts

| Alert | Condition | Severity |
|---|---|---|
| Connection down | `getConnectionHealth().healthy = false` | Critical |
| High latency | Connection latency > 500ms | Warning |
| Query timeout | Any query exceeds 30s | Warning |
| Slow query spike | > 10 slow queries in 5 min | Warning |
| Migration conflict | Checksum mismatch detected | Critical |
| Schema invalid | `validateSchema().valid = false` | Critical |
| Init failure | `db:error` event | Critical |
| Pool exhaustion | No free connections | Warning |

---

## 7. Log Locations and What to Look For

### Log Output

Logs via `appLogger` tagged `DatabaseService`.

### Key Log Patterns

| Pattern | Meaning |
|---|---|
| `Initializing remote database client...` | Startup beginning |
| `Remote database connection complete!` | Startup succeeded |
| `Failed to initialize database client:` | Startup failed (critical) |
| `Slow query detected (Nms): <sql>` | Query exceeded 250ms threshold |
| `Migration conflict detected` | Checksum mismatch (critical) |
| `Query timeout after 30000ms` | Query timed out |

### Query Analysis Tips

- Use `getQueryAnalysis()` to find hotspot queries
- Focus on entries with high `avgDurationMs` and `slowCalls`
- Check `recommendations[]` for automatic optimization advice
- Use `analyzeQueryPlan()` for EXPLAIN output
- `clearQueryAnalytics()` after addressing issues to reset counters

### File Locations

- **Database files:** `{userData}/db/`
- **Migration backups:** `{userData}/data/migrations/`
- **Backup format:** `migration-backup-v{version}-{timestamp}.json`
- **Logs:** `logs/` directory, entries tagged `DatabaseService`
