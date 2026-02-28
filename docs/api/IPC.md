# IPC Handler Documentation

Inter-Process Communication (IPC) handlers enable communication between the main process (Node.js) and renderer process (React). This document describes all IPC channels and their contracts.

## Overview

Tengra uses Electron's IPC mechanism for secure communication:
- **Main Process**: Node.js backend with full system access
- **Renderer Process**: React frontend with restricted permissions
- **Preload Script**: Exposes safe IPC channels via `contextBridge`

## Central IPC Contract Reference

Use these files as the single source of truth for IPC contract auditing and payload validation:

- `src/main/ipc/index.ts` - all registered IPC domains in main process.
- `src/main/utils/ipc-wrapper.util.ts` - validation wrapper behavior and error handling.
- `src/shared/constants/ipc-contract.ts` - renderer/main contract negotiation compatibility.
- `src/renderer/lib/ipc-client.ts` - typed IPC invocation and runtime schema checks.

### Registered IPC domains (main)

`agent`, `audit`, `auth`, `backup`, `brain`, `chat`, `code-intelligence`, `code-sandbox`, `collaboration`, `contract`, `db`, `dialog`, `export`, `files`, `gallery`, `git`, `health`, `huggingface`, `key-rotation`, `lazy-services`, `llama`, `logging`, `marketplace`, `mcp`, `memory`, `metrics`, `migration`, `multi-model`, `ollama`, `performance`, `process`, `project`, `prompt-templates`, `proxy`, `proxy-embed`, `screenshot`, `sd-cpp`, `settings`, `ssh`, `terminal`, `token-estimation`, `tools`, `usage`, `voice`, `window`.

### MCP marketplace payload contract checkpoints

Critical channels are validated in `src/main/ipc/mcp-marketplace.ts` with Zod schemas:

- `mcp:marketplace:list` / `search` / `filter` / `categories`
- `mcp:marketplace:install` / `uninstall` / `toggle`
- `mcp:marketplace:update-config` / `version-history` / `rollback-version`
- `mcp:marketplace:security-scan`
- `mcp:marketplace:reviews:*`
- `mcp:marketplace:telemetry:*`

These channels should be treated as audited contract surfaces for marketplace behavior changes.

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

## Comprehensive IPC Channel Reference

> **Auto-documented from `src/main/ipc/*.ts`** — All channels use the renderer→main direction via `ipcRenderer.invoke` / `ipcMain.handle` unless noted otherwise.

### Legend

| Symbol | Meaning |
|--------|---------|
| →  | Renderer → Main (`ipcRenderer.invoke`) |
| ←  | Main → Renderer (`webContents.send`) |
| ↔  | Bidirectional |

---

### Advanced Memory (`advancedMemory:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `advancedMemory:remember` | → | Store a new advanced memory entry |
| `advancedMemory:recall` | → | Recall memories by query |
| `advancedMemory:search` | → | Search memories with filters |
| `advancedMemory:searchAcrossProjects` | → | Search memories across all projects |
| `advancedMemory:get` | → | Get a specific memory by ID |
| `advancedMemory:getAllAdvancedMemories` | → | List all advanced memories |
| `advancedMemory:getAllEntityKnowledge` | → | Get all entity-level knowledge |
| `advancedMemory:getAllEpisodes` | → | Get all episodic memories |
| `advancedMemory:getPending` | → | Get memories pending confirmation |
| `advancedMemory:getHistory` | → | Get memory change history |
| `advancedMemory:getStats` | → | Get memory subsystem statistics |
| `advancedMemory:getSearchAnalytics` | → | Get search usage analytics |
| `advancedMemory:getSearchHistory` | → | Get past search queries |
| `advancedMemory:getSearchSuggestions` | → | Get autocomplete suggestions for search |
| `advancedMemory:getSharedNamespaceAnalytics` | → | Analytics for shared namespaces |
| `advancedMemory:edit` | → | Edit an existing memory |
| `advancedMemory:delete` | → | Delete a single memory |
| `advancedMemory:deleteMany` | → | Bulk-delete memories |
| `advancedMemory:confirm` | → | Confirm a pending memory |
| `advancedMemory:confirmAll` | → | Confirm all pending memories |
| `advancedMemory:reject` | → | Reject a pending memory |
| `advancedMemory:rejectAll` | → | Reject all pending memories |
| `advancedMemory:archive` | → | Archive a memory |
| `advancedMemory:archiveMany` | → | Bulk-archive memories |
| `advancedMemory:restore` | → | Restore an archived memory |
| `advancedMemory:recategorize` | → | Change memory category |
| `advancedMemory:rollback` | → | Rollback a memory to previous version |
| `advancedMemory:runDecay` | → | Trigger memory decay algorithm |
| `advancedMemory:extractFromMessage` | → | Extract memories from a chat message |
| `advancedMemory:export` | → | Export memories to file |
| `advancedMemory:import` | → | Import memories from file |
| `advancedMemory:createSharedNamespace` | → | Create a shared memory namespace |
| `advancedMemory:shareWithProject` | → | Share memories with a project |
| `advancedMemory:syncSharedNamespace` | → | Sync shared namespace across projects |
| `advancedMemory:health` | → | Health check for memory subsystem |

### Agent (`agent:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `agent:create` | → | Create a new AI agent |
| `agent:get` | → | Get agent by ID |
| `agent:get-all` | → | List all agents |
| `agent:get-templates-library` | → | Get agent template library |
| `agent:validate-template` | → | Validate an agent template |
| `agent:clone` | → | Clone an existing agent |
| `agent:delete` | → | Delete an agent |
| `agent:export` | → | Export agent configuration |
| `agent:import` | → | Import agent configuration |
| `agent:recover` | → | Recover a deleted agent |

### Audit (`audit:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `audit:getLogs` | → | Retrieve audit log entries |
| `audit:clearLogs` | → | Clear audit log history |

### Auth & Security (`auth:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `auth:github-login` | → | Initiate GitHub OAuth login |
| `auth:poll-token` | → | Poll for OAuth token completion |
| `auth:detect-provider` | → | Detect authentication provider from key |
| `auth:start-session` | → | Start a new auth session |
| `auth:end-session` | → | End current auth session |
| `auth:touch-session` | → | Refresh session activity timestamp |
| `auth:get-session-timeout` | → | Get session timeout configuration |
| `auth:set-session-timeout` | → | Set session timeout duration |
| `auth:set-session-limit` | → | Set max concurrent sessions |
| `auth:get-session-analytics` | → | Get session usage analytics |
| `auth:link-account` | → | Link an external account |
| `auth:unlink-account` | → | Unlink an external account |
| `auth:unlink-provider` | → | Remove an entire provider |
| `auth:set-active-linked-account` | → | Set the active linked account |
| `auth:revoke-account-token` | → | Revoke a specific account token |
| `auth:get-token-analytics` | → | Get token usage analytics |
| `auth:get-provider-analytics` | → | Get per-provider analytics |
| `auth:get-provider-health` | → | Check provider health status |
| `auth:rotate-token-encryption` | → | Rotate token encryption keys |
| `auth:export-credentials` | → | Export credentials (encrypted) |
| `auth:import-credentials` | → | Import credentials |
| `auth:create-master-key-backup` | → | Backup the master encryption key |
| `auth:restore-master-key-backup` | → | Restore master key from backup |

