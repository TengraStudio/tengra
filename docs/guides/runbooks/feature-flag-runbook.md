# FeatureFlagService Runbook

**Service ID:** B-0449
**Source:** `src/main/services/external/feature-flag.service.ts`
**Extends:** `BaseService`
**Owner:** Platform Team

---

## 1. Service Overview

FeatureFlagService provides a local feature flag system for Tengra. It manages boolean feature flags with persistence to disk, supports runtime overrides, and includes evaluation context validation for future targeting and rollout capabilities. It is primarily used to control council module features.

### Responsibilities

- Load feature flags from disk on initialization, merge with defaults
- Persist flag state to JSON file (`features.json` in config directory)
- Evaluate flags with safe defaults (returns `false` on any error)
- Support local overrides that take precedence over persisted values
- Validate feature IDs and evaluation contexts
- Provide health status for monitoring dashboards

### Dependencies

| Dependency | Purpose |
|---|---|
| `DataService` | Provides config directory path for `features.json` |

### Default Feature Flags

| Flag ID | Default | Description |
|---|---|---|
| `council.planning` | `true` | Enable council plan generation |
| `council.routing` | `true` | Enable quota-aware routing |
| `council.teamwork` | `true` | Enable multi-agent teamwork/reassignment |
| `council.recovery` | `true` | Enable crash-safe recovery |
| `council.governance` | `true` | Enable model governance enforcement |

---

## 2. Configuration Parameters

### Storage

- **File path:** `{DataService.config}/features.json`
- **Format:** JSON array of `FeatureFlag` objects
- **Encoding:** UTF-8 with 2-space indentation
- **Directory:** Auto-created with mode `0o700` if missing

### Validation Constraints

| Parameter | Constraint |
|---|---|
| Flag ID max length | 256 characters |
| Flag ID pattern | `^[a-zA-Z0-9._-]+$` (alphanumeric, dots, hyphens, underscores) |
| Context `userId` | Non-empty string if provided, max 512 chars |
| Context `environment` | Non-empty string if provided, max 512 chars |
| Context attributes count | Max 50 entries |
| Context attribute values | String (max 512 chars), number, or boolean |

### Performance Budgets

| Operation | Budget (ms) |
|---|---|
| `isEnabled` | 1 |
| `enable` | 100 |
| `disable` | 100 |
| `loadFlags` | 500 |
| `saveFlags` | 500 |
| `getAllFlags` | 10 |

---

## 3. Common Failure Modes

### 3.1 FEATURE_FLAG_LOAD_FAILED

**Symptom:** Log: "Failed to load feature flags".

**Cause:** Config directory inaccessible or `features.json` is corrupted.

**Resolution:**
1. Check the config directory exists and has correct permissions
2. If `features.json` is corrupted, delete it — defaults will be applied
3. Verify `DataService` is initialized and `getPath('config')` returns a valid path

### 3.2 FEATURE_FLAG_SAVE_FAILED

**Symptom:** Log: "Failed to save feature flags".

**Cause:** Disk full, permission denied, or file locked.

**Resolution:**
1. Check disk space
2. Verify write permissions on config directory
3. Check for file locks from other processes

### 3.3 FEATURE_FLAG_INVALID_ID

**Symptom:** `FeatureFlagError` thrown with code `INVALID_FEATURE_ID`.

**Cause:** Flag ID is empty, too long, or contains invalid characters.

**Resolution:**
1. Ensure ID matches pattern `^[a-zA-Z0-9._-]+$`
2. Keep ID under 256 characters
3. Use dot-notation: `module.feature` (e.g., `council.planning`)

### 3.4 FEATURE_FLAG_INVALID_CONTEXT

**Symptom:** `FeatureFlagError` thrown during `evaluate()` (caught internally, returns `false`).

**Cause:** Evaluation context has invalid fields or too many attributes.

**Resolution:**
1. Ensure `userId` and `environment` are non-empty strings if provided
2. Keep attributes count ≤ 50
3. Use only string/number/boolean values in attributes

### 3.5 FEATURE_FLAG_INVALID_OVERRIDE

