# Tengra User & Troubleshooting Guide

Welcome to Tengra! This guide provides information for users and solutions for common issues.

## 1. Getting Started

### Installation and First Run
To get started with Tengra, download the appropriate installer for your OS and follow the standard installation prompts. On first launch, Tengra will perform a system check to detect local tools like Ollama or Git and configure internal data directories.

### Connecting AI Providers
- **Local Models**: If you have Ollama installed, Tengra will automatically detect your downloaded models. YOU can refresh the model list in the Settings dashboard.
- **Local Image Generation (SD-CPP)**: Tengra includes a high-performance Stable Diffusion C++ implementation for local image generation. This runs entirely on your machine and is detected/configured automatically if enabled in settings. If SD-CPP is unavailable or fails, Tengra will automatically fallback to **Pollinations** (cloud-based).
- **Cloud Accounts**: To use models from providers like Anthropic or Google, navigate to the Accounts section in Settings. Tengra uses secure OAuth flows for account linking. For providers requiring API keys, your credentials will be encrypted and stored securely in the system keychain.

---

## 2. Navigating the Workspace

### The Chat Interface
The chat represents your primary interaction point with the AI.
- **Starting a Conversation**: Use the New Chat button to begin a fresh session.
- **Providing Context**: You can attach specific files to your chat session using the context menu or by dragging files directly into the window.
- **Model Selection**: Use the dropdown menu at the top of the chat window to switch between different AI models.

### Managing Projects
- **Local Folders**: Link existing projects on your machine to enable deep semantic indexing and workspace-aware AI suggestions.
- **Remote SSH Connections**: Tengra includes a built-in SSH manager as well as an SFTP browser.

---

## 3. Common Issues

### Token Synchronization Failures
**Problem**: Changes to tokens in the UI are not reflected in the Go proxy or Rust token service.
**Solution**: 
1. Check the logs for `AuthAPIService` to see if the HTTP push reached the endpoint.
2. Verify that the Go proxy is running and reachable at its configured port (usually 7788).
3. Restart the application to re-initialize the sync.

### "STILL ENCRYPTED" Warnings
**Problem**: Tokens appear as `v1:...` or `Tengra:v1:...` in logs after decryption.
**Solution**: 
- This often happens if the `SecurityService` fails to access the OS keychain (e.g., Electron `safeStorage` unavailable).
- Check if you are running in an environment where the keychain is accessible.
- If persistent, try clearing the `appData` and re-authenticating.

### Proxy Startup Failures
**Problem**: The Go proxy fails to start or crashes immediately.
**Solution**:
1. Check `proxy.log` in the application data directory.
2. Ensure the `cliproxy-embed.exe` exists in the `resources/` or `bin/` directory.

### SD-CPP Generation Failures
**Problem**: Local image generation via SD-CPP is slow or fails.
**Solution**:
1. **Check Hardware**: Local image generation is GPU-intensive. 
2. **Fallback Behavior**: If SD-CPP fails, Tengra automatically switches to Pollinations (online).
3. **Logs**: Review `logs/main.log` for specific `sd-cpp` error codes.

---

## 4. Log Locations

Tengra maintains several log files for different processes:
- **Main Process**: `logs/main.log` (Internal system events, service lifecycle).
- **Renderer Process**: Accessible via DevTools (F12 or Ctrl+Shift+I).
- **Go Proxy**: `logs/proxy.log` (Request routing, auth execution).
- **Rust Token Service**: `logs/token-service.log` (Background refresh events).

---

## 5. System Recovery

### Resetting the Database
If the local database (PGlite) becomes corrupted:
1. Close Tengra completely.
2. Navigate to your application data folder.
3. Delete the `Tengra.db` directory.
4. Restart Tengra. Note that this will log you out of all accounts.

### Clearing Cache
To clear the frontend cache, use the `View -> Force Reload` menu option or press `Ctrl+F5`.
