# AI Agent Rules & Guidelines for Tengra

> **STOP!** Read the [MASTER COMMANDMENTS](../.agent/rules/MASTER_COMMANDMENTS.md) first.

> **CRITICAL**: The [MASTER COMMANDMENTS](../.agent/rules/MASTER_COMMANDMENTS.md) are your core logic. You MUST also follow the **Boy Scout Rule**: Every edit MUST fix at least one existing lint warning or type issue in the file. NO EXCEPTIONS. FAILURE TO DO SO RESULTS IN IMMEDIATE TERMINATION.

## 🚨 CRITICAL SUMMARY (TL;DR)
> **DANGER**: Failure to strictly follow these rules will result in immediate disqualification and task termination.

1.  **NO `any` / `unknown`**: TypeScript errors are critical failures. NO EXCEPTIONS.
2.  **NO `console.log`**: Use `appLogger`. All stdout must be clean.
3.  **NO PLACEHOLDERS**: Write final, production-ready code with complete logic.
4.  **BUILD & LINT**: Never deliver code that fails `npm run build`, `npm run lint`, or `npm run type-check`.
5.  **NASA RULES**: Max 150 lines per function. Fixed loop bounds mandatory.
6.  **BOY SCOUT RULE**: Mandatory. Every edit MUST fix at least one existing lint/type issue. 
7.  **FRIDAY FORBIDDEN**: NO COMMITS OR MAJOR DEPLOYMENTS ON FRIDAYS. Fridays are for testing, documentation, and review ONLY.
8.  **TEST PASS MANDATORY**: Never commit code that fails any test. `npm run test` must pass 100%.
9. **READ RULES FIRST**: You MUST read rule files (`MASTER_COMMANDMENTS.md`, `AI_RULES.md`) using `view_file` at the start of every session before coding.


---


## Table of Contents

