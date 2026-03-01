# MCP Plugin Development Guide

> Build plugins that extend Tengra's AI capabilities using the Model Context Protocol.

## Architecture Overview

Tengra supports two plugin types:

| Type | Class | Communication | Use Case |
|------|-------|---------------|----------|
| **Internal** | `InternalMcpPlugin` | In-process | Core features, direct service access |
| **External** | `ExternalMcpPlugin` | JSON-RPC over stdio | User/remote tools, isolated processes |

Both implement `IMcpPlugin` from `src/main/mcp/plugin-base.ts`.

## Plugin Lifecycle

```
initialize() → getActions() → dispatch(action, args) → dispose()
```

## Creating an Internal Plugin

Internal plugins are MCP servers registered in `src/main/mcp/registry.ts`. Use the template at `src/main/mcp/templates/server.template.ts`:

```typescript
import { buildActions, McpDeps } from '@main/mcp/server-utils';
import { McpService } from '@main/mcp/types';

export function buildMyServer(deps: McpDeps): McpService {
    return {
        name: 'my-server',
        description: 'My custom MCP server',
        actions: buildActions([
            {
                name: 'greet',
                description: 'Returns a greeting',
                handler: async ({ name }) => {
                    return { success: true, data: `Hello, ${name}!` };
                }
            },
            {
                name: 'systemInfo',
                description: 'Get system info via service',
                handler: async () => deps.system.getSystemInfo()
            }
        ], 'my-server', deps.auditLog)
    };
}
```

Register in `registry.ts`:
```typescript
import { buildMyServer } from './servers/my.server';
// Add to buildMcpServices(): buildMyServer(deps),
```

### Key Types

```typescript
// src/main/mcp/types.ts
interface McpResult { success: boolean; data?: JsonValue; error?: string }
interface McpAction { name: string; description: string; handler: (args: JsonObject) => Promise<McpResult> }
interface McpService { name: string; description: string; actions: McpAction[] }
```

## Creating an External Plugin

External plugins run as separate processes communicating via JSON-RPC over stdio:

```typescript
import { ExternalMcpPlugin } from '@main/mcp/external-plugin';

const plugin = new ExternalMcpPlugin('my-plugin', 'My external tool', {
    command: 'node',
    args: ['./my-mcp-server.js'],
    env: { MY_API_KEY: 'key' },
    isRemote: false  // 'user' source; true = 'remote' source
});

await plugin.initialize();
const result = await plugin.dispatch('toolName', { input: 'value' });
await plugin.dispose();
```

**Allowed commands**: `node`, `npm`, `npx`, `python`, `deno`, `bun`, `pnpm`, `yarn`, `uvx`.

## Available APIs (`McpDeps`)

Plugins access services via the `deps` parameter (see `src/main/mcp/server-utils.ts`):

| Service | Access | Example |
|---------|--------|---------|
| File system | `deps.filesystem` | Read/write files |
| Git | `deps.git` | Repository operations |
| Database | `deps.database` | Query PGlite |
| Command | `deps.command` | Execute system commands |
| Network | `deps.network` | HTTP requests |
| Security | `deps.security` | Encryption, validation |
| Ollama | `deps.ollama` | Local AI models |

## Utility Helpers

`server-utils.ts` provides validation and safety wrappers:

- **`buildActions(actions, name, auditLog)`** — Wraps handlers with error handling and audit logging
- **`withTimeout(handler, ms)`** — Adds timeout protection (default 30s)
- **`withRateLimit(deps, service, handler)`** — Rate limiting via `RateLimitService`
- **`validatePath(base, input)`** — Prevents path traversal attacks
- **`validateUrl(value)`** — Validates URL with protocol whitelist
- **`validateString(value, maxLen)`** / **`validateNumber(value, min, max)`**

## Security Constraints

- External plugins run with **sandboxed env vars** (only safe vars like `PATH`, `HOME`)
- **10MB buffer limit** on plugin stdout to prevent memory exhaustion
- **5-minute max execution time** with automatic termination
- **100 max pending requests** per plugin
- Command args are checked for **shell injection patterns** (`;&|$` etc.)
- Config integrity tracked via **SHA-256 hash**

## Debugging

1. External plugin stderr is logged at `debug` level — check `logs/` directory
2. All dispatches are audit-logged: `mcp:{service}:{action}` with duration and arg keys
3. Use `appLogger` in internal plugins:
   ```typescript
   import { appLogger } from '@main/logging/logger';
   appLogger.info('MyServer', 'Action executed', { key: 'value' });
   ```

## Best Practices

1. **Always return `McpResult`** — `{ success: true, data }` or `{ success: false, error }`
2. **Use `buildActions()`** — Provides automatic error wrapping and audit logging
3. **Validate all inputs** — Use `validateString`, `validatePath`, `validateUrl` helpers
4. **Keep handlers short** — Delegate to services; max 60 lines per function
5. **Use `withTimeout()`** for external calls to prevent hanging
6. **Never use `console.log`** — Use `appLogger` at appropriate levels
7. **Name files as `{domain}.server.ts`** in `src/main/mcp/servers/`