### Backup (`backup:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `backup:create` | → | Create a new backup |
| `backup:restore` | → | Restore from a backup |
| `backup:list` | → | List available backups |
| `backup:delete` | → | Delete a backup |
| `backup:verify` | → | Verify backup integrity |
| `backup:cleanup` | → | Clean up old backups |
| `backup:getDir` | → | Get backup directory path |
| `backup:configureAutoBackup` | → | Configure automatic backup schedule |
| `backup:getAutoBackupStatus` | → | Get auto-backup status |
| `backup:createDisasterRecoveryBundle` | → | Create full disaster recovery bundle |
| `backup:restoreDisasterRecoveryBundle` | → | Restore from disaster recovery bundle |
| `backup:syncToCloudDir` | → | Sync backup to cloud directory |

### Brain (`brain:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `brain:learn` | → | Teach the brain a new fact |
| `brain:recall` | → | Recall facts by query |
| `brain:forget` | → | Remove a learned fact |
| `brain:getByCategory` | → | Get facts by category |
| `brain:getContext` | → | Get contextual knowledge |
| `brain:getStats` | → | Get brain statistics |
| `brain:extractFromMessage` | → | Extract facts from chat message |
| `brain:updateConfidence` | → | Update fact confidence score |

### Chat (`chat:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `chat:stream` | ↔ | Stream chat response from LLM |
| `chat:cancel` | → | Cancel an active chat stream |
| `chat:copilot` | → | Send message via Copilot provider |
| `chat:openai` | → | Send message via OpenAI provider |
| `chat:retry-with-model` | → | Retry last message with different model |

### Clipboard (`clipboard:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `clipboard:readText` | → | Read text from system clipboard |
| `clipboard:writeText` | → | Write text to system clipboard |

### Code Intelligence (`code:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `code:indexProject` | → | Index a project for code intelligence |
| `code:findSymbols` | → | Find symbols by name |
| `code:querySymbols` | → | Query symbols with filters |
| `code:queryIndexedSymbols` | → | Query pre-indexed symbol database |
| `code:findDefinition` | → | Go to symbol definition |
| `code:findReferences` | → | Find all references to a symbol |
| `code:findImplementations` | → | Find implementations of interface/class |
| `code:findUsage` | → | Find usages of a symbol |
| `code:getFileOutline` | → | Get outline/structure of a file |
| `code:getSymbolRelationships` | → | Get relationships between symbols |
| `code:getSymbolAnalytics` | → | Get analytics for a symbol |
| `code:previewRenameSymbol` | → | Preview a symbol rename |
| `code:applyRenameSymbol` | → | Apply a symbol rename |
| `code:analyzeQuality` | → | Analyze code quality metrics |
| `code:scanTodos` | → | Scan for TODO/FIXME comments |
| `code:searchFiles` | → | Search files by content |
| `code:generateFileDocumentation` | → | Generate docs for a file |
| `code:generateProjectDocumentation` | → | Generate docs for entire project |

### Code Sandbox (`code-sandbox:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `code-sandbox:execute` | → | Execute code in sandboxed environment |
| `code-sandbox:health` | → | Check sandbox health |
| `code-sandbox:languages` | → | List supported sandbox languages |

### Collaboration (`collaboration:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `collaboration:run` | → | Run a collaborative task |
| `collaboration:getActiveTaskCount` | → | Get count of active tasks |
| `collaboration:getProviderStats` | → | Get collaboration provider stats |
| `collaboration:setProviderConfig` | → | Configure collaboration provider |
| `collaboration:sync:join` | → | Join a sync session |
| `collaboration:sync:leave` | → | Leave a sync session |
| `collaboration:sync:send` | → | Send message in sync session |

### Context Window (`context-window:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `context-window:getInfo` | → | Get context window info for model |
| `context-window:getRecommendedSettings` | → | Get recommended context settings |
| `context-window:needsTruncation` | → | Check if messages need truncation |
| `context-window:truncate` | → | Truncate messages to fit context |

### Contract (`ipc:contract:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `ipc:contract:get` | → | Get the IPC contract definition |

### Database (`db:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `db:getAllChats` | → | Get all chats |
| `db:getChatById` | → | Get a specific chat by ID |
| `db:createChat` | → | Create a new chat |
| `db:updateChat` | → | Update chat metadata |
| `db:updateChatTitle` | → | Update chat title |
| `db:deleteChat` | → | Delete a chat and its messages |
| `db:archiveChat` | → | Archive a chat |
| `db:pinChat` | → | Pin/unpin a chat |
| `db:favoriteChat` | → | Favorite/unfavorite a chat |
| `db:searchChats` | → | Search chats by query |
| `db:moveChatToFolder` | → | Move chat to a folder |
| `db:clearHistory` | → | Clear all chat history |
| `db:getMessages` | → | Get messages for a chat |
| `db:addMessage` | → | Add a message to a chat |
| `db:deleteMessages` | → | Delete specific messages |
| `db:updateMessageVector` | → | Update message embedding vector |
| `db:searchSimilarMessages` | → | Semantic search across messages |
| `db:getFolders` | → | Get all chat folders |
| `db:createFolder` | → | Create a chat folder |
| `db:updateFolder` | → | Update folder metadata |
| `db:deleteFolder` | → | Delete a folder |
| `db:getProjects` | → | Get all projects |
| `db:getProjectById` | → | Get a project by ID |
| `db:createProject` | → | Create a new project |
| `db:updateProject` | → | Update project metadata |
| `db:deleteProject` | → | Delete a project |
| `db:getPrompts` | → | Get all saved prompts |
| `db:createPrompt` | → | Create a saved prompt |
| `db:updatePrompt` | → | Update a saved prompt |
| `db:deletePrompt` | → | Delete a saved prompt |
| `db:recordUsage` | → | Record usage statistics |
| `db:getUsageStats` | → | Get usage statistics |
| `db:getDetailedStats` | → | Get detailed statistics |
| `db:getProviderStats` | → | Get per-provider statistics |

### Dialog (`dialog:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `dialog:saveFile` | → | Open native save-file dialog |
| `dialog:selectDirectory` | → | Open native directory picker |