1. [Project Overview](#1-project-overview)
2. [NASA's 10 Rules for Safety-Critical Code](#2-nasas-10-rules-for-safety-critical-code)
3. [File Structure Rules](#3-file-structure-rules)
4. [Service Architecture](#4-service-architecture)
5. [Logging Rules](#5-logging-rules)
6. [Error Handling](#6-error-handling)
7. [Scheduled Tasks](#7-scheduled-tasks)
8. [Authentication & Tokens](#8-authentication--tokens)
9. [Testing Rules](#9-testing-rules)
10. [Code Style & Conventions](#10-code-style--conventions)
11. [Forbidden Actions](#11-forbidden-actions)
12. [Checklist Before Committing](#12-checklist-before-committing)
13. [Performance Optimization Rules](#13-performance-optimization-rules)

---

## 1. Project Overview

### What is OrTengrabit?

Tengra is a **desktop AI assistant application** built with Electron, React, and TypeScript. It provides:

- **Multi-LLM Support**: Connects to multiple AI providers (OpenAI, Anthropic, Google, GitHub Copilot, Ollama)
- **Local AI**:
  - Ollama: Core local LLM provider.
  - Llama.cpp: High-performance C++ inference.
  - SD-CPP (Stable Diffusion C++): Local image generation.
    - **Fallback**: Automatic fallback to Pollinations if SD-CPP fails.
    - **Readiness**: Non-blocking readiness check on startup if enabled.
- **Project Management**: Analyzes and manages code projects
- **Agent System**: Multi-agent collaboration for complex tasks
- **Secure Token Management**: Encrypted storage with automatic refresh

### Technology Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Electron 33+ |
| Frontend | React 18, TypeScript, Tailwind CSS |
| Backend | Node.js (Main Process) |
| Database | PGlite (PostgreSQL in-process) |
| Local AI | Ollama, Llama.cpp |
| IPC | Electron IPC with typed bridge |

### Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    RENDERER PROCESS                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   React UI  │  │   Contexts  │  │    Hooks    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         └────────────────┼────────────────┘                │
│                          │                                  │
│                    ┌─────▼─────┐                           │
│                    │ IPC Bridge│                           │
└────────────────────┴─────┬─────┴───────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                    ┌─────▼─────┐                            │
│                    │IPC Handlers│          MAIN PROCESS     │
│                    └─────┬─────┘                            │
│         ┌────────────────┼────────────────┐                 │
│    ┌────▼────┐     ┌─────▼─────┐    ┌─────▼─────┐         │
│    │Services │     │ Database  │    │  Proxy    │         │
│    └────┬────┘     └───────────┘    └───────────┘         │
│         │                                                   │
│    ┌────▼────────────────────────────────────┐             │
│    │ LLM │ Data │ Project │ Security │ System │            │
│    └─────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. NASA's 10 Rules for Safety-Critical Code

These rules, derived from NASA/JPL's "Power of 10" guidelines, are adapted for this project:

### Rule 1: Simple Control Flow
- Avoid `goto`, `setjmp`, `longjmp`, and direct/indirect recursion.
- Keep control flow simple and verifiable.

### Rule 2: Fixed Loop Bounds
- All loops must have a fixed upper bound that can be statically verified.
- Prevent runaway code with explicit iteration limits.

```typescript
// Correct
for (let i = 0; i < MAX_ITERATIONS && !done; i++) {
    // work
}

// Incorrect
while (true) {
    // potentially infinite
}
```

### Rule 3: No Dynamic Memory After Init
- Avoid dynamic memory allocation after initialization phase.
- Pre-allocate buffers and pools during startup.

### Rule 4: Short Functions
- No function should be longer than 60 lines (excluding comments).
- Break complex logic into smaller, testable units.

### Rule 5: Low Assertion Density
- Include at least 2 assertions per function on average.
- Use TypeScript's type system as compile-time assertions.

```typescript
function processMessage(msg: Message): void {
    if (!msg) throw new Error('Message is required');
    if (!msg.content) throw new Error('Message content is required');
    // process...
}
```

### Rule 6: Minimal Variable Scope
- Declare variables at the smallest possible scope.
- Prefer `const` over `let`, never use `var`.

### Rule 7: Check Return Values
- Every function call with a return value must be checked.
- Handle all Promise rejections.

```typescript
// Correct
const result = await service.doSomething();
if (!result.success) {
    throw new Error(result.error);
}

// Incorrect
await service.doSomething(); // Ignored return
```

### Rule 8: Limited Preprocessor Use
- In TypeScript: Avoid complex generics and type gymnastics.
- Keep type definitions simple and readable.

### Rule 9: Restrict Pointer Use
- In TypeScript: Avoid `any` and `unknown` types completely.
- Use explicit interfaces or generics with constraints.
- Use strict null checks (`strictNullChecks: true`).

### Rule 10: Compile with All Warnings
- All code must pass `tsc --noEmit` without errors.
- ESLint must pass with zero warnings.
- Never use `// @ts-ignore` or `// eslint-disable`.
- **Boy Scout Rule**: Every time you edit a file, you MUST fix at least one existing lint warning or type issue in that file.

---

## 3. File Structure Rules

### 3.1 Directory Organization

```
tengra/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── services/         # Backend services (by domain)
│   │   │   ├── llm/          # AI model services
│   │   │   ├── data/         # Data persistence
│   │   │   ├── project/      # Project management
│   │   │   ├── security/     # Auth, encryption
│   │   │   ├── system/       # System utilities
│   │   │   ├── analysis/     # Metrics, telemetry
│   │   │   ├── ui/           # Notifications, themes
│   │   │   └── proxy/        # Proxy management
│   │   ├── ipc/              # IPC handlers
│   │   ├── startup/          # App initialization
│   │   ├── logging/          # Logger infrastructure
│   │   └── utils/            # Utility functions
│   ├── renderer/             # React frontend
│   │   ├── features/         # Feature modules
│   │   ├── components/       # Reusable components
│   │   ├── contexts/         # React contexts
│   │   ├── hooks/            # Custom hooks
│   │   └── styles/           # Global styles
│   ├── shared/               # Shared code
│   │   ├── types/            # TypeScript types
│   │   └── utils/            # Shared utilities
│   ├── scripts/              # Build scripts
│   └── tests/                # All tests
│       ├── unit/             # Unit tests
│       ├── integration/      # Integration tests
│       └── e2e/              # End-to-end tests
├── docs/                     # Documentation
├── logs/                     # Log files (AI writable)
├── vendor/                   # Third-party code
└── dist/                     # Build output
```

### 3.2 Service Placement Guide

| Domain | Folder | Examples |
|--------|--------|----------|
| AI/LLM | `services/llm/` | OllamaService, CopilotService, ModelRegistryService |
| Data | `services/data/` | DatabaseService, DataService, ChatEventService |
| Project | `services/project/` | ProjectService, GitService, DockerService |
| Security | `services/security/` | TokenService, KeyRotationService, RateLimitService |
| System | `services/system/` | CommandService, SystemService |
| Analysis | `services/analysis/` | TelemetryService, PerformanceService |
| UI | `services/ui/` | NotificationService, ClipboardService |
| Proxy | `services/proxy/` | ProxyService, QuotaService |

### 3.3 File Naming Conventions

```
Correct naming:
my-service.service.ts
user-profile.component.tsx
use-chat-manager.hook.ts
settings.types.ts
error.util.ts

Incorrect naming:
myService.ts          # Missing suffix
UserProfileComp.tsx   # Wrong suffix
usechatmanager.ts     # Missing suffix, bad casing
```

---

## 4. Service Architecture

### 4.1 Service Template

Every service MUST follow this pattern:

```typescript
import { BaseService } from '@main/services/base.service'
import { appLogger } from '@main/logging/logger'
import { getErrorMessage } from '@shared/utils/error.util'

export class MyService extends BaseService {
    constructor(
        private dependency1: Dependency1,
        private dependency2: Dependency2
    ) {
        super('MyService');
    }

    async initialize(): Promise<void> {
        appLogger.info('MyService', 'Initializing...');
        // Initialization logic
    }

    async someMethod(): Promise<Result> {
        try {
            // Business logic
            return { success: true, data: result };
        } catch (error) {
            appLogger.error('MyService', 'someMethod failed', error as Error);
            throw error;
        }
    }

    async dispose(): Promise<void> {
        appLogger.info('MyService', 'Disposing...');
        // Cleanup logic
    }
}
```

### 4.2 Service Registration

Services MUST be registered in `src/main/startup/services.ts`:

```typescript
container.register(
    'myService',
    (dep1, dep2) => new MyService(
        dep1 as Dependency1,
        dep2 as Dependency2
    ),
    ['dependency1', 'dependency2']
);
```

### 4.3 Dependency Injection Rules

1. Services are singletons managed by the DI container
2. Circular dependencies are FORBIDDEN
3. Dependencies must be explicitly declared
4. Use interfaces for loose coupling

---

## 5. Logging Rules

### 5.1 Mandatory Rules

1. **Log files MUST be placed in `logs/` directory only**
2. **Files WITHOUT extensions are FORBIDDEN**
3. Valid log extensions: `.log`, `.txt`, `.json`
4. Log file format: `{service}_{date}.log`
5. **Debugging Logs**: When an AI/agent/LLM creates a log file for debugging (format: .txt, .json, or .log), it MUST be created in the `logs/` folder at the project root. This folder is gitignored.

### 5.2 Valid Log File Examples

```
Correct:
logs/token-refresh_2026-01-14.log
logs/job-scheduler_2026-01-14.log
logs/error_2026-01-14.json

Incorrect:
logs/output              # No extension
query                    # Root directory, no extension
debug                    # No extension
src/logs/output.log      # Wrong location
```

### 5.3 Logger Usage

```typescript
import { appLogger } from '../logging/logger';

// Correct usage
appLogger.info('ServiceName', 'Operation completed successfully');
appLogger.warn('ServiceName', 'Resource running low', { remaining: 10 });
appLogger.error('ServiceName', 'Operation failed', error as Error);
appLogger.debug('ServiceName', 'Debug info', { data: someData });

// Never use
console.log('Something happened');  // Use appLogger instead
console.error('Error occurred');    // Use appLogger instead
```

### 5.4 Log Levels

| Level | Usage |
|-------|-------|
| `error` | Unrecoverable errors, exceptions |
| `warn` | Recoverable issues, deprecations |
| `info` | Important events, state changes |
| `debug` | Development debugging only |

---

## 6. Error Handling

### 6.1 Error Handling Pattern

```typescript
async function riskyOperation(): Promise<Result> {
    try {
        const data = await externalCall();
        
        if (!data) {
            throw new Error('No data received');
        }
        
        return { success: true, data };
    } catch (error) {
        appLogger.error('ServiceName', 'riskyOperation failed', error as Error);
        
        // Re-throw with context for caller
        throw new AppError('Failed to complete operation', { 
            cause: error,
            context: { operationId: id }
        });
    }
}
```

### 6.2 Error Categories

```typescript
// Application errors (expected, handleable)
class AppError extends Error {
    constructor(
        message: string,
        public readonly context?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'AppError';
    }
}

// Validation errors
class ValidationError extends AppError {
    constructor(field: string, reason: string) {
        super(`Validation failed for ${field}: ${reason}`);
        this.name = 'ValidationError';
    }
}

// Network errors
class NetworkError extends AppError {
    constructor(
        message: string,
        public readonly statusCode?: number
    ) {
        super(message);
        this.name = 'NetworkError';
    }
}
```

// Incorrect patterns

// Silent catch (swallowing errors)
try {
    await operation();
} catch (e) {
    // Empty catch block
}

// Logging without re-throwing when needed
try {
    await criticalOperation();
} catch (e) {
    console.error(e);
    // Execution continues as if nothing happened
}

// Using any for error
catch (error: any) {
    error.someProperty; // Unsafe
}
```

---

## 7. Scheduled Tasks

### 7.1 JobSchedulerService Usage

For recurring tasks, ALWAYS use `JobSchedulerService`:

```typescript
// In service constructor or init
this.jobScheduler.registerRecurringJob(
    'unique-job-id',
    async () => {
        // Task implementation
        await this.performTask();
    },
    () => {
        // Interval getter (can read from settings)
        const settings = this.settingsService.getSettings();
        return settings.ai?.myInterval || 60 * 60 * 1000; // Default 1 hour
    }
);
```

### 7.2 Job State Persistence

Jobs are persisted to `userData/data/config/jobs.json`:

```json
{
  "model-registry-update": { "lastRun": 1705251600000 },
  "token-refresh-oauth": { "lastRun": 1705252200000 }
}
```

This ensures jobs resume at correct times after app restart.

### 7.3 Configurable Intervals

User-configurable intervals are defined in `settings.ai`:

```typescript
// src/shared/types/settings.ts
ai?: {
    modelUpdateInterval?: number;    // ms, default: 3600000 (1 hour)
    tokenRefreshInterval?: number;   // ms, default: 300000 (5 min)
    copilotRefreshInterval?: number; // ms, default: 900000 (15 min)
}
```

---

### 8.2 Provider Authentication

| Provider | Auth Type | Refresh Mechanism |
|----------|-----------|-------------------|
| Google/Antigravity | OAuth 2.0 | Refresh token |
| Codex (OpenAI) | OAuth | Refresh token |
| Claude | Session Cookie | Electron capture |
| Copilot | GitHub OAuth | Session token exchange |
| Ollama | None | Local |

### 8.3 Claude Special Case

Claude does NOT use traditional OAuth. Instead:

1. User logs in via browser at claude.ai
2. Electron captures `sessionKey` cookie
3. Session key is validated periodically
4. When expired, user must re-authenticate via browser

```typescript
// Capturing Claude session from Electron
const cookies = await session.defaultSession.cookies.get({
    url: 'https://claude.ai',
    name: 'sessionKey'
});
```

### 8.4 Security Rules

1. NEVER log tokens or secrets
2. Always use `SecurityService.encryptSync()` for storage
3. Validate tokens before use
4. Handle expired tokens gracefully

---

## 9. Testing Rules

### 9.1 Test Location

All tests MUST be in `src/tests/`:

```
src/tests/
├── unit/               # Unit tests (isolated)
├── integration/        # Integration tests (multiple units)
├── e2e/                # End-to-end tests (full app)
└── fixtures/           # Test data and mocks
```

### 9.2 Test File Naming

```
{feature}.test.ts       # Unit tests
{feature}.spec.ts       # Integration/E2E tests
{feature}.mock.ts       # Mock implementations
```

### 9.3 Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ServiceName', () => {
    let service: MyService;
    let mockDependency: MockType;

    beforeEach(() => {
        mockDependency = createMock();
        service = new MyService(mockDependency);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('methodName', () => {
        it('should do X when Y', async () => {
            // Arrange
            const input = { ... };
            
            // Act
            const result = await service.methodName(input);
            
            // Assert
            expect(result).toEqual(expected);
        });

        it('should throw when Z', async () => {
            await expect(service.methodName(badInput))
                .rejects.toThrow('Expected error');
        });
    });
});
```

### 9.4 Coverage Requirements

- Statements: 60% minimum
- Branches: 50% minimum
- Functions: 60% minimum
- Lines: 60% minimum

---

## 10. Code Style & Conventions

### 10.1 TypeScript Rules

```typescript
// Use strict types
function processUser(user: User): ProcessedUser { ... }

// Never use any
function processData(data: any): any { ... }

// Use const assertions
const STATUS = {
    PENDING: 'pending',
    COMPLETE: 'complete'
} as const;

// Prefer interfaces for objects
interface UserData {
    id: string;
    name: string;
}

// Use type for unions/primitives
type Status = 'pending' | 'complete' | 'failed';

### 10.6 Linting Priority

**CRITICAL**: Agents MUST check [LINT_ISSUES.md](./LINT_ISSUES.md) before starting work. Fixing the categorized issues in that file is currently the top priority for codebase maintenance.
```

### 10.2 Async/Await Rules

```typescript
// Always await promises
const result = await asyncOperation();

// Handle promise arrays properly
const results = await Promise.all(promises);

// Don't ignore promises
asyncOperation(); // Missing await

// Use try-catch for async
try {
    await riskyAsync();
} catch (error) {
    handleError(error as Error);
}
```

### 10.3 Import Rules - Use Path Aliases

**ALWAYS use path aliases instead of relative paths (`../..`)**

Available aliases (defined in `tsconfig.json` and `vite.config.ts`):

| Alias | Maps To | Usage |
|-------|---------|-------|
| `@main/*` | `src/main/*` | Backend services, IPC, utils |
| `@renderer/*` | `src/renderer/*` | React components, hooks |
| `@shared/*` | `src/shared/*` | Shared types, utilities |
| `@/*` | `src/renderer/*` | Shorthand for renderer |

```typescript
// CORRECT - Use path aliases
import { DataService } from '@main/services/data/data.service'
import { appLogger } from '@main/logging/logger'
import { JsonObject } from '@shared/types/common'
import { getErrorMessage } from '@shared/utils/error.util'
import { useChat } from '@/hooks/useChat'

// WRONG - Avoid relative paths
import { DataService } from '../../../services/data/data.service'
import { JsonObject } from '../../../../shared/types/common'
```

### 10.4 Import Order

```typescript
// 1. Node.js built-ins
import * as fs from 'fs'
import * as path from 'path'

// 2. External packages
import { app } from 'electron'
import axios from 'axios'

// 3. Internal path alias imports (preferred)
import { AppError } from '@shared/errors'
import { DataService } from '@main/services/data/data.service'
import { appLogger } from '@main/logging/logger'

// 4. Same-directory relative imports (only when necessary)
import { localHelper } from './helper'
```

### 10.5 Commit Message Format

```
type(scope): description

feat(token-service): add configurable refresh intervals
fix(job-scheduler): persist job state across restarts
docs(ai-rules): add comprehensive guidelines
refactor(services): reorganize by domain
test(database): add unit tests for migrations
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`

---

## 11. Forbidden Actions

### NEVER DO:

1. Do not create files without extensions
2. Do not create files in root directory (except configs)
3. Do not use `console.log` (use `appLogger`)
4. Do not use `any` and `unknown` type
5. Do not use `// @ts-ignore` or `// eslint-disable`
6. Do not swallow errors silently
7. Do not log tokens or secrets
8. Do not create circular dependencies
9. Do not use `var` keyword
10. Do not leave TODO comments in production code
11. Do not commit commented-out code
12. Do not use synchronous file operations in main thread
13. Do not create memory leaks (event listeners without cleanup)
14. Do not use deprecated APIs

---

## 11a. Forbidden Tools (User Configurable)

When instructions are sent to AI, a list of forbidden tools will be included.
These tools MUST NOT be used under any circumstances.

### Default Forbidden Tools:
- `rm -rf /` or equivalent destructive commands
- Format/partition commands
- Registry editing commands
- System modification commands

### User-Configurable Forbidden Tools:
The user can disable specific tools in settings. When a tool is forbidden:
```markdown
## FORBIDDEN TOOLS
The following tools are DISABLED by the user. DO NOT USE THEM:
- web_search
- execute_command
- [user-defined list]

If a task requires a forbidden tool, inform the user and ask for alternatives.
```

---

## 11b. Forbidden Paths (Protected Directories)

Certain directories are OFF-LIMITS. Never read, write, or modify files in these paths:

### System Protected Paths:
```
# Windows
C:\Windows\
C:\Program Files\
C:\Program Files (x86)\
%SYSTEMROOT%\

# User Protected
%USERPROFILE%\.ssh\
%USERPROFILE%\.gnupg\
```

### Project Protected Paths:
```
# Git internals
.git/

# Dependencies (read-only reference allowed)
node_modules/

# Build outputs (don't manually edit)
dist/

# Vendor code (don't modify)
vendor/

# Secret/config files
.env
.env.local
*.key
*.pem
```

### Instruction Format:
```markdown
## FORBIDDEN PATHS
Never access or modify files in these directories:
- C:\Windows\
- .git/
- node_modules/
- vendor/
- [user-defined paths]

---

## 13. Performance Optimization Rules

To ensure a "best performance" experience, agents MUST follow these 12 rules:

1.  **Lazy Load Heavy Assets**: Mandatory use of `React.lazy()` and `Suspense` for heavy UI components (Code Editors, Mermaid, Monaco).
2.  **Memoization Strategy**: Wrap expensive data processing or non-primitive props in `useMemo` or `useCallback` to prevent unnecessary re-renders.
3.  **IPC Batching**: Consolidate multiple Renderer-to-Main requests into single payload batch requests where possible.
4.  **Virtualization**: Large data lists (expected >50 items) MUST be virtualized (e.g., using `react-virtuoso`).
5.  **Lazy Service Instantiation**: Main process services should be initialized lazily using proxies or lazy-getters to improve startup time.
6.  **Database Indexing**: All frequently filtered or sorted columns in PGlite MUST have appropriate indexes.
7.  **Resource Cleanup**: Every service MUST implement a `dispose()` method, and React effects must return cleanup functions for all event listeners and timers.
8.  **Main Process Responsiveness**: Never run synchronous I/O or heavy CPU tasks (parsing, encryption) on the main Electron thread; use worker threads.
9.  **Lookup Efficiency**: Use `Map` or `Set` instead of `Array.find()` or standard `Object` for high-frequency lookups or large collections.
10. **Import Hygiene**: Enforce tree-shakeable imports (e.g., `import { func } from 'lodash-es'`) to keep bundle sizes minimal.
11. **Render Optimization**: Use `content-visibility: auto` CSS for off-screen UI sections to reduce initial paint costs.
12. **State Granularity**: Keep React state as local as possible to prevent deep re-render trees in the application layout.

### Logging Standards
- **Use `logs/` Directory**: All debug logs, temporary dumps, or text outputs produced by scripts or agents must be written to the `logs/` directory. Do not clutter the root or source directories with debug files.
- **Use `appLogger`**: For application code, always use the structured `appLogger` instead of `console.log`.

## Enforcement
If a task requires accessing a forbidden path, stop and ask the user.
```

---

## 11c. File Editing Rules

### NEVER delete and recreate files to edit them.

**Correct Approach:**
1. Read the specific section to modify
2. Edit only the lines that need changes
3. Preserve all other content

**Wrong Approach:**
1. Read entire file
2. Delete file
3. Write new file with modifications

### Instruction Format:
```markdown
## FILE EDITING RULES
- Use targeted edits, not full file replacement
- Modify only the specific lines needed
- Never delete a file to recreate it
- Preserve existing comments and formatting
- Keep diff size minimal

Bad: Delete file → Create new file with changes
Good: Edit specific lines → Keep everything else
```

---

## 11d. Tool Transmission Rules

All AI interactions MUST include our standard tools:

### Required Tools to Send:
```typescript
const AI_TOOLS = [
    // File operations
    'read_file',
    'write_file',
    'edit_file',      // Preferred over write_file
    'list_directory',
    'search_files',
    
    // Code analysis
    'grep_search',
    'find_definition',
    'get_references',
    
    // Command execution
    'execute_command',
    'run_terminal',
    
    // MCP tools
    'mcp_filesystem',
    'mcp_git',
    'mcp_web',
    'mcp_memory',
    // ... all registered MCPs
]
```

### Dynamic Tool Filtering:
1. Start with full tool list
2. Remove user-forbidden tools
3. Add context-specific tools (e.g., project has Docker → add mcp_docker)
4. Send filtered list to AI

---

## 12. Checklist Before Committing

Before submitting any change, verify:

### Code Quality
- [ ] No TypeScript errors (`npm run build:check`)
- [ ] No ESLint warnings (`npm run lint`)
- [ ] All tests pass (`npm run test`) - 100% SUCCESS REQUIRED
- [ ] No `any` types used
- [ ] No `console.log` statements
- [ ] Not a Friday (No commits on Fridays) 


### Architecture
- [ ] Service in correct domain folder
- [ ] Service registered in `services.ts`
- [ ] Dependencies explicitly declared
- [ ] No circular dependencies

### Files
- [ ] All files have extensions
- [ ] Log files in `logs/` only
- [ ] Tests in `src/tests/`
- [ ] Scripts in `src/scripts/`

### Documentation
- [ ] Public APIs documented
- [ ] Complex logic commented
- [ ] CHANGELOG updated for features

### Security
- [ ] No secrets in code
- [ ] Tokens encrypted at rest
- [ ] Error messages don't leak info

---

## 13. AI Workflow Rules (MANDATORY)

### 13.1 Build Before Commit

Every change MUST be validated before committing:

```bash
# Required workflow order:
1. npm run build        # Build the application
2. npm run lint         # Check for lint errors
3. npm run type-check   # TypeScript validation
4. # If all pass → commit
5. git commit
6. git push
```

**NEVER commit code that:**
- Fails to build
- Has lint errors
- Has TypeScript errors
- Has failing tests

### 13.2 TODO.md Management

When completing a task from `docs/TODO.md`:

1. **Mark as completed** using `[x]` instead of `[ ]`
2. **NEVER delete** the item from the file
3. Keep the history for tracking purposes
4. **COMMIT IMMEDIATELY** after marking a TODO as completed

```markdown
# Example:
Before:
- [ ] Add token caching

After:
- [x] Add token caching  ← Mark done, DO NOT DELETE
```

### 13.3 Commit Discipline (MANDATORY)

**Every change MUST be committed following these rules:**

1. **TODO Completion Commits**: When a TODO item is finished, commit immediately.
2. **Minor Change Commits**: Every minor change (fix, improvement, refactor) must be committed separately.
3. **Pre-Commit Validation**: Before committing, ALWAYS check for errors:
   ```bash
   npm run build        # Must pass
   npm run lint         # Must pass
   npm run type-check   # Must pass
   npm run test         # Must pass (100% coverage/success required)
   ```
4. **Commit Only If Clean**: If any check fails, fix errors first. Only commit when all checks pass.
5. **Friday Forbidden**: Do NOT commit or push on Fridays. If you finish work on a Friday, wait until the user manually commits or wait until Saturday to continue.
6. **Rule Refresh**: You MUST call `view_file` on rules files at the start of every session. IGNORANCE IS NO EXCUSE.


**Commit Workflow:**
```
┌─────────────────────────────────────────────────────────────┐
│                    COMMIT WORKFLOW                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Make code change (TODO completion or minor change)       │
│ 2. Run: npm run build                                       │
│ 3. Run: npm run lint                                        │
│ 4. Run: npm run type-check                                  │
│ 5. If ANY errors → fix and repeat steps 2-4                 │
│ 6. If ALL pass → commit with conventional message           │
│ 7. Push to repository                                       │
└─────────────────────────────────────────────────────────────┘
```

### 13.4 Structured Changelog Updates

Every code change MUST be recorded in the structured changelog system.

**Canonical source (single source of truth):**
- `docs/changelog/data/changelog.entries.json` (English - ALWAYS update this first)

**Locale overrides (TRANSLATIONS ONLY ON WEEKENDS):**
- `docs/changelog/i18n/tr.overrides.json`
- `docs/changelog/i18n/ar.overrides.json`
- `docs/changelog/i18n/zh.overrides.json`
- `docs/changelog/i18n/ja.overrides.json`

**Changelog Rules:**
1. **English First**: ALWAYS write changelog entries in the English file first (`changelog.entries.json`).
2. **Translations on Weekends Only**: Locale/translation files can ONLY be updated on weekends (Saturday-Sunday).
3. **No Translation Overload**: Do not write translations for every minor change during weekdays.

**Generate + validate (mandatory):**
```bash
npm run changelog:sync
```

**Do not manually edit generated files:**
- `docs/changelog/generated/CHANGELOG.en.md`
- `docs/changelog/generated/CHANGELOG.tr.md`
- `src/renderer/data/changelog.index.json`

**Legacy note:**
- `docs/CHANGELOG.md` is archive-only and must not be used for new updates.

### 13.5 Complete Workflow Example

```
┌──────────────────────────────────────────────────────────────┐
│                    AI CHANGE WORKFLOW                        │
├──────────────────────────────────────────────────────────────┤
│ 1. Read docs/AI_RULES.md                                     │
│ 2. Read docs/TODO.md to check if task exists                 │
│ 3. Make code changes                                         │
│ 4. Run: npm run build                                        │
│ 5. Run: npm run lint                                         │
│ 6. Run: npm run type-check                                   │
│ 7. If errors → fix and repeat steps 4-6                      │
│ 8. Update docs/TODO.md (mark [x], DON'T delete)              │
│ 9. Update English changelog (changelog.entries.json)         │
│10. Run `npm run changelog:sync`                              │
│11. COMMIT IMMEDIATELY (don't wait for more changes)          │
│12. Push to repository                                        │
│                                                              │
│ NOTE: Translations only on weekends (Saturday-Sunday)        │
└──────────────────────────────────────────────────────────────┘
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    TENGRA AI RULES SUMMARY                   │
├─────────────────────────────────────────────────────────────┤
│ Logs:     logs/*.log only                                   │
│ Tests:    src/tests/**/*.test.ts                           │
│ Scripts:  src/scripts/*.js                                  │
│ Services: src/main/services/{domain}/*.service.ts          │
├─────────────────────────────────────────────────────────────┤
│ Logger:   appLogger.info('Name', 'message')                │
│ Errors:   throw new AppError('msg', { cause: error })      │
│ Jobs:     jobScheduler.registerRecurringJob(...)           │
├─────────────────────────────────────────────────────────────┤
│ WORKFLOW: build → lint → type-check → commit → push        │
│ COMMITS:  After every TODO completion or minor change       │
│ TODO:     Mark [x] done, NEVER delete, COMMIT IMMEDIATELY   │
│ CHANGELOG: English first (entries.json), translations       │
│           only on weekends (Saturday-Sunday)                │
├─────────────────────────────────────────────────────────────┤
│ NEVER:    any | console.log | files without ext | @ts-ignore│
└─────────────────────────────────────────────────────────────┘
```

---

*Last updated: 2026-01-14*
*Version: 1.1.0*



