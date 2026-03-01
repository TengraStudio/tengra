# Runbook: PGlite Database Recovery

## Problem: Database Corruption or Unavailability

PGlite (in-process PostgreSQL) fails to start, returns query errors, or data appears missing/corrupted.

## Symptoms

- App crashes on startup with `PGlite` or `DatabaseService` errors in `logs/`
- Queries return unexpected empty results or throw `FATAL` errors
- UI shows blank data or "database unavailable" messages
- Log entries: `DatabaseService: initialization failed` in `logs/database_*.log`

## Diagnosis

1. **Check logs**: Open the latest log file in `logs/` — search for `DatabaseService` or `PGlite` errors.
2. **Check data directory**: PGlite stores data under the app's user data path. Verify the directory exists and is not empty.
3. **Check disk space**: PGlite will fail silently on full disks.
4. **Reproduce**: Restart the app and watch logs for the exact error during `DatabaseService.initialize()`.

### Key Code Paths

- Service: `src/main/services/data/database.service.ts`
- IPC handlers: `src/main/ipc/` (handlers prefixed with `db:`)
- Migrations: Check for pending migrations in the data service initialization flow

## Resolution

### 1. Restart the Application

Stop and restart Tengra. PGlite recovers automatically from transient failures.

### 2. Clear WAL / Temp Files

If PGlite reports WAL corruption, delete temporary WAL files in the data directory and restart. PGlite will rebuild from the last checkpoint.

### 3. Migration Rollback

If a migration caused the issue:
- Identify the failing migration in startup logs
- Revert to the previous app version
- Fix the migration script in `src/main/services/data/`
- Re-deploy with corrected migration

### 4. Full Data Reset (Last Resort)

1. Back up the PGlite data directory
2. Delete the data directory
3. Restart the app — `DatabaseService.initialize()` recreates the schema
4. Re-import any backed-up data if possible

### 5. Verify Recovery

```bash
npm run dev
# Check logs for: "DatabaseService: Initializing..."
# Confirm no errors follow initialization
```

## Prevention

- Monitor log files for `warn`-level database messages
- Keep regular backups of the PGlite data directory
- Test migrations in dev before deploying: `npm run build && npm run test`
