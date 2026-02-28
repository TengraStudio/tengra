# ThemeService Runbook

**Service ID:** B-0479
**Source:** `src/main/services/ui/theme.service.ts`
**Extends:** `BaseService`
**Owner:** UI/UX Team

---

## 1. Service Overview

ThemeService manages the theme system for Tengra's UI, including built-in themes, custom themes, favorites, theme history, presets, and import/export. It persists state to disk using atomic file writes and emits structured telemetry events for all theme operations.

### Responsibilities

- Get and set the current active theme
- Manage custom themes (create, update, delete, duplicate)
- Track theme favorites and usage history (max 20 entries)
- Apply and manage theme presets
- Import/export themes as JSON
- Persist all theme state to disk atomically (write-to-temp then rename)
- Emit structured telemetry events for all operations
- Provide health snapshots for monitoring

### Dependencies

- `BUILTIN_THEMES` / `getThemeById` from `@main/utils/theme-constants`
- `DEFAULT_THEME_PRESETS` from `@shared/types/theme`
- `safeJsonParse` for safe JSON deserialization
- Electron `app.getPath('userData')` for storage location

---

## 2. Configuration Parameters

### Storage

- **File path:** `{userData}/theme-store.json`
- **Atomic writes:** Writes to `.tmp` file first, then renames
- **Encoding:** UTF-8 with 2-space indentation

### Default State

| Field | Default |
|---|---|
| `currentTheme` | `'graphite'` |
| `customThemes` | `[]` |
| `favorites` | `[]` |
| `history` | `['graphite']` |
| `preset` | `null` |

### Limits

| Parameter | Value |
|---|---|
| History max size | 20 entries |
| Telemetry log max | 200 events |
| Custom theme ID format | `custom-{timestamp}` |

### Theme Import Format

```json
{
    "version": "1.0",
    "exportedAt": "ISO 8601 timestamp",
    "theme": { /* theme object */ }
}
```

---

## 3. Common Failure Modes

### 3.1 Theme Not Found

**Symptom:** `setTheme()` returns `false` with telemetry `{ action: 'theme.switch', success: false }`.

**Cause:** Theme ID doesn't exist in built-in themes or custom themes.

**Resolution:**
1. Verify the theme ID exists: check `getAllThemes()`
2. If custom theme, verify it was added via `addCustomTheme()`
3. Use `getThemeDetails(themeId)` to check existence

### 3.2 Store Load Failure

**Symptom:** Log: "Failed to load theme store, using defaults".

**Cause:** `theme-store.json` is corrupted, missing, or unreadable.

**Resolution:**
1. The service automatically falls back to `DEFAULT_THEME_STORE`
2. Delete `theme-store.json` to force a clean start
3. Check file permissions on `{userData}/` directory

### 3.3 Store Save Failure

**Symptom:** Log: "Failed to save theme store".

**Cause:** Disk full, permission denied, or temp file rename failure.

**Resolution:**
1. Check disk space
2. Verify write permissions on `{userData}/`
3. Check for `.tmp` file remnants that may indicate a failed atomic write
4. Verify no file locks on `theme-store.json`

### 3.4 Theme Import Failure

**Symptom:** `importTheme()` returns `null` with telemetry `{ action: 'theme.import', success: false }`.

**Cause:** Invalid JSON, wrong version, missing required fields, or duplicate ID.

**Resolution:**
1. Verify JSON format matches version `1.0` schema
2. Ensure theme object has `id`, `name`, and `colors` fields
3. Verify theme ID doesn't already exist (built-in or custom)
4. Check for valid JSON string input

### 3.5 Current Theme Deleted

**Symptom:** Active theme becomes unavailable after custom theme deletion.

**Cause:** The currently active custom theme was deleted.

**Resolution:** The service automatically falls back to `'graphite'` theme when the current theme is deleted.

---

## 4. Health Check Procedures

### Programmatic Health Check

```typescript
const health = themeService.getHealth();
// Returns: ThemeServiceHealth
```

### ThemeServiceHealth Fields

| Field | Description |
|---|---|
| `initialized` | Whether the service has been initialized |
| `currentTheme` | Currently active theme ID |
| `customThemeCount` | Number of custom themes |
| `favoriteCount` | Number of favorited themes |
| `historySize` | Number of themes in history |
| `hasActivePreset` | Whether a preset is currently applied |
| `storePath` | Full path to the theme store file |

