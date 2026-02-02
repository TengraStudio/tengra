# IPC Handler Documentation

Inter-Process Communication (IPC) handlers enable communication between the main process (Node.js) and renderer process (React). This document describes all IPC channels and their contracts.

## Overview

Tandem uses Electron's IPC mechanism for secure communication:
- **Main Process**: Node.js backend with full system access
- **Renderer Process**: React frontend with restricted permissions
- **Preload Script**: Exposes safe IPC channels via `contextBridge`

### Architecture

```
Renderer → window.electron.<namespace>.<method>(params)
           ↓
Preload → ipcRenderer.invoke(channel, params)
           ↓
Main → ipcMain.handle(channel, handler)
```

### Security

- All IPC channels validated via `validation.ts`
- Context isolation enabled
- No direct Node.js access from renderer
- Input sanitization on all handlers

---

## Channel Naming Convention

```
<namespace>:<operation>
```

Examples:
- `chat:send` - Send chat message
- `db:getChats` - Get chats from database
- `files:read` - Read file

---

## Core Namespaces

### `chat` - Chat Operations

#### `chat:send`
Send chat message to LLM.

**Parameters**:
```typescript
{
  messages: Message[];
  model: string;
  provider: string;
  tools?: ToolDefinition[];
}
```

**Returns**: `Message` (assistant response)

**Validation**:
- Messages array must not be empty
- Model and provider must be valid strings
- Each message must have role and content

#### `chat:stream`
Stream chat response.

**Parameters**: Same as `chat:send`

**Returns**: Stream of message deltas

**Events**:
- `chat:streamChunk` - Content delta
- `chat:streamDone` - Stream complete
- `chat:streamError` - Stream error

#### `chat:stop`
Stop active chat stream.

**Parameters**: `{ chatId: string }`

---

### `db` - Database Operations

#### `db:getChats`
Get all chats.

**Parameters**: `{ projectId?: string }` (optional filter)

**Returns**: `Chat[]`

#### `db:createChat`
Create new chat.

**Parameters**: `Chat` object

**Returns**: `{ success: boolean; id: string }`

**Validation**:
- Title must be string
- Model and backend are optional
- Timestamps auto-generated

#### `db:deleteChat`
Delete chat and messages.

**Parameters**: `{ id: string }`

**Returns**: `{ success: boolean }`

**Note**: Cascades to delete all messages

#### `db:getMessages`
Get messages for chat.

**Parameters**: `{ chatId: string }`

**Returns**: `Message[]`

**Ordering**: Chronological by timestamp

---

### `files` - File System Operations

#### `files:read`
Read file contents.

**Parameters**:
```typescript
{
  path: string;
  encoding?: string; // default: utf-8
}
```

**Returns**: `string` (file contents)

**Validation**:
- Path must be absolute
- Path must be within allowed roots
- File must exist and be readable

**Security**: Path traversal protection via `path.resolve()`

#### `files:write`
Write file contents.

**Parameters**:
```typescript
{
  path: string;
  content: string;
  encoding?: string;
}
```

**Returns**: `{ success: boolean }`

**Validation**: Same as `files:read`

#### `files:list`
List directory contents.

**Parameters**:
```typescript
{
  path: string;
  recursive?: boolean;
}
```

**Returns**:
```typescript
{
  files: Array<{
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    modified: number;
  }>;
}
```

#### `files:searchFilesStream`
Search files with streaming results.

**Parameters**:
```typescript
{
  pattern: string;      // Glob pattern
  rootPath: string;
  maxResults?: number;
}
```

**Returns**: Stream of file paths

**Rate Limiting**: Applied to prevent abuse

---

### `project` - Project Management

#### `project:create`
Create new project.

**Parameters**:
```typescript
{
  title: string;
  path: string;
  description?: string;
}
```

**Returns**: `{ success: boolean; id: string }`

**Validation**:
- Title required (non-empty string)
- Path must be valid directory
- Path must not already be a project

#### `project:getAll`
Get all projects.

**Returns**: `Project[]`

#### `project:analyze`
Analyze project structure.

