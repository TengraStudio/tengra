# Runbook: Proxy Service Recovery

## Problem: Proxy Crashes, Port Conflicts, or Unresponsive Proxy

The proxy service fails to start, crashes mid-session, or becomes unresponsive due to port conflicts.

## Symptoms

- LLM API calls fail with connection refused / timeout errors
- Logs show `ProxyService: failed to bind port` or `EADDRINUSE`
- Renderer shows "proxy unavailable" or network errors in chat
- `QuotaService` logs rate-limit or quota exhaustion warnings

## Diagnosis

1. **Check logs**: Search `logs/` for `ProxyService` entries — look for bind errors or crash stack traces.
2. **Check port availability**:
   ```bash
   # Windows
   netstat -ano | findstr :<proxy-port>
   # Kill conflicting process if needed
   taskkill /PID <pid> /F
   ```
3. **Check proxy config**: Review proxy settings in `src/main/services/proxy/` for the configured port and upstream URLs.
4. **Check quota state**: If requests fail with 429s, inspect `QuotaService` logs for rate-limit status.

### Key Code Paths

- Service: `src/main/services/proxy/proxy.service.ts`
- Quota: `src/main/services/proxy/quota.service.ts`
- IPC handlers: `src/main/ipc/` (handlers with proxy-related prefixes)

## Resolution

### 1. Restart the Application

The proxy starts during `ProxyService.initialize()`. A full app restart re-binds the port.

### 2. Resolve Port Conflicts

1. Identify the process occupying the port (see diagnosis above)
2. Stop the conflicting process or change the proxy port in settings
3. Restart Tengra

### 3. Proxy Process Crashed

If the proxy child process died:
- Check logs for the crash reason (OOM, unhandled exception)
- Restart the app — `ProxyService.initialize()` spawns a new process
- If recurring, check for memory leaks in proxy request handling

### 4. Rate Limit / Quota Exhaustion

1. Check `QuotaService` logs for which provider hit limits
2. Wait for the rate-limit window to reset, or
3. Switch to a different provider in settings, or
4. Failover to a local model (see `llm-providers.md` runbook)

### 5. Verify Recovery

```bash
npm run dev
# Confirm logs show: "ProxyService: Initializing..."
# Test a chat message to verify proxy is forwarding requests
```

## Prevention

- Avoid running other services on the proxy port
- Monitor `QuotaService` warn-level logs for approaching limits
- Set up provider failover in model settings to avoid single-provider dependency
