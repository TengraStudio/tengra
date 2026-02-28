# DataService Runbook

**Service ID:** B-0489
**Source:** `src/main/services/data/data.service.ts`
**Extends:** `BaseService`
**Owner:** Platform Team

---

## 1. Service Overview

DataService manages the data directory structure for Tengra. It creates and maintains the organized folder hierarchy under `{userData}/data/`, handles legacy data migration from old file locations, provides path resolution for all data types, and includes path traversal protection.

### Responsibilities

- Create and ensure the data directory structure on initialization
- Provide typed path resolution for all data categories (`auth`, `db`, `config`, `logs`, `models`, `gallery`, etc.)
- Migrate data from legacy file locations to the new centralized structure
- Validate paths against allowed roots to prevent path traversal attacks
- Track telemetry events for initialization, migration, and path access
- Enforce directory permissions (`0o700` — owner read/write/execute only)

### Dependencies

| Dependency | Purpose |
|---|---|
| `TelemetryService` (optional) | Event tracking for monitoring |
| Electron `app` | `getPath('userData')` and `getPath('pictures')` |

---

## 2. Configuration Parameters

### Directory Structure

```
{userData}/
├── data/                    (base data directory)
│   ├── auth/                (authentication data)
│   ├── config/              (configuration files)
│   ├── logs/                (application logs)
│   ├── models/              (AI model files)
│   ├── gallery/
│   │   ├── images/          (gallery images)
│   │   └── videos/          (gallery videos)
├── db/                      (database files)
└── static/                  (static assets)
```

### Valid Data Types

| DataType | Path | Description |
|---|---|---|
| `auth` | `{base}/auth` | Authentication tokens and keys |
| `db` | `{userData}/db` | Database files (PGlite, vector store) |
| `config` | `{base}/config` | Config files (settings, features, proxy) |
| `logs` | `{base}/logs` | Application log files |
| `models` | `{base}/models` | AI model files |
| `data` | `{base}` | Base data directory |
| `gallery` | `{base}/gallery` | Gallery root |
| `galleryImages` | `{base}/gallery/images` | Gallery images |
| `galleryVideos` | `{base}/gallery/videos` | Gallery videos |

### Performance Budgets

| Operation | Budget (ms) |
|---|---|
| `initialize` | 5,000 |
| `migrate` | 30,000 |
| `ensureDirectories` | 1,000 |
| `getPath` | 10 |

### Directory Permissions

All directories created with mode `0o700` (owner-only access).

---

## 3. Common Failure Modes

### 3.1 DATA_SERVICE_INIT_FAILED

**Symptom:** Initialization throws an error.

**Cause:** Unable to create the data directory structure.

**Resolution:**
1. Check disk space and permissions on `{userData}/` path
2. Verify the parent directory exists
3. Check for filesystem errors or locked directories

### 3.2 DATA_SERVICE_DIR_CREATE_FAILED

**Symptom:** Error during `ensureDirectories()` with code `DIRECTORY_CREATE_FAILED`.

**Cause:** Permission denied, disk full, or path too long.

**Resolution:**
1. Check filesystem permissions on the target directory
2. Verify disk has sufficient space
3. On Windows, check for long path issues (> 260 chars)
4. Check for antivirus interference

### 3.3 DATA_SERVICE_PATH_TYPE_INVALID

**Symptom:** `getPath()` throws error with code `PATH_TYPE_INVALID`.

**Cause:** Invalid `DataType` string passed to `getPath()`.

**Resolution:**
1. Use only valid types: `auth`, `db`, `config`, `logs`, `models`, `data`, `gallery`, `galleryImages`, `galleryVideos`
2. Check calling code for typos or dynamic type construction

### 3.4 Migration Failure

**Symptom:** Log: "Failed to migrate <old path>: <error>".

**Cause:** Source file/directory doesn't exist, permission denied, or target already exists.

**Resolution:**
1. Migrations are best-effort — individual failures don't block startup
2. Check the specific migration path in the error log
3. Manually move files if automatic migration fails
4. Files at the target path are preserved (no overwrite)

### 3.5 DATA_SERVICE_PERMISSION_DENIED

**Symptom:** File operations fail with permission errors.

**Resolution:**
1. Verify the application has write access to `{userData}/`
2. On macOS/Linux, check directory permissions (should be `0o700`)
3. On Windows, check for UAC or antivirus blocking

---

## 4. Health Check Procedures

### Programmatic Checks

```typescript
const initialized = dataService.isInitialized();
const basePath = dataService.getBaseDir();
const allPaths = dataService.getAllPaths();
```

### Health Indicators

