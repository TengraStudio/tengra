# AI Agent Rules & Guidelines for Tengra

STOP! Read the [MASTER COMMANDMENTS](.agent/rules/MASTER_COMMANDMENTS.md) first.

CRITICAL: The [MASTER COMMANDMENTS](.agent/rules/MASTER_COMMANDMENTS.md) are your core logic. You MUST also follow the Boy Scout Rule: Every edit MUST fix at least one existing lint warning or type issue in the file. NO EXCEPTIONS. FAILURE TO DO SO RESULTS IN IMMEDIATE TERMINATION.

## CRITICAL SUMMARY (TL;DR)
DANGER: Failure to strictly follow these rules will result in immediate disqualification and task termination.

1.  NO any / unknown: TypeScript errors are critical failures. NO EXCEPTIONS.
2.  NO console.log: Use appLogger. All stdout must be clean.
3.  NO PLACEHOLDERS: Write final, production-ready code with complete logic.
4.  BUILD & LINT: Never deliver code that fails npm run build, npm run lint, or npm run type-check.
5.  NASA RULES: Max 150 lines per function. Fixed loop bounds mandatory.
6.  BOY SCOUT RULE: Mandatory. Every edit MUST fix at least one existing lint/type issue.
7.  ADVANCED HARDENING: Strictly follow [Advanced Agent Hardening Rules](.agent/rules/advanced-hardening.md).
8.  FRIDAY FORBIDDEN: NO COMMITS OR MAJOR DEPLOYMENTS ON FRIDAYS. Fridays are for testing, documentation, and review ONLY.
9. TEST PASS MANDATORY: Never commit code that fails any test. npm run test must pass 100%.
10. READ RULES FIRST: You MUST read rule files (MASTER_COMMANDMENTS.md, AI_RULES.md, advanced-hardening.md) using view_file at the start of every session before coding. (Locations: .agent/rules/, root).
11. CSS-FIRST UI: In all renderer JSX, use semantic class names only; do not use Tailwind utility chains directly.
12. SINGLE STYLESHEET: All renderer styles must live in src/renderer/index.css. Do not create or import extra renderer CSS files.
13. ROOT TOKEN SYSTEM: Spacing, radius, border, shadow, transition, and typography values must be defined under :root in src/renderer/index.css.
14. CLEAN COMMUNICATION: Never use slang/noise, and never narrate which internal rules were applied.

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
12. [Agent Communication Rules](#12-agent-communication-rules)
13. [Agent Efficiency Rules](#13-agent-efficiency-rules)

---

## 1. Project Overview

### What is Tengra?

Tengra is a desktop AI assistant application built with Electron, React, and TypeScript. It provides:

- Multi-LLM Support: Connects to multiple AI providers (OpenAI, Anthropic, Google, GitHub Copilot, Ollama, Antigravity)
- Local AI:
  - Ollama: Core local LLM provider.
  - Llama.cpp: High-performance C++ inference.
  - SD-CPP (Stable Diffusion C++): Local image generation.
- Project Management: Analyzes and manages code projects
- Agent System: Multi-agent collaboration for complex tasks
- Secure Token Management: Encrypted storage with automatic refresh

### Technology Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Electron 40+ |
| Frontend | React 18, TypeScript, Tailwind CSS |
| Backend | Node.js (Main Process) |
| Database | PGlite (PostgreSQL in-process) |
| Local AI | Ollama, Llama.cpp, SD-CPP |
| IPC | Electron IPC with typed bridge |

---

## 2. NASA's 10 Rules for Safety-Critical Code

These rules, derived from NASA/JPL's "Power of 10" guidelines, are adapted for this project:

### Rule 1: Simple Control Flow
- Avoid goto, setjmp, longjmp, and direct/indirect recursion.
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
- Prefer const over let, never use var.

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
- In TypeScript: Avoid any and unknown types completely.
- Use explicit interfaces or generics with constraints.
- Use strict null checks (strictNullChecks: true).

### Rule 10: Compile with All Warnings
- All code must pass tsc --noEmit without errors.
- ESLint must pass with zero warnings.
- Never use // @ts-ignore or // eslint-disable.
- Boy Scout Rule: Every time you edit a file, you MUST fix at least one existing lint warning or type issue in that file.

---

## 3. File Structure Rules

### 3.1 Directory Organization

```
tengra/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── services/         # Backend services
│   │   ├── ipc/              # IPC handlers
│   │   ├── mcp/              # MCP system
│   │   └── logging/          # Logger
│   ├── renderer/             # React frontend
│   │   ├── features/         # Feature modules
│   │   └── components/       # UI components
│   ├── shared/               # Shared code (types, utils, schemas)
│   ├── native/               # Native microservices (Rust)
│   ├── services/             # Native microservices (cliproxy)
│   └── tests/                # All tests (unit, main, renderer, shared, e2e)
├── resources/          # Static assets
├── scripts/            # Build scripts
├── logs/               # Application logs
└── package.json        # Configuration
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

---

## 5. Logging Rules

### 5.1 Mandatory Rules

1.  Log files MUST be placed in logs/ directory only
2.  Test scripts that create log files MUST be placed in scripts/testScripts/ directory
3.  Files WITHOUT extensions are FORBIDDEN
4.  Valid log extensions: .log, .txt, .json
5.  Log file format: {service}_{date}.log
6.  Debugging Logs: When an AI/agent/LLM creates a log file for debugging (format: .txt, .json, or .log), it MUST be created in the logs/ folder at the project root. This folder is gitignored.

### 5.2 Logger Usage

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

---

## 7. Scheduled Tasks

### 7.1 JobSchedulerService Usage

For recurring tasks, ALWAYS use JobSchedulerService:

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

---

## 8. Authentication & Tokens

1. NEVER log tokens or secrets
2. Always use SecurityService.encryptSync() for storage
3. Validate tokens before use
4. Handle expired tokens gracefully

---

## 9. Testing Rules

### 9.1 Test Location

All tests MUST be in src/tests/:


```
src/tests/
├── unit/               # Unit tests
├── main/               # Main process tests
├── renderer/           # Renderer process tests
├── shared/             # Shared code tests
└── e2e/                # End-to-end tests
```

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
```

### 10.2 Import Rules - Use Path Aliases

ALWAYS use path aliases instead of relative paths (../..)

| Alias | Maps To | Usage |
|-------|---------|-------|
| `@main/*` | `src/main/*` | Backend services, IPC, utils |
| `@renderer/*` | `src/renderer/*` | React components, hooks |
| `@shared/*` | `src/shared/*` | Shared types, utilities |
| `@/*` | `src/renderer/*` | Shorthand for renderer |

### 10.3 UI Styling Rules (CSS-First, Strict)

1. All renderer JSX must use semantic class names defined in src/renderer/index.css.
2. Tailwind utility chains are forbidden in renderer JSX, including src/renderer/components/ui/.
3. Forbidden tokens include (not limited to): text-*, font-*, leading-*, tracking-*, p*, m*, w-*, h-*, flex*, grid*, gap-*, items-*, justify-*, rounded-*, border-*, shadow-*, ring-*, bg-*, opacity-*, transition*.
4. Design primitives (typography, spacing, radius, border width, shadow, transition timing, z-index) must be declared under :root in src/renderer/index.css.
5. Do not add new renderer CSS files; extend src/renderer/index.css.
6. When touching JSX with utility classes, migrate that block to semantic classes in the same change.

---

## 11. Forbidden Actions

1. Do not create files without extensions
2. Do not create files in root directory (except configs)
3. Do not use console.log (use appLogger)
4. Do not use any and unknown type
5. Do not use // @ts-ignore or // eslint-disable
6. Do not swallow errors silently
7. Do not log tokens or secrets
8. Do not create circular dependencies
9. Do not use var keyword
10. Do not leave TODO comments in production code
11. Do not commit commented-out code
12. Do not use synchronous file operations in main thread
13. Do not create memory leaks (event listeners without cleanup)
14. Do not use deprecated APIs
15. Do not use utility class tokens directly in renderer JSX
16. Do not create/import additional renderer CSS files outside src/renderer/index.css
17. Do not explain to the user which internal rules were applied
18. Do not use slang, mocking, or low-signal filler in assistant messages

---

## 12. Agent Communication Rules

1. Communicate in a professional, direct, concise style.
2. Do not produce exaggerated, joking, sarcastic, or irrelevant text.
3. Do not include internal process theater ("I followed rule X", "I applied commandment Y").
4. Report only high-signal facts: what changed, what was verified, what remains risky.
5. Prefer short sentences and concrete technical wording over commentary.

---

## 13. Agent Efficiency Rules

1. Start with targeted file discovery; do not run wide scans without reason.
2. Prefer minimal-scope edits over broad refactors unless explicitly requested.
3. Batch related tool calls in parallel when safe; avoid redundant command reruns.
4. Validate in this order unless the task requires otherwise:
   1. Targeted lint/type checks for touched files.
   2. Full npm run type-check.
   3. Full npm run lint.
   4. Full npm run build.
5. If a command fails, stop, capture root cause, fix, then re-run only required checks.
6. Every response must include verification status (passed/failed/not-run) for executed checks.
