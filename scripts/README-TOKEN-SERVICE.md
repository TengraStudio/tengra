# Orbit Token Refresh Service

This service automatically refreshes authentication tokens using our own refresh logic, even when the Orbit application is not running. It implements direct OAuth token refresh for Google, Codex, and Claude providers.

## How It Works

The service uses our own token refresh implementation:
- Checks which providers are logged in (Google/Antigravity, Codex, Claude, Copilot)
- Monitors token expiration
- Refreshes tokens before they expire using OAuth refresh_token flow
- Supports Google/Antigravity, Codex (OpenAI), Claude (Anthropic), and Copilot

## Prerequisites

**Windows:**
```bash
npm install @primno/dpapi
```

This package allows the standalone service to decrypt tokens encrypted with Windows DPAPI (Electron's safeStorage). Without it, the service can only refresh tokens that are stored unencrypted (the main app will re-encrypt them when it runs).

## Installation

### Windows

**Prerequisites:**
```bash
npm install -g node-windows
```

**Install the service:**
```bash
node scripts/install-service-windows.js install
```

**Uninstall the service:**
```bash
node scripts/install-service-windows.js uninstall
```

**Manage the service:**
```cmd
net start OrbitTokenRefresh    # Start service
net stop OrbitTokenRefresh     # Stop service
sc query OrbitTokenRefresh     # Check status
```

### Linux (systemd)

**Install the service:**
```bash
sudo ./scripts/install-service-linux.sh install
```

**Uninstall the service:**
```bash
sudo ./scripts/install-service-linux.sh uninstall
```

**Manage the service:**
```bash
sudo systemctl start orbit-token-refresh    # Start service
sudo systemctl stop orbit-token-refresh     # Stop service
sudo systemctl status orbit-token-refresh   # Check status
sudo journalctl -u orbit-token-refresh -f   # View logs
```

## Manual Usage

You can also run the service manually (useful for testing):

```bash
node scripts/token-refresh-service.js
```

Or with custom port:
```bash
ORBIT_PROXY_PORT=8318 node scripts/token-refresh-service.js
```

## Configuration

The service uses the same configuration and token storage as the main Orbit application:
- **Settings**: `%APPDATA%\Orbit\runtime\data\config\settings.json`
- **Auth Tokens**: `%APPDATA%\Orbit\runtime\data\auth\`

The service automatically:
- Reads settings to check which providers are logged in
- Reads encrypted token files from the auth directory
- Refreshes tokens using OAuth refresh_token endpoints
- Saves refreshed tokens (will be re-encrypted by main app if needed)

## Troubleshooting

### Service won't start

1. Ensure Node.js is installed and accessible:
   ```bash
   node --version
   ```

2. On Windows, install @primno/dpapi for token decryption:
   ```bash
   npm install @primno/dpapi
   ```

3. On Linux, ensure the script is executable:
   ```bash
   chmod +x scripts/token-refresh-service.js
   chmod +x scripts/install-service-linux.sh
   ```

4. Check logs:
   - **Windows**: Event Viewer > Applications and Services Logs > OrbitTokenRefresh
   - **Linux**: `sudo journalctl -u orbit-token-refresh -n 100`

### Service keeps restarting

Check the logs for errors. Common issues:
- Binary not found
- Invalid configuration
- Permission issues with auth directory

### Tokens not refreshing

1. **Encryption Issue**: If tokens are encrypted with Electron's safeStorage and `@primno/dpapi` is not installed, the service cannot decrypt them. Install `@primno/dpapi` on Windows:
   ```bash
   npm install @primno/dpapi
   ```

2. Verify tokens have refresh tokens (OAuth tokens, not API keys)
3. Check the auth directory has the token files: `%APPDATA%\Orbit\runtime\data\auth\`
4. Review service logs for refresh errors
5. Ensure providers are logged in (check settings.json for `connected: true` or token files in auth directory)

## Notes

- **Token Encryption**: Tokens are encrypted using Electron's safeStorage (Windows DPAPI, macOS Keychain, Linux Secret Service). The standalone service requires `@primno/dpapi` (Windows) to decrypt tokens. Without it, tokens cannot be refreshed by the standalone service, but the main app's TokenRefreshService will handle them when the app is running.
- **Refresh Interval**: Tokens are checked and refreshed every 5 minutes
- **Copilot Tokens**: Copilot session tokens are refreshed separately (every 15 minutes) using GitHub tokens
- **Provider Detection**: The service automatically detects which providers are logged in by checking settings.json and the auth directory
- **No CLIProxyAPI**: This service uses our own OAuth refresh logic, not CLIProxyAPI