| Indicator | Healthy | Warning | Critical |
|---|---|---|---|
| `isInitialized()` | `true` | — | `false` |
| All directories exist | Yes | Some missing | Base dir missing |
| `getPath()` latency | < 10ms | 10–50ms | > 50ms |
| Init duration | < 5s | 5–10s | > 10s |
| Migration duration | < 30s | 30–60s | > 60s |

### Manual Verification

1. Check `isInitialized()` returns `true`
2. Call `getAllPaths()` and verify all paths are valid
3. Verify each path directory exists on the filesystem
4. Test `validatePath()` with a known safe and unsafe path
5. Check `getBaseDir()` matches expected `{userData}/data`

### Path Traversal Test

```typescript
// Should return true (safe)
dataService.validatePath('/app/data/config/settings.json', '/app/data');

// Should return false (traversal attempt)
dataService.validatePath('/app/data/../secrets/key', '/app/data');
```

---

## 5. Recovery Procedures

### Scenario: Missing Directories After Init

1. Call `initialize()` again — it creates directories with `{ recursive: true }`
2. If specific directories are missing, create them manually:
   ```
   mkdir -p {userData}/data/auth
   mkdir -p {userData}/data/config
   ```
3. Ensure mode `0o700` on all directories

### Scenario: Migration Left Partial State

1. Migrations move files/directories from old to new locations
2. Files at the new location are never overwritten
3. Empty old directories are cleaned up automatically
4. For stuck migrations, manually move remaining files
5. Check for partial directory contents in both old and new locations

### Scenario: Legacy Data Not Migrated

The migration handles these paths:
- `{root}/auth` → `{base}/auth`
- `{root}/cliproxy-auth.enc` → `{base}/auth/proxy-auth-token.enc`
- `{root}/tengra-lancedb` → `{db}/vector-store`
- `{root}/databases` → `{db}`
- `{root}/settings.json` → `{config}/settings.json`
- `{root}/proxy-config.yaml` → `{config}/proxy-config.yaml`
- `{root}/models` → `{base}/models`
- `{root}/static` → `{userData}/static`
- `{Pictures}/tengra/Gallery` → `{base}/gallery/images`

If migration didn't run, call `dataService.migrate()` manually.

### Scenario: DataService Needed Before Init

1. Other services depend on `DataService.getPath()` — ensure it initializes first
2. The initialization order should place DataService before any dependent service
3. `getPath()` works even before `initialize()` (paths are set in constructor)
4. However, directories won't exist until `initialize()` runs

---

## 6. Monitoring Alerts and Thresholds

### Telemetry Events

| Event | Description |
|---|---|
| `data_service_initialize_start` | Init started |
| `data_service_initialize_complete` | Init succeeded |
| `data_service_initialize_error` | Init failed |
| `data_service_migrate_start` | Migration started |
| `data_service_migrate_complete` | Migration completed |
| `data_service_migrate_error` | Migration failed |
| `data_service_directory_created` | Directory created |
| `data_service_path_accessed` | Path lookup performed |

### Recommended Alerts

| Alert | Condition | Severity |
|---|---|---|
| Init failure | `data_service_initialize_error` event | Critical |
| Init slow | Init duration > 5,000ms | Warning |
| Migration error | `data_service_migrate_error` event | Warning |
| Migration slow | Migration duration > 30,000ms | Warning |
| Path access slow | `getPath()` duration > 10ms | Info |
| Not initialized | `isInitialized()` = `false` after startup | Critical |

---

## 7. Log Locations and What to Look For

### Log Output

Logs via `BaseService` methods and `appLogger`, tagged `DataService`.

### Key Log Patterns

| Pattern | Meaning |
|---|---|
| `Initializing data service and ensuring directory structure...` | Init starting |
| `Data service initialized successfully in Nms` | Init complete |
| `Initialization exceeded performance budget` | Slow init (warn) |
| `Failed to initialize data service` | Init error (critical) |
| `Data service cleanup - no resources to clean` | Shutdown |
| `Checking for migrations...` | Migration scan starting |
| `Migrating file X to Y` | Individual file migration |
| `Failed to migrate <path>: <error>` | Migration failure |
| `Cleaning up legacy .cli-proxy-api folder` | Legacy cleanup |
| `Failed to cleanup legacy folder` | Legacy cleanup error |
| `Failed to create directories` | Directory creation error |
| `ensureDirectories exceeded budget` | Slow directory creation |
| `getPath exceeded budget for type X` | Slow path lookup |

### File Locations

- **Data root:** `{userData}/data/`
- **Database:** `{userData}/db/`
- **Logs:** `logs/` directory, entries tagged `DataService`

### Debugging Tips

- Use `getAllPaths()` to dump the full path map
- Check `isInitialized()` before investigating path issues
- Compare `getBaseDir()` with expected `{userData}/data`
- Use `validatePath()` to test path safety before file operations