**Parameters**: `{ projectPath: string }`

**Returns**:
```typescript
{
  type: string;         // node, python, etc.
  dependencies: string[];
  symbols: CodeSymbol[];
}
```

---

### `git` - Git Operations

#### `git:status`
Get repository status.

**Parameters**: `{ repoPath: string }`

**Returns**:
```typescript
{
  branch: string;
  modified: string[];
  staged: string[];
  untracked: string[];
}
```

#### `git:commit`
Create commit.

**Parameters**:
```typescript
{
  repoPath: string;
  message: string;
  files?: string[];
}
```

**Returns**: `{ success: boolean; commitHash: string }`

**Validation**:
- Message must be non-empty
- Repo path must be valid git repository

#### `git:diff`
Get file diff.

**Parameters**:
```typescript
{
  repoPath: string;
  file?: string;
  staged?: boolean;
}
```

**Returns**: Diff string (unified format)

---

### `settings` - Settings Management

#### `settings:get`
Get all settings.

**Returns**: `AppSettings` object

#### `settings:set`
Update settings.

**Parameters**: `Partial<AppSettings>`

**Returns**: `{ success: boolean }`

**Note**: Settings auto-saved to disk with debouncing (2s)

#### `settings:reset`
Factory reset all settings.

**Returns**: `{ success: boolean }`

**Warning**: Irreversible operation

---

### `mcp` - MCP Tool Execution

#### `mcp:listTools`
List available MCP tools.

**Returns**: `ToolDefinition[]`

#### `mcp:execute`
Execute MCP tool.

**Parameters**:
```typescript
{
  tool: string;         // Tool name
  parameters: object;   // Tool parameters
}
```

**Returns**: Tool-specific result

**Validation**:
- Tool must exist
- Parameters must match tool schema

**Timeout**: 60 seconds default

---

### `auth` - Authentication

#### `auth:login`
Login to provider.

**Parameters**:
```typescript
{
  provider: string;     // openai, anthropic, etc.
  credentials: object;
}
```

**Returns**: `{ success: boolean; token: string }`

**Security**: Credentials encrypted before storage

#### `auth:logout`
Logout from provider.

**Parameters**: `{ provider: string }`

**Returns**: `{ success: boolean }`

#### `auth:getStatus`
Get authentication status.

**Returns**:
```typescript
{
  [provider: string]: {
    authenticated: boolean;
    username?: string;
    quotas?: object;
  }
}
```

---

### `terminal` - Terminal Operations

#### `terminal:create`
Create terminal session.

**Parameters**:
```typescript
{
  id: string;
  shell?: string;       // bash, zsh, etc.
  cwd?: string;
}
```

**Returns**: `{ success: boolean; id: string }`

#### `terminal:write`
Write to terminal.

**Parameters**:
```typescript
{
  id: string;
  data: string;
}
```

**Events**: `terminal:data` - Terminal output

#### `terminal:resize`
Resize terminal.

**Parameters**:
```typescript
{
  id: string;
  cols: number;
  rows: number;
}
```

#### `terminal:kill`
Terminate terminal session.

**Parameters**: `{ id: string }`

---

### `memory` - Knowledge Management

#### `memory:store`
Store memory fragment.

**Parameters**:
```typescript
{
  content: string;
  category: string;
  tags?: string[];
  importance?: number;  // 0-1
}
```

**Returns**: `{ success: boolean; id: string }`

#### `memory:search`
Search memories.

**Parameters**:
```typescript
{
  query: string;
  limit?: number;       // default: 10
  category?: string;
}
```

**Returns**:
```typescript
{
  results: Array<{
    id: string;
    content: string;
    relevance: number;  // 0-1
  }>;
}
```

---

## Validation Requirements

### Input Validation

All IPC handlers must validate:

1. **Type checking**:
   ```typescript
   if (typeof param !== 'string') {
     throw new Error('Invalid parameter type');
   }
   ```

2. **Required fields**:
   ```typescript
   if (!params.requiredField) {
     throw new Error('Missing required field');
   }
   ```