### Health Indicators

| Indicator | Healthy | Warning | Critical |
|---|---|---|---|
| `initialized` | `true` | — | `false` |
| `currentTheme` | Valid theme ID | — | Empty/null |
| Store file exists | Yes | — | No (defaults used) |
| `customThemeCount` | Any | — | — |
| Save operation | Succeeds | — | Fails repeatedly |

### Telemetry Log Check

```typescript
const events = themeService.getTelemetryLog();
// Returns: ReadonlyArray<ThemeTelemetryEvent>
// Max 200 events retained
```

### Manual Verification

1. Check `getHealth()` — verify `initialized` is `true`
2. Call `getCurrentTheme()` and verify it returns a valid ID
3. Call `getAllThemes()` and verify built-in + custom themes are listed
4. Test theme switch: `await setTheme('midnight')` — should return `true`
5. Verify `theme-store.json` exists and is valid JSON

---

## 5. Recovery Procedures

### Scenario: Corrupted theme-store.json

1. Delete `theme-store.json` from `{userData}/`
2. Restart the service — defaults will be applied (`graphite` theme)
3. All custom themes, favorites, and history will be lost
4. Re-create custom themes as needed

### Scenario: Theme Not Rendering

1. Verify `getCurrentTheme()` returns a valid theme ID
2. Check `getThemeDetails(themeId)` returns a full theme object with `colors`
3. Verify the renderer is receiving theme change events
4. Check if a preset is overriding the theme: `getCurrentPreset()`

### Scenario: Atomic Write Failure

1. Check for orphaned `.tmp` files in `{userData}/`
2. Delete any `theme-store.json.tmp` files
3. Retry the save operation
4. If persistent, check filesystem health

### Scenario: Import Produces Duplicate ID

1. The import validates IDs against both built-in and custom themes
2. If a duplicate is detected, the import is rejected
3. Delete the conflicting custom theme first, then retry import
4. Or modify the imported JSON to use a unique ID

### Scenario: Full Service Reset

1. `cleanup()` — saves current state to disk
2. Delete `theme-store.json` for a clean reset
3. `initialize()` — loads defaults

---

## 6. Monitoring Alerts and Thresholds

### Telemetry Events

All events are structured `ThemeTelemetryEvent` objects with:
- `action` — operation name
- `themeId` — affected theme
- `previousThemeId` — previous theme (on switch)
- `success` — operation result
- `durationMs` — operation time
- `timestamp` — event time

### Event Actions

| Action | Description |
|---|---|
| `theme.switch` | Theme changed |
| `theme.custom.create` | Custom theme created |
| `theme.custom.delete` | Custom theme deleted |
| `theme.preset.apply` | Preset applied |
| `theme.export` | Theme exported |
| `theme.import` | Theme imported |

### Recommended Alerts

| Alert | Condition | Severity |
|---|---|---|
| Store save failure | Repeated save failures | Warning |
| Import failure | `theme.import` with `success: false` | Info |
| Theme not found | `theme.switch` with `success: false` | Info |
| Not initialized | `getHealth().initialized` = `false` | Critical |
| Telemetry log full | 200 events (rotating) | Info |

---

## 7. Log Locations and What to Look For

### Log Output

Logs via `BaseService` methods, tagged `ThemeService`.

### Key Log Patterns

| Pattern | Meaning |
|---|---|
| `Theme service initialized successfully` | Startup complete |
| `Failed to load theme store, using defaults` | Load error (warn) |
| `Failed to save theme store` | Save error (error) |
| `Theme changed to: <id>` | Successful theme switch |
| `Theme not found: <id>` | Invalid theme ID (warn) |
| `Custom theme added: <id>` | New custom theme |
| `Custom theme updated: <id>` | Custom theme modified |
| `Custom theme deleted: <id>` | Custom theme removed |
| `Preset applied: <id>` | Preset activated |
| `Preset not found: <id>` | Invalid preset (warn) |
| `Failed to import theme` | Import error (error) |
| `Theme service cleanup completed` | Clean shutdown |
| `Telemetry: <action>` | Structured telemetry event |

### File Locations

- **Theme store:** `{userData}/theme-store.json`
- **Logs:** `logs/` directory, entries tagged `ThemeService`