### Diff (`diff:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `diff:getDiffById` | → | Get a specific diff by ID |
| `diff:getRecentChanges` | → | Get recent file changes |
| `diff:getSessionChanges` | → | Get changes in current session |
| `diff:getChangesBySystem` | → | Get changes grouped by system |
| `diff:getFileHistory` | → | Get change history for a file |
| `diff:getStats` | → | Get diff statistics |
| `diff:revertChange` | → | Revert a specific change |
| `diff:cleanup` | → | Clean up old diff records |

### Export (`export:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `export:markdown` | → | Export chat as Markdown |
| `export:pdf` | → | Export chat as PDF |

### Files (`files:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `files:readFile` | → | Read file contents |
| `files:readImage` | → | Read image file as base64 |
| `files:writeFile` | → | Write content to file |
| `files:deleteFile` | → | Delete a file |
| `files:exists` | → | Check if path exists |
| `files:listDirectory` | → | List directory contents |
| `files:createDirectory` | → | Create a directory |
| `files:deleteDirectory` | → | Delete a directory |
| `files:renamePath` | → | Rename/move a file or directory |
| `files:selectFile` | → | Open native file picker |
| `files:selectDirectory` | → | Open native directory picker |
| `files:searchFiles` | → | Search files by pattern |
| `files:searchFilesStream` | → | Stream file search results |
| `files:health` | → | File service health check |
| `app:getUserDataPath` | → | Get user data directory path |

### Gallery (`gallery:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `gallery:list` | → | List generated images |
| `gallery:open` | → | Open image in default viewer |
| `gallery:reveal` | → | Reveal image in file explorer |
| `gallery:delete` | → | Delete a generated image |
| `gallery:batch-download` | → | Batch download images |

### Git (`git:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `git:isRepository` | → | Check if path is a git repo |
| `git:getStatus` | → | Get working tree status |
| `git:getDetailedStatus` | → | Get detailed status with stats |
| `git:getTreeStatus` | → | Get tree-level status |
| `git:getBranch` | → | Get current branch name |
| `git:getBranches` | → | List all branches |
| `git:getTrackingInfo` | → | Get remote tracking info |
| `git:getRemotes` | → | List remotes |
| `git:getLastCommit` | → | Get last commit info |
| `git:getRecentCommits` | → | Get recent commit history |
| `git:getCommitDiff` | → | Get diff for a commit |
| `git:getCommitStats` | → | Get commit statistics |
| `git:getFileDiff` | → | Get diff for a specific file |
| `git:getDiffStats` | → | Get diff statistics |
| `git:getUnifiedDiff` | → | Get unified diff output |
| `git:stageFile` | → | Stage a file |
| `git:unstageFile` | → | Unstage a file |
| `git:commit` | → | Create a commit |
| `git:push` | → | Push to remote |
| `git:pull` | → | Pull from remote |
| `git:checkout` | → | Checkout branch or file |

### Git Advanced (`git:*` — advanced operations)

| Channel | Dir | Description |
|---------|-----|-------------|
| `git:getStashes` | → | List stashes |
| `git:createStash` | → | Create a stash |
| `git:applyStash` | → | Apply a stash |
| `git:dropStash` | → | Drop a stash |
| `git:exportStash` | → | Export a stash |
| `git:getConflicts` | → | Get merge conflicts |
| `git:resolveConflict` | → | Resolve a merge conflict |
| `git:openMergeTool` | → | Open external merge tool |
| `git:cancelOperation` | → | Cancel active git operation |
| `git:getBlame` | → | Get line-by-line blame |
| `git:getCommitDetails` | → | Get full commit details |
| `git:getRepositoryStats` | → | Get repository statistics |
| `git:exportRepositoryStats` | → | Export repo stats as report |
| `git:startRebase` | → | Start an interactive rebase |
| `git:continueRebase` | → | Continue a rebase |
| `git:abortRebase` | → | Abort a rebase |
| `git:getRebaseStatus` | → | Get rebase status |
| `git:getRebasePlan` | → | Get rebase plan |
| `git:runControlledOperation` | → | Run a controlled git operation |
| `git:startFlowBranch` | → | Start a git-flow branch |
| `git:finishFlowBranch` | → | Finish a git-flow branch |
| `git:getFlowStatus` | → | Get git-flow status |
| `git:getHooks` | → | List git hooks |
| `git:installHook` | → | Install a git hook |
| `git:validateHook` | → | Validate a git hook |
| `git:testHook` | → | Test a git hook |
| `git:exportHooks` | → | Export git hooks |
| `git:getSubmodules` | → | List submodules |
| `git:addSubmodule` | → | Add a submodule |
| `git:removeSubmodule` | → | Remove a submodule |
| `git:initSubmodules` | → | Initialize submodules |
| `git:updateSubmodules` | → | Update submodules |
| `git:syncSubmodules` | → | Sync submodule URLs |

### Health (`health:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `health:check` | → | Run full health check |
| `health:status` | → | Get quick status |
| `health:listServices` | → | List all registered services |
| `health:getService` | → | Get specific service health |

### HuggingFace (`hf:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `hf:search-models` | → | Search HuggingFace models |
| `hf:get-model-preview` | → | Preview model card details |
| `hf:get-files` | → | List model files |
| `hf:get-recommendations` | → | Get model recommendations |
| `hf:get-optimization-suggestions` | → | Get optimization suggestions |
| `hf:compare-models` | → | Compare multiple models |
| `hf:validate-compatibility` | → | Validate hardware compatibility |
| `hf:download-file` | → | Download a model file |
| `hf:cancel-download` | → | Cancel active download |
| `hf:test-downloaded-model` | → | Test a downloaded model |
| `hf:convert-model` | → | Convert model format |
| `hf:validate-conversion` | → | Validate conversion result |
| `hf:get-conversion-presets` | → | Get conversion preset configs |
| `hf:cache-stats` | → | Get model cache statistics |
| `hf:cache-clear` | → | Clear model cache |
| `hf:finetune:start` | → | Start model fine-tuning |
| `hf:finetune:get` | → | Get fine-tune job status |
| `hf:finetune:list` | → | List fine-tune jobs |
| `hf:finetune:cancel` | → | Cancel a fine-tune job |
| `hf:finetune:evaluate` | → | Evaluate fine-tuned model |
| `hf:finetune:export` | → | Export fine-tuned model |
| `hf:finetune:prepare-dataset` | → | Prepare dataset for fine-tuning |
| `hf:versions:list` | → | List model versions |
| `hf:versions:compare` | → | Compare model versions |
| `hf:versions:register` | → | Register a model version |
| `hf:versions:rollback` | → | Rollback to previous version |
| `hf:versions:pin` | → | Pin a specific version |
| `hf:versions:notifications` | → | Get version update notifications |
| `hf:watchlist:add` | → | Add model to watchlist |
| `hf:watchlist:get` | → | Get watchlist |
| `hf:watchlist:remove` | → | Remove model from watchlist |

