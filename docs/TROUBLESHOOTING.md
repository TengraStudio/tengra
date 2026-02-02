# Troubleshooting Guide

This guide provides solutions for common issues encountered during development and usage of Tandem.

## Common Issues

### Token Synchronization Failures
**Problem**: Changes to tokens in the UI are not reflected in the Go proxy or Rust token service.
**Solution**: 
1. Check the logs for `AuthAPIService` to see if the HTTP push reached the endpoint.
2. Verify that the Go proxy is running and reachable at its configured port (usually 7788).
3. Ensure no firewalls are blocking internal localhost traffic.
4. Restart the application to re-initialize the bidirectional sync.

### "STILL ENCRYPTED" Warnings
**Problem**: Tokens appear as `v1:...` or `Tandem:v1:...` in logs even when they should be decrypted.
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

## Log Locations

Tandem maintains Several log files for different processes:

- **Main Process**: `logs/main.log` (Internal system events, service lifecycle).
- **Renderer Process**: Accessible via DevTools (F12 or Ctrl+Shift+I).
- **Go Proxy**: `logs/proxy.log` (Request routing, auth execution).
- **Rust Token Service**: `logs/token-service.log` (Background refresh events).

## System Recovery

### Resetting the Database
If the local database (PGlite) becomes corrupted:
1. Close Tandem completely.
2. Navigate to your application data folder.
3. Delete the `Tandem.db` directory.
4. Restart Tandem. Note that this will log you out of all accounts.

### Clearing Cache
To clear the frontend cache, use the `View -> Force Reload` menu option or press `Ctrl+F5`.
