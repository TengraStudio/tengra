# AI Agent Rules & Guidelines for Orbit

This document contains mandatory rules and guidelines for all AI agents working on the Orbit project. Any AI (Claude, GPT, Gemini, Copilot, Cursor, etc.) contributing to this project MUST follow these rules.

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

---

## 1. Project Overview

### What is Orbit?

Orbit is a **desktop AI assistant application** built with Electron, React, and TypeScript. It provides:

- **Multi-LLM Support**: Connects to multiple AI providers (OpenAI, Anthropic, Google, GitHub Copilot, Ollama)
- **Local-First Architecture**: Runs AI models locally via Ollama/Llama.cpp
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
// ✅ Good
for (let i = 0; i < MAX_ITERATIONS && !done; i++) {
    // work
}

// ❌ Bad
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
// ✅ Good
const result = await service.doSomething();
if (!result.success) {
    throw new Error(result.error);
}

// ❌ Bad
await service.doSomething(); // Ignored return
```

### Rule 8: Limited Preprocessor Use
- In TypeScript: Avoid complex generics and type gymnastics.
- Keep type definitions simple and readable.

### Rule 9: Restrict Pointer Use
- In TypeScript: Avoid `any` type completely.
- Use strict null checks (`strictNullChecks: true`).

### Rule 10: Compile with All Warnings
- All code must pass `tsc --noEmit` without errors.
- ESLint must pass with zero warnings.
- Never use `// @ts-ignore` or `// eslint-disable`.

---

## 3. File Structure Rules

### 3.1 Directory Organization

```
orbit/
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
✅ Correct naming:
my-service.service.ts
user-profile.component.tsx
use-chat-manager.hook.ts
settings.types.ts
error.util.ts

❌ Incorrect naming:
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

### 5.2 Valid Log File Examples

```
✅ Correct:
logs/token-refresh_2026-01-14.log
logs/job-scheduler_2026-01-14.log
logs/error_2026-01-14.json

❌ Incorrect:
logs/output              # No extension
query                    # Root directory, no extension
debug                    # No extension
src/logs/output.log      # Wrong location
```

### 5.3 Logger Usage

```typescript
import { appLogger } from '../logging/logger';

// ✅ Correct usage
appLogger.info('ServiceName', 'Operation completed successfully');
appLogger.warn('ServiceName', 'Resource running low', { remaining: 10 });
appLogger.error('ServiceName', 'Operation failed', error as Error);
appLogger.debug('ServiceName', 'Debug info', { data: someData });

// ❌ Never use
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

### 6.3 Forbidden Patterns

```typescript
// ❌ Silent catch (swallowing errors)
try {
    await operation();
} catch (e) {
    // Empty catch block
}

// ❌ Logging without re-throwing when needed
try {
    await criticalOperation();
} catch (e) {
    console.error(e);
    // Execution continues as if nothing happened
}

// ❌ Using any for error
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

## 8. Authentication & Tokens

### 8.1 Token Storage

Tokens are stored encrypted in `%APPDATA%/Orbit/data/auth/`:

```
auth/
├── antigravity-user@email.json   # Google OAuth
├── codex-session.json            # OpenAI OAuth
├── claude-session.json           # Claude session
├── copilot_token.json            # GitHub token
└── github-token.json             # GitHub PAT
```

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
// ✅ Use strict types
function processUser(user: User): ProcessedUser { ... }

// ❌ Never use any
function processData(data: any): any { ... }

// ✅ Use const assertions
const STATUS = {
    PENDING: 'pending',
    COMPLETE: 'complete'
} as const;

// ✅ Prefer interfaces for objects
interface UserData {
    id: string;
    name: string;
}

// ✅ Use type for unions/primitives
type Status = 'pending' | 'complete' | 'failed';
```

### 10.2 Async/Await Rules

```typescript
// ✅ Always await promises
const result = await asyncOperation();

// ✅ Handle promise arrays properly
const results = await Promise.all(promises);

// ❌ Don't ignore promises
asyncOperation(); // Missing await

// ✅ Use try-catch for async
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
// ✅ CORRECT - Use path aliases
import { DataService } from '@main/services/data/data.service'
import { appLogger } from '@main/logging/logger'
import { JsonObject } from '@shared/types/common'
import { getErrorMessage } from '@shared/utils/error.util'
import { useChat } from '@/hooks/useChat'

// ❌ WRONG - Avoid relative paths
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

1. ❌ Create files without extensions
2. ❌ Create files in root directory (except configs)
3. ❌ Use `console.log` (use `appLogger`)
4. ❌ Use `any` type
5. ❌ Use `// @ts-ignore` or `// eslint-disable`
6. ❌ Swallow errors silently
7. ❌ Log tokens or secrets
8. ❌ Create circular dependencies
9. ❌ Use `var` keyword
10. ❌ Leave TODO comments in production code
11. ❌ Commit commented-out code
12. ❌ Use synchronous file operations in main thread
13. ❌ Create memory leaks (event listeners without cleanup)
14. ❌ Use deprecated APIs

---

## 12. Checklist Before Committing

Before submitting any change, verify:

### Code Quality
- [ ] No TypeScript errors (`npm run build:check`)
- [ ] No ESLint warnings (`npm run lint`)
- [ ] All tests pass (`npm run test`)
- [ ] No `any` types used
- [ ] No `console.log` statements

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

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    ORBIT AI RULES SUMMARY                   │
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
│ NEVER:    any | console.log | files without ext | @ts-ignore│
└─────────────────────────────────────────────────────────────┘
```

---

*Last updated: 2026-01-14*
*Version: 1.0.0*
