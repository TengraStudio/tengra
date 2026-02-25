# Troubleshooting Guide

This guide provides solutions for common issues encountered during development and usage of Tengra.

## Common Issues

### Token Synchronization Failures
**Problem**: Changes to tokens in the UI are not reflected in the Go proxy or Rust token service.
**Solution**: 
1. Check the logs for `AuthAPIService` to see if the HTTP push reached the endpoint.
2. Verify that the Go proxy is running and reachable at its configured port (usually 7788).
3. Ensure no firewalls are blocking internal localhost traffic.
4. Restart the application to re-initialize the bidirectional sync.

### "STILL ENCRYPTED" Warnings
**Problem**: Tokens appear as `v1:...` or `Tengra:v1:...` in logs even when they should be decrypted.
**Solution**: 
- This often happens if the `SecurityService` fails to access the OS keychain (e.g., Electron `safeStorage` unavailable).
- Check if you are running in an environment where the keychain is accessible.
- If persistent, try clearing the `appData` and re-authenticating to regenerate the keys.

### Proxy Startup Failures
**Problem**: The Go proxy fails to start or crashes immediately.
**Solution**:
1. Check `proxy.log` in the application data directory.
2. Ensure the `cliproxy-embed.exe` exists in the `resources/` or `bin/` directory.
3. Verify that the required environment variables are set correctly during startup.

### Build Errors (Type Mismatches)
**Problem**: `npm run build` fails with TypeScript errors (TS2322, etc.).
**Solution**:
- Ensure all dependencies are installed with `npm install`.
- Run `npm run clean` to remove build artifacts and re-run the build.
- Review recent changes in `src/renderer/` as UI components are frequent sources of polymorphic type errors.

### SD-CPP Generation Failures
**Problem**: Local image generation via SD-CPP is slow or fails.
**Solution**:
1. **Check Hardware**: Local image generation is GPU-intensive. Ensure you have adequate VRAM (minimum 4GB recommended for base models).
2. **Fallback Behavior**: If SD-CPP fails, Tengra automatically switches to Pollinations (online). Check your internet connection if the fallback also fails.
3. **Model Assets**: Verify that the SD-CPP model file has been correctly downloaded to the internal assets folder. You can trigger a re-download in the Stable Diffusion settings.
4. **Logs**: Review `logs/main.log` for specific `sd-cpp` error codes or process exit statuses.

### Changelog i18n Report Shows High `sameItems`
**Problem**: `npm run changelog:i18n:report` reports large `sameItems` values even after localization work.
**Solution**:
1. Run `npm run changelog:i18n:report` and identify affected locales first.
2. Confirm whether unchanged lines are technical-only:
   - file paths (for example: `` `src/...` ``)
   - env keys (for example: `` `MCP_REQUEST_TIMEOUT_MS` ``)
   - markdown/code structure lines
3. If technical lines dominate, verify `scripts/changelog/report-untranslated.cjs` ignore rules are up-to-date.
4. If prose lines dominate, localize the matching `items` entries in `docs/changelog/i18n/<locale>.overrides.json`.
5. Re-run:
   - `npm run changelog:i18n:report`
   - `npm run changelog:i18n:gate`

### Changelog Locale Overrides Drift (`missing > 0`)
**Problem**: Report indicates `missing > 0` for one or more locales.
**Solution**:
1. Seed missing entries: `npm run changelog:seed:all`
2. Rebuild and validate:
   - `npm run changelog:sync`
   - `npm run changelog:i18n:report`
3. If new entries are expected, check `docs/changelog/i18n/LOCALE_TODO.md` and finish locale updates.

## Log Locations

Tengra maintains Several log files for different processes:

- **Main Process**: `logs/main.log` (Internal system events, service lifecycle).
- **Renderer Process**: Accessible via DevTools (F12 or Ctrl+Shift+I).
- **Go Proxy**: `logs/proxy.log` (Request routing, auth execution).
- **Rust Token Service**: `logs/token-service.log` (Background refresh events).

## System Recovery

### Resetting the Database
If the local database (PGlite) becomes corrupted:
1. Close Tengra completely.
2. Navigate to your application data folder.
3. Delete the `Tengra.db` directory.
4. Restart Tengra. Note that this will log you out of all accounts.

### Clearing Cache
To clear the frontend cache, use the `View -> Force Reload` menu option or press `Ctrl+F5`.

