# MCP Server Documentation

Model Context Protocol (MCP) servers provide tools and resources that AI agents can use. This document describes all available MCP servers and their contracts.

## Overview

MCP servers are modular components that expose capabilities through standardized tool definitions. Each server implements a specific domain (filesystem, git, web, etc.).

### Server Architecture

```
src/main/mcp/servers/
├── core.server.ts         # Core utilities
├── filesystem.server.ts   # File operations
├── git.server.ts          # Git operations
├── web.server.ts          # HTTP requests
├── search.server.ts       # Web search
├── data.server.ts         # Data processing
├── dev.server.ts          # Development tools
├── intelligence.server.ts # AI analysis
├── internet.server.ts     # Network utilities
├── network.server.ts      # SSH/networking
├── project.server.ts      # Project management
├── security.server.ts     # Security scanning
└── utility.server.ts      # Miscellaneous utilities
```

---

## Core Server

**Purpose**: Essential utilities and system operations

### Tools

#### `execute_command`
Execute shell commands with proper escaping.

**Parameters**:
```typescript
{
  command: string;      // Shell command to execute
  args?: string[];      // Command arguments (optional)
  cwd?: string;         // Working directory (optional)
}
```

**Returns**:
```typescript
{
  stdout: string;       // Standard output
  stderr: string;       // Standard error
  exitCode: number;     // Process exit code
}
```

**Security**: Uses `quoteShellArg()` for argument escaping

---

## Filesystem Server

**Purpose**: File and directory operations

### Tools

#### `read_file`
Read file contents.

**Parameters**:
```typescript
{
  path: string;         // Absolute file path
  encoding?: string;    // File encoding (default: utf-8)
}
```

**Returns**: File contents as string

**Validation**: 
- Path must be within allowed roots
- Uses `path.resolve()` for traversal protection

#### `write_file`
Write contents to file.

**Parameters**:
```typescript
{
  path: string;         // Absolute file path
  content: string;      // File contents
  encoding?: string;    // Encoding (default: utf-8)
}
```

**Returns**: Success confirmation

#### `list_directory`
List directory contents.

**Parameters**:
```typescript
{
  path: string;         // Directory path
  recursive?: boolean;  // Recursive listing (default: false)
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
  }>;
}
```

#### `create_directory`
Create directory (with parents).

**Parameters**:
```typescript
{
  path: string;         // Directory path
}
```

#### `delete_file`
Delete file or directory.

**Parameters**:
```typescript
{
  path: string;         // File/directory path
  recursive?: boolean;  // Recursive delete (default: false)
}
```

**Security Notes**:
- All paths validated against allowed roots
- Path traversal protection via `path.normalize()`
- Deletion requires confirmation for directories

---

## Git Server

**Purpose**: Git version control operations

### Tools

#### `git_status`
Get repository status.

**Parameters**:
```typescript
{
  repoPath: string;     // Repository root path
}
```

**Returns**:
```typescript
{
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  staged: string[];
  untracked: string[];
}
```

#### `git_commit`
Create a commit.

**Parameters**:
```typescript
{
  repoPath: string;     // Repository path
  message: string;      // Commit message
  files?: string[];     // Files to stage (optional, all if empty)
}
```

#### `git_push`
Push commits to remote.

**Parameters**:
```typescript
{
  repoPath: string;     // Repository path
  remote?: string;      // Remote name (default: origin)
  branch?: string;      // Branch name (default: current)
}
```

#### `git_pull`
Pull changes from remote.

**Parameters**:
```typescript
{
  repoPath: string;
  remote?: string;
  branch?: string;
}
```

#### `git_diff`
Show file differences.

**Parameters**:
```typescript
{
  repoPath: string;
  file?: string;        // Specific file (optional)
  staged?: boolean;     // Show staged changes (default: false)
}
```

---

## Web Server

**Purpose**: HTTP requests and web scraping

### Tools

#### `fetch_url`
Fetch URL content.

**Parameters**:
```typescript
{
  url: string;          // Target URL
  method?: string;      // HTTP method (default: GET)
  headers?: Record<string, string>;
  body?: string;        // Request body
  timeout?: number;     // Timeout in ms (default: 30000)
}
```

**Returns**:
```typescript
{
  status: number;
  headers: Record<string, string>;
  body: string;
}
```

**Limitations**:
- Max response size: 10MB
- Timeout: 30 seconds default
- No binary content support

#### `scrape_page`
Extract text content from HTML.

**Parameters**:
```typescript
{
  url: string;          // Page URL
  selector?: string;    // CSS selector (optional)
}
```

**Returns**: Extracted text content

---

## Search Server

**Purpose**: Web search using Tavily API

### Tools

#### `web_search`
Search the web.

**Parameters**:
```typescript
{
  query: string;        // Search query
  maxResults?: number;  // Max results (default: 5)
  includeImages?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
}
```

**Returns**:
```typescript
{
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
  }>;
}
```

**Requirements**: `TAVILY_API_KEY` environment variable

---

## Data Server

**Purpose**: Data processing and transformation

### Tools

#### `parse_json`
Parse and validate JSON.

**Parameters**:
```typescript
{
  data: string;         // JSON string
  schema?: object;      // JSON Schema (optional)
}
```

**Returns**: Parsed object

#### `transform_data`
Transform data using JMESPath.

**Parameters**:
```typescript
{
  data: object;         // Input data
  query: string;        // JMESPath query
}
```

**Returns**: Transformed data

#### `csv_to_json`
Convert CSV to JSON.

**Parameters**:
```typescript
{
  csv: string;          // CSV content
  delimiter?: string;   // Column delimiter (default: ,)
  hasHeader?: boolean;  // First row is header (default: true)
}
```

