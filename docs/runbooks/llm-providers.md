# Runbook: LLM Provider Failover & Recovery

## Problem: LLM Provider Failures

Token authentication fails, API rate limits are hit, or a remote provider becomes unavailable.

## Symptoms

- Chat responses fail with 401 (auth), 429 (rate limit), or 5xx (provider down) errors
- Logs show `TokenService` errors or `OllamaService`/`CopilotService` connection failures
- UI displays "model unavailable" or empty responses
- Slow or hanging requests that eventually timeout

## Diagnosis

1. **Check logs**: Search `logs/` for the specific provider service name (e.g., `OllamaService`, `CopilotService`).
2. **Identify error type**:
   - `401/403` → Token expired or revoked
   - `429` → Rate limit exceeded
   - `5xx` / timeout → Provider outage
   - `ECONNREFUSED` → Local model server (Ollama) not running
3. **Check token status**: Review `TokenService` logs in `src/main/services/security/token.service.ts`.
4. **Check model registry**: Verify the active model is still available via `ModelRegistryService`.

### Key Code Paths

- Ollama: `src/main/services/llm/ollama.service.ts`
- Copilot: `src/main/services/llm/copilot.service.ts`
- Token management: `src/main/services/security/token.service.ts`
- Model registry: `src/main/services/llm/model-registry.service.ts`
- Key rotation: `src/main/services/security/key-rotation.service.ts`

## Resolution

### 1. Token Expired (401/403)

1. Open Settings → Auth/Provider section
2. Re-authenticate or refresh the API key
3. `TokenService` will encrypt and store the new token via `SecurityService.encryptSync()`
4. Retry the chat request

### 2. Rate Limited (429)

1. Check the `Retry-After` header in logs for wait duration
2. Wait for the window to reset, or
3. Switch to another provider: Settings → Models → select alternate provider
4. For persistent limits, consider upgrading the API plan

### 3. Provider Outage (5xx / Timeout)

1. Confirm outage by checking the provider's status page
2. Failover to a local model:
   - Ensure Ollama is running: `ollama serve`
   - Select a local model in Settings → Models
3. `ModelRegistryService` tracks available models — verify a local model is registered

### 4. Local Model (Ollama) Not Running

1. Start Ollama: `ollama serve`
2. Verify: `ollama list` should show downloaded models
3. If no models exist: `ollama pull <model-name>`
4. Restart Tengra or re-select the local model in settings

### 5. Verify Recovery

```bash
npm run dev
# Send a test message in chat
# Confirm response arrives without errors in logs
```

## Prevention

- Configure multiple providers so failover is automatic
- Monitor `KeyRotationService` for upcoming token expirations
- Keep at least one local Ollama model downloaded as a fallback
- Set rate-limit alerts via `QuotaService` warn-level logs
