# Runbook: MCP Plugin Recovery

## Problem: MCP Plugin Crashes or Misbehavior

An MCP (Model Context Protocol) plugin crashes, hangs, fails to load, or produces incorrect results.

## Symptoms

- Plugin-dependent features stop working (e.g., file ops, git, web search)
- Logs show MCP server process exit codes or spawn failures
- UI shows "plugin unavailable" or tool call errors in chat
- Increased memory/CPU usage from a runaway plugin process

## Diagnosis

1. **Check logs**: Search `logs/` for `MCP` or the specific plugin/server name.
2. **Identify the failing plugin**: Check which tool call triggered the error in chat history.
3. **Check plugin process**:
   ```bash
   # Windows — look for MCP server child processes
   tasklist | findstr node
   ```
4. **Check plugin config**: Review MCP server definitions and templates.
5. **Check plugin dependencies**: Ensure any required binaries (git, docker, etc.) are available on PATH.

### Key Code Paths

- MCP system: `src/main/mcp/`
- Server template: `src/main/mcp/templates/server.template.ts`
- Plugin management UI: `src/renderer/features/mcp/`
- IPC handlers: `src/main/ipc/` (MCP-related handlers)

## Resolution

### 1. Restart a Single Plugin

1. Open Settings → MCP Servers
2. Disable the failing plugin, wait 2 seconds, then re-enable it
3. The MCP system will spawn a fresh server process
4. Check logs to confirm successful initialization

### 2. Plugin Fails to Start

1. Check logs for the spawn error (missing binary, permission denied, bad config)
2. Verify the plugin's required dependencies are installed
3. Test the plugin server manually:
   ```bash
   node <path-to-mcp-server-script> --help
   ```
4. Fix config or install missing dependencies, then re-enable

### 3. Plugin Hangs / High Resource Usage

1. Identify the plugin's PID from task manager or logs
2. Kill the process: `Stop-Process -Id <PID>`
3. Re-enable the plugin in Settings → MCP Servers
4. If recurring, check for infinite loops or unbounded operations in the plugin

### 4. Plugin Returns Incorrect Results

1. Enable debug logging: set log level to `debug` in settings
2. Reproduce the issue and inspect the MCP request/response in logs
3. Check the plugin's tool schema matches the expected input format
4. Update the plugin or report the bug to the plugin author

### 5. Full MCP System Reset

1. Disable all MCP servers in Settings → MCP Servers
2. Restart the application
3. Re-enable plugins one by one, testing each

### 6. Verify Recovery

```bash
npm run dev
# Trigger a tool call that uses the recovered plugin
# Confirm successful response in chat and no errors in logs
```

## Prevention

- Pin plugin versions to avoid unexpected breaking changes
- Monitor plugin process resource usage in task manager
- Keep plugin count minimal — each server is a separate process
- Review plugin logs regularly for warn-level messages