### Ideas (`ideas:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `ideas:createSession` | → | Create an idea generation session |
| `ideas:deleteSession` | → | Delete an idea session |
| `ideas:getSession` | → | Get session by ID |
| `ideas:getSessions` | → | List all idea sessions |
| `ideas:startGeneration` | → | Start generating ideas |
| `ideas:cancelSession` | → | Cancel active generation |
| `ideas:getIdeas` | → | Get ideas in a session |
| `ideas:getIdea` | → | Get a specific idea |
| `ideas:approveIdea` | → | Approve an idea |
| `ideas:rejectIdea` | → | Reject an idea |
| `ideas:archiveIdea` | → | Archive an idea |
| `ideas:restoreIdea` | → | Restore archived idea |
| `ideas:deleteIdea` | → | Delete an idea |
| `ideas:getArchivedIdeas` | → | Get archived ideas |
| `ideas:enrichIdea` | → | Enrich idea with more detail |
| `ideas:regenerateIdea` | → | Regenerate a single idea |
| `ideas:scoreIdea` | → | Score an idea |
| `ideas:quickScore` | → | Quick-score an idea |
| `ideas:rankIdeas` | → | Rank ideas by criteria |
| `ideas:compareIdeas` | → | Compare two ideas |
| `ideas:validateIdea` | → | Validate idea feasibility |
| `ideas:generateMarketPreview` | → | Generate market preview |
| `ideas:canGenerateLogo` | → | Check if logo generation available |
| `ideas:generateLogo` | → | Generate logo for idea |
| `ideas:startResearch` | → | Start deep research on idea |
| `ideas:deepResearch` | → | Run deep research analysis |
| `ideas:queryResearch` | → | Query research results |
| `ideas:clearResearchCache` | → | Clear research cache |

### Key Rotation (`key-rotation:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `key-rotation:initialize` | → | Initialize key rotation system |
| `key-rotation:rotate` | → | Trigger key rotation |
| `key-rotation:getStatus` | → | Get rotation status |
| `key-rotation:getCurrentKey` | → | Get current active key ID |

### Lazy Services (`lazy:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `lazy:get-status` | → | Get lazy-loaded service status |

### Llama.cpp (`llama:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `llama:getModels` | → | List available Llama models |
| `llama:getModelsDir` | → | Get models directory path |
| `llama:loadModel` | → | Load a model into memory |
| `llama:unloadModel` | → | Unload model from memory |
| `llama:chat` | → | Send chat to Llama model |
| `llama:deleteModel` | → | Delete a model file |
| `llama:downloadModel` | → | Download a model |
| `llama:getConfig` | → | Get Llama configuration |
| `llama:setConfig` | → | Set Llama configuration |
| `llama:getGpuInfo` | → | Get GPU info for Llama |
| `llama:resetSession` | → | Reset Llama chat session |

### Logging (`log:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `log:write` | → | Write a log entry |
| `log:buffer:get` | → | Get buffered log entries |
| `log:buffer:clear` | → | Clear log buffer |
| `log:stream:start` | → | Start log streaming to renderer |
| `log:stream:stop` | → | Stop log streaming |

### LLM Multi-Model (`llm:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `llm:compare-models` | → | Compare responses across models |

### Marketplace (`marketplace:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `marketplace:getModels` | → | Get marketplace model listings |
| `marketplace:searchModels` | → | Search marketplace models |
| `marketplace:getModelDetails` | → | Get model detail page |
| `marketplace:getStatus` | → | Get marketplace status |

### MCP (`mcp:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `mcp:list` | → | List installed MCP servers |
| `mcp:install` | → | Install an MCP server |
| `mcp:uninstall` | → | Uninstall an MCP server |
| `mcp:toggle` | → | Enable/disable an MCP server |
| `mcp:dispatch` | → | Dispatch a tool call to MCP |
| `mcp:debug-metrics` | → | Get MCP debug metrics |
| `mcp:permissions:set` | → | Set MCP permissions |
| `mcp:permissions:list-requests` | → | List permission requests |
| `mcp:permissions:resolve-request` | → | Resolve a permission request |

### MCP Marketplace (`mcp:marketplace:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `mcp:marketplace:list` | → | List MCP marketplace items |
| `mcp:marketplace:search` | → | Search MCP marketplace |
| `mcp:marketplace:filter` | → | Filter marketplace by criteria |
| `mcp:marketplace:categories` | → | Get marketplace categories |
| `mcp:marketplace:installed` | → | List installed marketplace items |
| `mcp:marketplace:install` | → | Install from marketplace |
| `mcp:marketplace:uninstall` | → | Uninstall marketplace item |
| `mcp:marketplace:toggle` | → | Toggle marketplace item |
| `mcp:marketplace:update-config` | → | Update item configuration |
| `mcp:marketplace:version-history` | → | Get item version history |
| `mcp:marketplace:rollback-version` | → | Rollback to earlier version |
| `mcp:marketplace:security-scan` | → | Run security scan on item |
| `mcp:marketplace:refresh` | → | Refresh marketplace data |
| `mcp:marketplace:health` | → | Marketplace health check |
| `mcp:marketplace:debug` | → | Get marketplace debug info |
| `mcp:marketplace:draft-extension` | → | Draft a new extension |
| `mcp:marketplace:extension-templates` | → | Get extension templates |
| `mcp:marketplace:reviews:list` | → | List reviews for an item |
| `mcp:marketplace:reviews:submit` | → | Submit a review |
| `mcp:marketplace:reviews:vote` | → | Vote on a review |
| `mcp:marketplace:reviews:moderate` | → | Moderate a review |
| `mcp:marketplace:telemetry:track` | → | Track telemetry event |
| `mcp:marketplace:telemetry:summary` | → | Get telemetry summary |
| `mcp:marketplace:telemetry:crash` | → | Report crash telemetry |

### Memory (`memory:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `memory:getAll` | → | Get all memory entries |
| `memory:search` | → | Search memories |
| `memory:addFact` | → | Add a fact to memory |
| `memory:deleteFact` | → | Delete a memory fact |
| `memory:setEntityFact` | → | Set fact for a named entity |
| `memory:deleteEntity` | → | Delete a named entity |

### Metrics (`metrics:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `metrics:get-summary` | → | Get metrics summary |
| `metrics:get-provider-stats` | → | Get per-provider metrics |
| `metrics:reset` | → | Reset metrics |

### Migration (`migration:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `migration:status` | → | Get database migration status |