**Symptom:** `FeatureFlagError` thrown in `setOverride()`.

**Cause:** Override value is not a boolean.

**Resolution:** Pass `true` or `false` as the enabled parameter.

---

## 4. Health Check Procedures

### Programmatic Health Check

```typescript
const health = featureFlagService.getHealth();
// Returns: { totalFlags: number, enabledFlags: number, flagIds: string[] }
```

### Health Indicators

| Indicator | Healthy | Warning | Critical |
|---|---|---|---|
| `totalFlags` | ≥ 5 (defaults) | < 5 | 0 |
| `enabledFlags` | > 0 | 0 | — |
| Flag IDs present | All council flags | Missing some | None present |
| `isEnabled` latency | < 1ms | 1–5ms | > 5ms |

### Manual Verification

1. Call `getAllFlags()` and verify all 5 default council flags exist
2. Test `isEnabled('council.planning')` returns expected value
3. Verify `features.json` exists and is valid JSON
4. Test override: `setOverride('council.planning', false)` → `isEnabled()` returns `false`
5. Clear override: `clearOverride('council.planning')` → returns to persisted value

---

## 5. Recovery Procedures

### Scenario: Corrupted features.json

1. The service automatically falls back to defaults on load failure
2. Delete `features.json` to force a clean start
3. Restart the service — defaults will be applied and saved

### Scenario: All Flags Disabled Unexpectedly

1. Check `features.json` for the current state
2. Check if overrides are set: overrides take precedence over persisted flags
3. Clear all overrides: `clearOverride(flagId)` for each flag
4. Re-enable flags: `enable('council.planning')`, etc.

### Scenario: DataService Not Initialized

1. `FeatureFlagService` requires `DataService` for the config path
2. Ensure `DataService.initialize()` completes before `FeatureFlagService.initialize()`
3. Check service initialization order in the application startup sequence

### Scenario: Missing Config Directory

1. The service auto-creates the config directory with `mkdir({ recursive: true, mode: 0o700 })`
2. If creation fails, check parent directory permissions
3. Verify `DataService.getPath('config')` returns a valid path

---

## 6. Monitoring Alerts and Thresholds

### Telemetry Events

| Event | Description |
|---|---|
| `feature_flag_checked` | Flag evaluation performed |
| `feature_flag_enabled` | Flag enabled |
| `feature_flag_disabled` | Flag disabled |
| `feature_flag_loaded` | Flags loaded from disk |
| `feature_flag_saved` | Flags saved to disk |
| `feature_flag_load_failed` | Failed to load flags |

### Recommended Alerts

| Alert | Condition | Severity |
|---|---|---|
| Load failure | `feature_flag_load_failed` event | Warning |
| Save failure | `FEATURE_FLAG_SAVE_FAILED` log | Warning |
| No flags loaded | `totalFlags` = 0 | Critical |
| Council flag disabled | Any `council.*` flag = false (unexpected) | Info |
| All flags disabled | `enabledFlags` = 0 | Warning |

---

## 7. Log Locations and What to Look For

### Log Output

Logs via `BaseService` methods (`logInfo`, `logError`, `logWarn`), tagged `FeatureFlagService`.

### Key Log Patterns

| Pattern | Meaning |
|---|---|
| `Feature flags loaded` | Successful initialization |
| `Failed to load feature flags` | Load error (falls back to defaults) |
| `Failed to save feature flags` | Persistence error |
| `Feature enabled: <id>` | Flag was enabled |
| `Feature disabled: <id>` | Flag was disabled |
| `Override set for <id>: <value>` | Local override applied |
| `Override cleared for <id>` | Override removed |
| `evaluate fallback to false` | Evaluation error (safe default) |

### Flag Evaluation Priority

1. **Override** (in-memory, set via `setOverride()`) — highest priority
2. **Persisted** (from `features.json` / `flags` Map)
3. **Default** (`false` if flag not found)

### File Locations

- **Flag data:** `{DataService.config}/features.json`
- **Logs:** `logs/` directory, entries tagged `FeatureFlagService`