---

## Development Server

**Purpose**: Development environment tools

### Tools

#### `npm_install`
Install npm dependencies.

**Parameters**:
```typescript
{
  projectPath: string;
  packages?: string[];  // Specific packages (optional)
  dev?: boolean;        // Install as devDependencies
}
```

#### `npm_run_script`
Run package.json script.

**Parameters**:
```typescript
{
  projectPath: string;
  script: string;       // Script name
}
```

#### `lint_code`
Run linter on code.

**Parameters**:
```typescript
{
  projectPath: string;
  files?: string[];     // Specific files (optional)
  fix?: boolean;        // Auto-fix issues
}
```

---

## Intelligence Server

**Purpose**: AI-powered code analysis

### Tools

#### `analyze_code`
Analyze code structure and patterns.

**Parameters**:
```typescript
{
  code: string;         // Source code
  language: string;     // Programming language
}
```

**Returns**:
```typescript
{
  complexity: number;
  issues: Array<{
    type: string;
    severity: string;
    message: string;
    line: number;
  }>;
}
```

#### `suggest_improvements`
Get code improvement suggestions.

**Parameters**:
```typescript
{
  code: string;
  language: string;
  context?: string;
}
```

---

## Network Server

**Purpose**: SSH and networking tools

### Tools

#### `ssh_execute`
Execute command over SSH.

**Parameters**:
```typescript
{
  host: string;
  port?: number;        // Default: 22
  username: string;
  password?: string;
  privateKey?: string;
  command: string;
}
```

**Security**: Credentials encrypted in transit

#### `check_port`
Check if port is open.

**Parameters**:
```typescript
{
  host: string;
  port: number;
  timeout?: number;     // Default: 3000ms
}
```

---

## Project Server

**Purpose**: Project and workspace management

### Tools

#### `create_project`
Create new project.

**Parameters**:
```typescript
{
  name: string;
  path: string;
  template?: string;
}
```

#### `analyze_project`
Analyze project structure.

**Parameters**:
```typescript
{
  projectPath: string;
}
```

**Returns**:
```typescript
{
  type: string;         // Project type (node, python, etc.)
  dependencies: string[];
  structure: object;
}
```

---

## Security Server

**Purpose**: Security scanning and analysis

### Tools

#### `scan_vulnerabilities`
Scan for security vulnerabilities.

**Parameters**:
```typescript
{
  projectPath: string;
  scanDependencies?: boolean;
  scanCode?: boolean;
}
```

**Returns**:
```typescript
{
  vulnerabilities: Array<{
    severity: string;
    type: string;
    description: string;
    file?: string;
    line?: number;
  }>;
}
```

#### `check_secrets`
Scan for exposed secrets.

**Parameters**:
```typescript
{
  content: string;
}
```

---

## Utility Server

**Purpose**: Miscellaneous helper tools

### Tools

#### `generate_uuid`
Generate UUID.

**Returns**: UUID string

#### `hash_data`
Hash data using algorithm.

**Parameters**:
```typescript
{
  data: string;
  algorithm?: string;   // Default: sha256
}
```

#### `encode_base64`
Base64 encode data.

**Parameters**:
```typescript
{
  data: string;
}
```

#### `decode_base64`
Base64 decode data.

**Parameters**:
```typescript
{
  data: string;
}
```

---

## Error Handling

All MCP tools follow consistent error handling:

### Error Format
```typescript
{
  error: string;        // Error message
  code?: string;        // Error code
  details?: object;     // Additional context
}
```

### Common Error Codes
- `INVALID_PARAMS` - Invalid tool parameters
- `PERMISSION_DENIED` - Access denied
- `NOT_FOUND` - Resource not found
- `TIMEOUT` - Operation timeout
- `EXECUTION_ERROR` - Execution failed

---

## Security & Validation

### Input Validation
- All parameters validated against schema
- Type checking enforced
- Path traversal protection
- Command injection prevention

### Rate Limiting
- Configurable per-tool rate limits
- Exponential backoff on errors
- Circuit breaker for failing services

### Allowed Roots
File operations restricted to:
- Project directories
- User data directory (`~/.tandem/`)
- Temporary directory (for specific operations)

### Credential Handling
- Credentials encrypted at rest
- No credentials in logs
- Secure deletion on cleanup

---

## Usage Examples

### JavaScript

```javascript
// Execute MCP tool
const result = await window.electron.mcp.execute('web_search', {
  query: 'latest AI news',
  maxResults: 5
});

console.log(result.results);
```

### TypeScript (Main Process)

```typescript
import { McpService } from '@main/services/mcp/mcp.service';

const mcp = new McpService(dependencies);
await mcp.initialize();

const result = await mcp.executeTool('git_status', {
  repoPath: '/path/to/repo'
});
```

---

## Adding New Tools

### Tool Definition

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
  };
}
```

### Implementation

```typescript
export function createMyServer(): ToolDefinition[] {
  return [
    {
      name: 'my_tool',
      description: 'Tool description',
      parameters: {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: 'Parameter description'
          }
        }
      },
      execute: async (params) => {
        // Implementation
        return result;
      }
    }
  ];
}
```

---

## Troubleshooting

### Tool Execution Failures

1. Check parameter validation
2. Verify file/path permissions
3. Review MCP server logs
4. Check environment variables

### Performance Issues

- Enable caching for repeated operations
- Use batch operations when available
- Monitor rate limits

### Security Concerns

- Review allowed roots configuration
- Audit tool permissions
- Monitor execution logs
- Rotate credentials regularly

---

## References

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [CONFIG.md](CONFIG.md) - Configuration guide
- [API.md](API.md) - REST API documentation