### Model Downloader (`model-downloader:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `model-downloader:start` | → | Start model download |
| `model-downloader:cancel` | → | Cancel a download |
| `model-downloader:pause` | → | Pause a download |
| `model-downloader:resume` | → | Resume a paused download |

### Model Registry (`model-registry:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `model-registry:getAllModels` | → | Get all registered models |
| `model-registry:getInstalledModels` | → | Get locally installed models |
| `model-registry:getRemoteModels` | → | Get available remote models |

### Ollama (`ollama:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `ollama:isRunning` | → | Check if Ollama is running |
| `ollama:start` | → | Start Ollama server |
| `ollama:getModels` | → | List downloaded models |
| `ollama:tags` | → | Get model tags |
| `ollama:getLibraryModels` | → | Get Ollama library models |
| `ollama:pull` | → | Pull/download a model |
| `ollama:abortPull` | → | Abort a model pull |
| `ollama:chat` | → | Send chat (non-streaming) |
| `ollama:chatStream` | ↔ | Stream chat response |
| `ollama:abort` | → | Abort active request |
| `ollama:testConnection` | → | Test Ollama connection |
| `ollama:reconnect` | → | Reconnect to Ollama |
| `ollama:getConnectionStatus` | → | Get connection status |
| `ollama:healthStatus` | → | Get Ollama health status |
| `ollama:forceHealthCheck` | → | Force a health check |
| `ollama:checkModelHealth` | → | Check specific model health |
| `ollama:checkAllModelsHealth` | → | Check all models health |
| `ollama:getModelRecommendations` | → | Get model recommendations |
| `ollama:getRecommendedModelForTask` | → | Get best model for a task |
| `ollama:checkCuda` | → | Check CUDA availability |
| `ollama:getGPUInfo` | → | Get GPU information |
| `ollama:startGPUMonitoring` | → | Start GPU monitoring |
| `ollama:stopGPUMonitoring` | → | Stop GPU monitoring |
| `ollama:getGPUAlertThresholds` | → | Get GPU alert thresholds |
| `ollama:setGPUAlertThresholds` | → | Set GPU alert thresholds |

### Orchestrator (`orchestrator:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `orchestrator:start` | → | Start task orchestration |
| `orchestrator:stop` | → | Stop orchestration |
| `orchestrator:approve` | → | Approve orchestrated step |
| `orchestrator:get-state` | → | Get orchestrator state |

### Performance (`performance:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `performance:get-memory-stats` | → | Get memory usage stats |
| `performance:get-dashboard` | → | Get performance dashboard data |
| `performance:detect-leak` | → | Detect memory leaks |
| `performance:trigger-gc` | → | Trigger garbage collection |

### Process (`process:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `process:spawn` | → | Spawn a child process |
| `process:write` | → | Write to a running process |
| `process:kill` | → | Kill a running process |
| `process:resize` | → | Resize process terminal |
| `process:list` | → | List running processes |
| `process:scan-scripts` | → | Scan package.json scripts |

### Project (`project:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `project:analyze` | → | Analyze project structure |
| `project:analyzeDirectory` | → | Analyze a directory |
| `project:analyzeIdentity` | → | Analyze project identity/branding |
| `project:watch` | → | Watch project for changes |
| `project:unwatch` | → | Stop watching a project |
| `project:getEnv` | → | Get project environment vars |
| `project:saveEnv` | → | Save project environment vars |
| `project:getCompletion` | → | Get code completion |
| `project:getInlineSuggestion` | → | Get inline suggestion |
| `project:trackInlineSuggestionTelemetry` | → | Track suggestion telemetry |
| `project:generateLogo` | → | Generate project logo |
| `project:improveLogoPrompt` | → | Improve logo generation prompt |
| `project:uploadLogo` | → | Upload a custom logo |
| `project:applyLogo` | → | Apply logo to project |

### Project Agent (`project:*` — agent/planning)

| Channel | Dir | Description |
|---------|-----|-------------|
| `project:plan` | → | Generate project plan |
| `project:start` | → | Start plan execution |
| `project:stop` | → | Stop plan execution |
| `project:get-status` | → | Get agent execution status |
| `project:get-events` | → | Get agent events log |
| `project:get-messages` | → | Get agent messages |
| `project:approve-current-plan` | → | Approve the current plan |
| `project:reject-current-plan` | → | Reject the current plan |
| `project:approve-step` | → | Approve a specific step |
| `project:edit-step` | → | Edit a plan step |
| `project:skip-step` | → | Skip a plan step |
| `project:retry-step` | → | Retry a failed step |
| `project:add-step-comment` | → | Add comment to a step |
| `project:insert-intervention` | → | Insert manual intervention |
| `project:reset-state` | → | Reset agent state |
| `project:pause-task` | → | Pause a running task |
| `project:resume-task` | → | Resume a paused task |
| `project:delete-task` | → | Delete a task |
| `project:delete-task-by-node` | → | Delete task by canvas node |
| `project:get-task-history` | → | Get task execution history |
| `project:health` | → | Agent health check |
| `project:select-model` | → | Select model for agent |
| `project:get-available-models` | → | Get models available to agent |
| `project:get-plan-versions` | → | Get plan version history |
| `project:get-performance-metrics` | → | Get agent performance metrics |
| `project:get-telemetry` | → | Get agent telemetry |
| `project:get-checkpoints` | → | List execution checkpoints |
| `project:resume-checkpoint` | → | Resume from checkpoint |
| `project:rollback-checkpoint` | → | Rollback to checkpoint |
| `project:save-snapshot` | → | Save execution snapshot |
| `project:create-pr` | → | Create pull request from changes |

### Project Agent — Canvas

| Channel | Dir | Description |
|---------|-----|-------------|
| `project:get-canvas-nodes` | → | Get canvas nodes |
| `project:save-canvas-nodes` | → | Save canvas nodes |
| `project:delete-canvas-node` | → | Delete a canvas node |
| `project:get-canvas-edges` | → | Get canvas edges |
| `project:save-canvas-edges` | → | Save canvas edges |
| `project:delete-canvas-edge` | → | Delete a canvas edge |

### Project Agent — Templates

| Channel | Dir | Description |
|---------|-----|-------------|
| `project:get-templates` | → | List project templates |
| `project:get-template` | → | Get a specific template |
| `project:save-template` | → | Save a project template |
| `project:delete-template` | → | Delete a template |
| `project:export-template` | → | Export template as file |
| `project:import-template` | → | Import template from file |
| `project:apply-template` | → | Apply template to project |

### Project Agent — Profiles & Routing

| Channel | Dir | Description |
|---------|-----|-------------|
| `project:get-profiles` | → | List agent profiles |
| `project:register-profile` | → | Register a new profile |
| `project:delete-profile` | → | Delete a profile |
| `project:get-routing-rules` | → | Get task routing rules |
| `project:set-routing-rules` | → | Set task routing rules |
| `project:get-teamwork-analytics` | → | Get teamwork analytics |