3. **Bounds checking**:
   ```typescript
   if (limit < 1 || limit > 1000) {
     throw new Error('Limit out of range');
   }
   ```

4. **Path validation**:
   ```typescript
   const resolved = path.resolve(userPath);
   if (!resolved.startsWith(allowedRoot)) {
     throw new Error('Path not allowed');
   }
   ```

### Output Validation

- Sanitize error messages (no stack traces to renderer)
- Remove sensitive data from responses
- Enforce size limits on large responses

---

## Error Handling

### Error Format

```typescript
{
  success: false;
  error: string;        // User-friendly message
  code?: string;        // Error code
}
```

### Error Codes

- `VALIDATION_ERROR` - Invalid parameters
- `NOT_FOUND` - Resource not found
- `PERMISSION_DENIED` - Access denied
- `INTERNAL_ERROR` - Internal failure
- `TIMEOUT` - Operation timeout

### Example Handler

```typescript
ipcMain.handle('namespace:operation', async (event, params) => {
  try {
    // Validate
    if (!params.requiredField) {
      return { success: false, error: 'Missing required field' };
    }
    
    // Execute
    const result = await service.operation(params);
    
    // Return
    return { success: true, data: result };
  } catch (error) {
    appLogger.error('Handler', 'Operation failed', error as Error);
    return { 
      success: false, 
      error: getErrorMessage(error)
    };
  }
});
```

---

## Security Best Practices

### ✅ Do

- Validate all inputs
- Use whitelists for allowed values
- Sanitize file paths
- Log security-relevant operations
- Use parameterized queries for database
- Encrypt sensitive data

### ❌ Don't

- Trust renderer input
- Use `eval()` or `Function()`
- Execute arbitrary commands
- Return raw error objects
- Expose file system structure
- Log credentials

---

## Rate Limiting

Apply rate limiting to:
- File search operations
- Database writes
- External API calls
- Tool executions
- Terminal input

**Implementation**:
```typescript
await rateLimitService.waitForToken('operation:name');
```

---

## Testing IPC Handlers

### Unit Test Example

```typescript
describe('files:read handler', () => {
  it('should read file contents', async () => {
    const result = await ipcMain.invoke('files:read', {
      path: '/allowed/path/file.txt'
    });
    
    expect(result).toBe('file contents');
  });
  
  it('should reject path traversal', async () => {
    const result = await ipcMain.invoke('files:read', {
      path: '/allowed/path/../../etc/passwd'
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('not allowed');
  });
});
```

---

## Migration Guide

### Adding New IPC Handler

1. **Define handler**:
   ```typescript
   // src/main/ipc/myfeature.ts
   export function setupMyFeatureIpc(deps) {
     ipcMain.handle('myfeature:operation', async (event, params) => {
       // Implementation
     });
   }
   ```

2. **Register in index**:
   ```typescript
   // src/main/ipc/index.ts
   import { setupMyFeatureIpc } from './myfeature';
   
   export function setupIpcHandlers(deps) {
     setupMyFeatureIpc(deps);
     // ...
   }
   ```

3. **Add to preload**:
   ```typescript
   // src/preload/index.ts
   contextBridge.exposeInMainWorld('electron', {
     myFeature: {
       operation: (params) => ipcRenderer.invoke('myfeature:operation', params)
     }
   });
   ```

4. **Add TypeScript types**:
   ```typescript
   // src/shared/types/electron.d.ts
   interface Window {
     electron: {
       myFeature: {
         operation: (params: Params) => Promise<Result>;
       };
     };
   }
   ```

---

## Troubleshooting

### Handler Not Found

- Check handler registration in `src/main/ipc/index.ts`
- Verify channel name matches exactly
- Ensure handler is registered before app ready

### Validation Errors

- Check parameter types
- Verify required fields present
- Review validation rules in handler

### Performance Issues

- Enable caching for expensive operations
- Use streaming for large datasets
- Apply rate limiting
- Monitor handler execution time

---

## References

- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/api/ipc-main)
- [CONFIG.md](CONFIG.md) - Configuration guide
- [API.md](API.md) - REST API reference
- [MCP.md](MCP.md) - MCP server documentation