### Project Agent — Council

| Channel | Dir | Description |
|---------|-----|-------------|
| `project:council-generate-plan` | → | Council generates a plan |
| `project:council-approve-proposal` | → | Approve council proposal |
| `project:council-reject-proposal` | → | Reject council proposal |
| `project:council-get-proposal` | → | Get current proposal |
| `project:council-start-execution` | → | Start council execution |
| `project:council-pause-execution` | → | Pause council execution |
| `project:council-resume-execution` | → | Resume council execution |
| `project:council-send-message` | → | Send message to council |
| `project:council-get-messages` | → | Get council messages |
| `project:council-get-timeline` | → | Get council timeline |
| `project:council-list-available-workers` | → | List available workers |
| `project:council-register-worker-availability` | → | Register worker availability |
| `project:council-score-helper-candidates` | → | Score helper candidates |
| `project:council-generate-helper-handoff` | → | Generate helper handoff |
| `project:council-review-helper-merge` | → | Review helper merge result |
| `project:council-handle-quota-interrupt` | → | Handle quota interrupt |
| `project:council-cleanup-expired-messages` | → | Clean up expired messages |

### Project Agent — Debate & Voting

| Channel | Dir | Description |
|---------|-----|-------------|
| `project:create-debate-session` | → | Create debate session |
| `project:submit-debate-argument` | → | Submit argument in debate |
| `project:get-debate-session` | → | Get debate session details |
| `project:get-debate-replay` | → | Replay a debate session |
| `project:generate-debate-summary` | → | Generate debate summary |
| `project:resolve-debate-session` | → | Resolve/close a debate |
| `project:override-debate-session` | → | Override debate outcome |
| `project:list-debate-history` | → | List debate history |
| `project:create-voting-session` | → | Create a voting session |
| `project:submit-vote` | → | Submit a vote |
| `project:request-votes` | → | Request votes from agents |
| `project:get-voting-session` | → | Get voting session details |
| `project:resolve-voting` | → | Resolve a voting session |
| `project:override-voting` | → | Override voting outcome |
| `project:list-voting-sessions` | → | List voting sessions |
| `project:list-voting-templates` | → | List voting templates |
| `project:get-voting-config` | → | Get voting configuration |
| `project:update-voting-config` | → | Update voting configuration |
| `project:get-voting-analytics` | → | Get voting analytics |
| `project:build-consensus` | → | Build consensus among agents |
| `project:approve` | → | Approve an agent action |

### Prompt Templates (`prompt-templates:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `prompt-templates:getAll` | → | Get all prompt templates |
| `prompt-templates:get` | → | Get template by ID |
| `prompt-templates:create` | → | Create a prompt template |
| `prompt-templates:update` | → | Update a prompt template |
| `prompt-templates:delete` | → | Delete a prompt template |
| `prompt-templates:search` | → | Search prompt templates |
| `prompt-templates:getByCategory` | → | Get templates by category |
| `prompt-templates:getByTag` | → | Get templates by tag |
| `prompt-templates:getCategories` | → | List template categories |
| `prompt-templates:getTags` | → | List template tags |
| `prompt-templates:render` | → | Render a template with variables |

### Proxy (`proxy:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `proxy:getModels` | → | Get models from proxy |
| `proxy:getQuota` | → | Get proxy quota info |
| `proxy:getCopilotQuota` | → | Get Copilot quota |
| `proxy:getClaudeQuota` | → | Get Claude quota |
| `proxy:getCodexUsage` | → | Get Codex usage stats |
| `proxy:claudeLogin` | → | Login to Claude via proxy |
| `proxy:anthropicLogin` | → | Login to Anthropic via proxy |
| `proxy:antigravityLogin` | → | Login to Antigravity via proxy |
| `proxy:codexLogin` | → | Login to Codex via proxy |
| `proxy:saveClaudeSession` | → | Save Claude session data |
| `proxy:downloadAuthFile` | → | Download auth file from proxy |
| `proxy:deleteAuthFile` | → | Delete auth file |
| `proxy:syncAuthFiles` | → | Sync auth files |
| `proxy:get-rate-limit-config` | → | Get rate limit configuration |
| `proxy:set-rate-limit-config` | → | Set rate limit configuration |
| `proxy:get-rate-limit-metrics` | → | Get rate limit metrics |

### Proxy Embed (`proxy:embed:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `proxy:embed:start` | → | Start embedded proxy server |
| `proxy:embed:stop` | → | Stop embedded proxy server |
| `proxy:embed:status` | → | Get embedded proxy status |

### Screenshot (`screenshot:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `screenshot:capture` | → | Capture a screenshot |

### SD.cpp / Image Generation (`sd-cpp:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `sd-cpp:getStatus` | → | Get SD.cpp service status |
| `sd-cpp:edit` | → | Edit an image with SD |
| `sd-cpp:regenerate` | → | Regenerate an image |
| `sd-cpp:batchGenerate` | → | Generate images in batch |
| `sd-cpp:reinstall` | → | Reinstall SD.cpp binary |
| `sd-cpp:compare` | → | Compare generated images |
| `sd-cpp:shareComparison` | → | Share image comparison |
| `sd-cpp:exportComparison` | → | Export comparison as file |
| `sd-cpp:getHistory` | → | Get generation history |
| `sd-cpp:searchHistory` | → | Search generation history |
| `sd-cpp:exportHistory` | → | Export generation history |
| `sd-cpp:getAnalytics` | → | Get generation analytics |
| `sd-cpp:listPresets` | → | List generation presets |
| `sd-cpp:savePreset` | → | Save a generation preset |
| `sd-cpp:deletePreset` | → | Delete a generation preset |
| `sd-cpp:getPresetAnalytics` | → | Get preset analytics |
| `sd-cpp:exportPresetShare` | → | Export preset for sharing |
| `sd-cpp:importPresetShare` | → | Import a shared preset |
| `sd-cpp:schedule` | → | Schedule image generation |
| `sd-cpp:cancelSchedule` | → | Cancel scheduled generation |
| `sd-cpp:listSchedules` | → | List scheduled generations |
| `sd-cpp:getScheduleAnalytics` | → | Get schedule analytics |
| `sd-cpp:getQueueStats` | → | Get generation queue stats |
| `sd-cpp:listWorkflowTemplates` | → | List workflow templates |
| `sd-cpp:saveWorkflowTemplate` | → | Save a workflow template |
| `sd-cpp:deleteWorkflowTemplate` | → | Delete a workflow template |
| `sd-cpp:exportWorkflowTemplateShare` | → | Export workflow template |
| `sd-cpp:importWorkflowTemplateShare` | → | Import workflow template |

### Settings (`settings:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `settings:get` | → | Get all app settings |
| `settings:save` | → | Save app settings |
| `settings:health` | → | Settings service health check |

### SSH (`ssh:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `ssh:connect` | → | Connect to SSH server |
| `ssh:disconnect` | → | Disconnect from SSH server |
| `ssh:getConnections` | → | List active connections |
| `ssh:isConnected` | → | Check if connection is active |
| `ssh:getProfiles` | → | List SSH profiles |
| `ssh:saveProfile` | → | Save an SSH profile |
| `ssh:deleteProfile` | → | Delete an SSH profile |
| `ssh:execute` | → | Execute remote command |
| `ssh:shellStart` | → | Start interactive shell |
| `ssh:shellWrite` | → | Write to interactive shell |
| `ssh:listDir` | → | List remote directory |
| `ssh:readFile` | → | Read remote file |
| `ssh:writeFile` | → | Write remote file |
| `ssh:deleteDir` | → | Delete remote directory |
| `ssh:deleteFile` | → | Delete remote file |
| `ssh:mkdir` | → | Create remote directory |
| `ssh:rename` | → | Rename remote path |
| `ssh:upload` | → | Upload file to remote |
| `ssh:download` | → | Download file from remote |
| `ssh:getSystemStats` | → | Get remote system stats |
| `ssh:getInstalledPackages` | → | Get remote installed packages |
| `ssh:getLogFiles` | → | List remote log files |
| `ssh:readLogFile` | → | Read remote log file |
| `ssh:createTunnel` | → | Create SSH tunnel |
| `ssh:listTunnels` | → | List active tunnels |
| `ssh:closeTunnel` | → | Close an SSH tunnel |
| `ssh:saveTunnelPreset` | → | Save tunnel preset |
| `ssh:listTunnelPresets` | → | List tunnel presets |
| `ssh:deleteTunnelPreset` | → | Delete tunnel preset |
| `ssh:searchRemoteFiles` | → | Search files on remote |
| `ssh:getSearchHistory` | → | Get remote search history |
| `ssh:exportSearchHistory` | → | Export remote search history |
| `ssh:reconnect` | → | Reconnect to SSH server |
| `ssh:acquireConnection` | → | Acquire pooled connection |
| `ssh:releaseConnection` | → | Release pooled connection |
| `ssh:getConnectionPoolStats` | → | Get connection pool stats |
| `ssh:enqueueTransfer` | → | Enqueue file transfer |
| `ssh:getTransferQueue` | → | Get transfer queue status |
| `ssh:runTransferBatch` | → | Run batch file transfer |
| `ssh:listRemoteContainers` | → | List remote Docker containers |
| `ssh:runRemoteContainer` | → | Run remote Docker container |
| `ssh:stopRemoteContainer` | → | Stop remote Docker container |
| `ssh:saveProfileTemplate` | → | Save profile template |
| `ssh:listProfileTemplates` | → | List profile templates |
| `ssh:deleteProfileTemplate` | → | Delete profile template |
| `ssh:exportProfiles` | → | Export SSH profiles |
| `ssh:importProfiles` | → | Import SSH profiles |
| `ssh:validateProfile` | → | Validate SSH profile |
| `ssh:testProfile` | → | Test SSH profile connection |
| `ssh:startSessionRecording` | → | Start session recording |
| `ssh:stopSessionRecording` | → | Stop session recording |
| `ssh:getSessionRecording` | → | Get session recording |
| `ssh:searchSessionRecording` | → | Search in session recording |
| `ssh:exportSessionRecording` | → | Export session recording |
| `ssh:listSessionRecordings` | → | List session recordings |
| `ssh:listManagedKeys` | → | List managed SSH keys |
| `ssh:generateManagedKey` | → | Generate managed SSH key |
| `ssh:importManagedKey` | → | Import managed SSH key |
| `ssh:deleteManagedKey` | → | Delete managed SSH key |
| `ssh:rotateManagedKey` | → | Rotate managed SSH key |
| `ssh:backupManagedKey` | → | Backup managed SSH key |
| `ssh:listKnownHosts` | → | List known hosts |
| `ssh:addKnownHost` | → | Add known host |
| `ssh:removeKnownHost` | → | Remove known host |
| `ssh:health` | → | SSH service health check |

**SSH Events (main→renderer):**

| Channel | Dir | Description |
|---------|-----|-------------|
| `ssh:stdout` | ← | Remote command stdout data |
| `ssh:stderr` | ← | Remote command stderr data |
| `ssh:connected` | ← | Connection established event |
| `ssh:disconnected` | ← | Connection lost event |
| `ssh:error` | ← | SSH error event |
| `ssh:shellData` | ← | Interactive shell output |
| `ssh:uploadProgress` | ← | File upload progress |
| `ssh:downloadProgress` | ← | File download progress |

### Terminal (`terminal:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `terminal:create` | → | Create terminal session |
| `terminal:write` | → | Write to terminal |
| `terminal:resize` | → | Resize terminal |
| `terminal:kill` | → | Kill terminal session |
| `terminal:close` | → | Close terminal session |
| `terminal:readBuffer` | → | Read terminal output buffer |
| `terminal:isAvailable` | → | Check if terminal is available |
| `terminal:getShells` | → | List available shells |
| `terminal:getBackends` | → | List terminal backends |
| `terminal:getSessions` | → | List active sessions |
| `terminal:setSessionTitle` | → | Set session title |
| `terminal:getSuggestions` | → | Get command suggestions |
| `terminal:explainCommand` | → | AI-explain a command |
| `terminal:explainError` | → | AI-explain a terminal error |
| `terminal:fixError` | → | AI-fix a terminal error |
| `terminal:getCommandHistory` | → | Get command history |
| `terminal:clearCommandHistory` | → | Clear command history |
| `terminal:getDockerContainers` | → | List Docker containers |
| `terminal:getProfiles` | → | List terminal profiles |
| `terminal:getProfileTemplates` | → | Get profile templates |
| `terminal:saveProfile` | → | Save a terminal profile |
| `terminal:deleteProfile` | → | Delete a terminal profile |
| `terminal:validateProfile` | → | Validate a profile |
| `terminal:exportProfiles` | → | Export terminal profiles |
| `terminal:importProfiles` | → | Import terminal profiles |
| `terminal:exportProfileShareCode` | → | Export profile as share code |
| `terminal:importProfileShareCode` | → | Import profile from share code |
| `terminal:getRuntimeHealth` | → | Get terminal runtime health |
| `terminal:getSessionAnalytics` | → | Get session analytics |
| `terminal:exportSession` | → | Export a session |
| `terminal:importSession` | → | Import a session |
| `terminal:getSessionTemplates` | → | Get session templates |
| `terminal:saveSessionTemplate` | → | Save session template |
| `terminal:deleteSessionTemplate` | → | Delete session template |
| `terminal:createFromSessionTemplate` | → | Create session from template |
| `terminal:createSessionShareCode` | → | Create session share code |
| `terminal:importSessionShareCode` | → | Import session share code |
| `terminal:getSnapshotSessions` | → | Get snapshot sessions |
| `terminal:restoreSnapshotSession` | → | Restore snapshot session |
| `terminal:restoreAllSnapshots` | → | Restore all snapshots |
| `terminal:searchScrollback` | → | Search scrollback buffer |
| `terminal:filterScrollback` | → | Filter scrollback content |
| `terminal:exportScrollback` | → | Export scrollback buffer |
| `terminal:exportSearchResults` | → | Export search results |
| `terminal:getSearchSuggestions` | → | Get search suggestions |
| `terminal:getSearchAnalytics` | → | Get search analytics |
| `terminal:addScrollbackMarker` | → | Add scrollback marker |
| `terminal:deleteScrollbackMarker` | → | Delete scrollback marker |
| `terminal:listScrollbackMarkers` | → | List scrollback markers |

### Theme (`theme:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `theme:getAll` | → | Get all themes |
| `theme:getCurrent` | → | Get current theme |
| `theme:set` | → | Set active theme |
| `theme:getDetails` | → | Get theme details |
| `theme:getCustom` | → | Get custom themes |
| `theme:addCustom` | → | Add a custom theme |
| `theme:updateCustom` | → | Update a custom theme |
| `theme:deleteCustom` | → | Delete a custom theme |
| `theme:duplicate` | → | Duplicate a theme |
| `theme:export` | → | Export a theme |
| `theme:import` | → | Import a theme |
| `theme:getPresets` | → | Get theme presets |
| `theme:getCurrentPreset` | → | Get current preset |
| `theme:applyPreset` | → | Apply a theme preset |
| `theme:clearPreset` | → | Clear active preset |
| `theme:getFavorites` | → | Get favorite themes |
| `theme:isFavorite` | → | Check if theme is favorited |
| `theme:toggleFavorite` | → | Toggle theme favorite |
| `theme:getHistory` | → | Get theme change history |
| `theme:clearHistory` | → | Clear theme history |
| `theme:runtime:getAll` | → | Get runtime themes |
| `theme:runtime:install` | → | Install runtime theme |
| `theme:runtime:uninstall` | → | Uninstall runtime theme |
| `theme:runtime:openDirectory` | → | Open theme directory |

### Token Estimation (`token-estimation:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `token-estimation:estimateString` | → | Estimate tokens for a string |
| `token-estimation:estimateMessage` | → | Estimate tokens for a message |
| `token-estimation:estimateMessages` | → | Estimate tokens for messages array |
| `token-estimation:getContextWindowSize` | → | Get model context window size |
| `token-estimation:fitsInContextWindow` | → | Check if content fits in context |

### Tools (`tools:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `tools:getDefinitions` | → | Get tool definitions |
| `tools:execute` | → | Execute a tool |
| `tools:kill` | → | Kill a running tool |

### Usage (`usage:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `usage:recordUsage` | → | Record a usage event |
| `usage:getUsageCount` | → | Get usage count |
| `usage:checkLimit` | → | Check if usage limit reached |

### User Behavior (`user-behavior:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `user-behavior:get-recent-activity` | → | Get recent user activity |
| `user-behavior:get-frequent-features` | → | Get frequently used features |
| `user-behavior:get-model-recommendations` | → | Get personalized model recommendations |

### Window & Shell (`window:*`, `shell:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `window:minimize` | → | Minimize application window |
| `window:maximize` | → | Maximize/restore window |
| `window:close` | → | Close application window |
| `window:resize` | → | Resize window |
| `window:toggle-fullscreen` | → | Toggle fullscreen mode |
| `window:toggle-compact` | → | Toggle compact mode |
| `window:captureCookies` | → | Capture cookies from webview |
| `window:openDetachedTerminal` | → | Open detached terminal window |
| `shell:openExternal` | → | Open URL in external browser |
| `shell:openTerminal` | → | Open system terminal |
| `shell:runCommand` | → | Run a shell command |

### Workflow (`workflow:*`)

| Channel | Dir | Description |
|---------|-----|-------------|
| `workflow:getAll` | → | Get all workflows |
| `workflow:get` | → | Get workflow by ID |
| `workflow:create` | → | Create a workflow |
| `workflow:update` | → | Update a workflow |
| `workflow:delete` | → | Delete a workflow |
| `workflow:execute` | → | Execute a workflow |
| `workflow:triggerManual` | → | Manually trigger a workflow |

---

### Channel Count Summary

| Category | Count |
|----------|-------|
| Advanced Memory | 35 |
| Agent | 10 |
| Audit | 2 |
| Auth & Security | 23 |
| Backup | 12 |
| Brain | 8 |
| Chat | 5 |
| Clipboard | 2 |
| Code Intelligence | 18 |
| Code Sandbox | 3 |
| Collaboration | 7 |
| Context Window | 4 |
| Contract | 1 |
| Database | 34 |
| Dialog | 2 |
| Diff | 8 |
| Export | 2 |
| Files | 15 |
| Gallery | 5 |
| Git (core) | 21 |
| Git (advanced) | 33 |
| Health | 4 |
| HuggingFace | 31 |
| Ideas | 28 |
| Key Rotation | 4 |
| Lazy Services | 1 |
| Llama.cpp | 11 |
| Logging | 5 |
| LLM Multi-Model | 1 |
| Marketplace | 4 |
| MCP | 9 |
| MCP Marketplace | 24 |
| Memory | 6 |
| Metrics | 3 |
| Migration | 1 |
| Model Downloader | 4 |
| Model Registry | 3 |
| Ollama | 25 |
| Orchestrator | 4 |
| Performance | 4 |
| Process | 6 |
| Project (core) | 14 |
| Project Agent | 79 |
| Prompt Templates | 11 |
| Proxy | 16 |
| Proxy Embed | 3 |
| Screenshot | 1 |
| SD.cpp | 27 |
| Settings | 3 |
| SSH | 65 |
| Terminal | 44 |
| Theme | 24 |
| Token Estimation | 5 |
| Tools | 3 |
| Usage | 3 |
| User Behavior | 3 |
| Window & Shell | 10 |
| Workflow | 7 |
| **Total** | **~700+** |

---

## References

- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/api/ipc-main)
- [CONFIG.md](CONFIG.md) - Configuration guide
- [API.md](API.md) - REST API reference
- [MCP.md](MCP.md) - MCP server documentation
- [IPC_CHANNELS.md](IPC_CHANNELS.md) - Auto-generated full channel inventory

