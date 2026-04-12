# AI Agent Guide for Tengra

CRITICAL: Read this document completely before making any changes to the codebase.

## Quick Start

1. READ RULES FIRST: Call view_file on [.agent/rules/MASTER_COMMANDMENTS.md](.agent/rules/MASTER_COMMANDMENTS.md) and AI_RULES.md before ANY code work.
2. Check TODO.md - Current tasks and priorities.
3. VALIDATE: Run npm run build && npm run lint && npm run type-check && npm run test before every commit.
4. FRIDAY BAN: No commits on Fridays. NO EXCEPTIONS.


## Project Overview

Tengra is a desktop AI assistant application built with Electron, React, and TypeScript. It provides multi-LLM support, project management, terminal integration, and extensibility via MCP (Model Context Protocol) plugins.

### Technology Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Electron 40+ |
| Frontend | React 18, TypeScript, Tailwind CSS |
| Backend | Node.js (Main Process) |
| Database | PGlite (PostgreSQL in-process) |
| Local AI | Ollama, Llama.cpp, SD-CPP |
| IPC | Electron IPC with typed bridge |

### Architecture

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

## Directory Structure

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

## Service Architecture

### Core Principles

1. BaseService Pattern: All services extend BaseService
2. Dependency Injection: Services are managed by DI container
3. Domain Organization: Services grouped by responsibility
4. Lifecycle Hooks: initialize() and cleanup() methods

### Service Template

```typescript
import { BaseService } from '@main/services/base.service'
import { appLogger } from '@main/logging/logger'

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

### Service Domains

| Domain | Folder | Examples |
|--------|--------|----------|
| AI/LLM | `services/llm/` | OllamaService, CopilotService, ModelRegistryService |
| Data | `services/data/` | DatabaseService, DataService, ChatEventService |
| Project | `services/project/` | ProjectService, GitService, DockerService |
| Security | `services/security/` | TokenService, KeyRotationService, RateLimitService |
| System | `services/system/` | CommandService, SystemService |
| Analysis | `services/analysis/` | TelemetryService, PerformanceService |
| Proxy | `services/proxy/` | ProxyService, QuotaService |

## IPC Communication

### Handler Pattern

```typescript
// In src/main/ipc/
import { createIpcHandler, createValidatedIpcHandler } from '@main/utils/ipc-wrapper.util';

// Basic handler
export const registerMyHandler = createIpcHandler(
    'my:action',
    async (_event, param: string) => {
        // Implementation
        return result;
    }
);

// Validated handler with Zod
export const registerValidatedHandler = createValidatedIpcHandler(
    'my:validated-action',
    InputSchema,
    OutputSchema,
    async (_event, input) => {
        // Implementation
        return output;
    }
);
```

### IPC Categories

- Window/System: `window:`, `process:`, `health:`
- Auth/Security: `auth:`, `key-rotation:`, `audit:`
- AI/LLM: `chat:`, `ollama:`, `llama:`, `memory:`
- Project: `project:`, `git:`, `terminal:`, `ssh:`
- Data: `db:`, `files:`, `backup:`
- UI: `settings:`, `theme:`, `clipboard:`

## Frontend Architecture

### Context Hierarchy

```
SettingsProvider → LanguageProvider → AuthProvider → ThemeProvider → ModelProvider → ProjectProvider → ChatProvider
```

### State Management

Uses external store pattern with useSyncExternalStore:

- `theme.store` - Theme persistence
- `settings.store` - App settings
- `sidebar.store` - Sidebar state
- `ui-layout.store` - Panel layout
- `notification-center.store` - Notifications

### Feature Modules

| Feature | Purpose |
|---------|---------|
| `chat` | Main chat interface |
| `settings` | Settings tabs |
| `projects` | Project management |
| `terminal` | Terminal panel |
| `models` | Model management |
| `mcp` | MCP server management |
| `memory` | Memory inspection |
| `ideas` | AI idea generation |

## Critical Rules

### Forbidden Actions

- NEVER use any type
- NEVER use console.log - Use appLogger
- NEVER use @ts-ignore
- NEVER delete entire files to edit them
- NEVER use while(true) without bounds
- NEVER hardcode user-facing strings

### Required Actions

- ALWAYS run npm run build && npm run lint before committing
- ALWAYS update TODO.md after completing tasks
- ALWAYS use t('key') for translations
- ALWAYS check return values
- ALWAYS handle Promise rejections
- ALWAYS use JSDoc for public methods

### NASA Power of Ten Rules

1. No recursion
2. Fixed loop bounds
3. Short functions (max 60 lines)
4. Check all return values
5. Minimal variable scope

## Build Commands

```bash
npm run build        # Build the application
npm run dev          # Start development server
npm run lint         # Check for lint errors
npm run type-check   # TypeScript validation
npm run test         # Run tests
```

## Workflow

1. Read AI_RULES.md
2. Make changes
3. npm run build && npm run lint
4. Update TODO.md (mark [x], don't delete)
5. Commit and push

## Logging

### Log Levels

| Level | Usage |
|-------|-------|
| `error` | Unrecoverable errors, exceptions |
| `warn` | Recoverable issues, deprecations |
| `info` | Important events, state changes |
| `debug` | Development debugging only |

### Logger Usage

```typescript
import { appLogger } from '@main/logging/logger';

appLogger.info('ServiceName', 'Operation completed');
appLogger.warn('ServiceName', 'Resource running low', { remaining: 10 });
appLogger.error('ServiceName', 'Operation failed', error as Error);
appLogger.debug('ServiceName', 'Debug info', { data: someData });
```

### Log File Rules

- Log files MUST be placed in logs/ directory only
- Valid extensions: .log, .txt, .json
- Format: {service}_{date}.log

## i18n

### Supported Languages

- Turkish (tr) - Default
- English (en)
- German (de)
- French (fr)
- Spanish (es)
- Japanese (ja)
- Chinese (zh)
- Arabic (ar) - RTL support

### Usage

```typescript
const { t } = useTranslation();

// Simple translation
const text = t('settings.general.title');

// With interpolation
const greeting = t('greeting', { name: 'John' });

// Pluralization
const items = t('items.count', { count: 5 });
```

## Protected Paths

Never modify these paths:
- .git/
- node_modules/
- vendor/
- .env, .env.local

## Performance Guidelines

1. Lazy Loading: Use React.lazy() for heavy components
2. Memoization: Use useMemo/useCallback for computations
3. IPC Batching: Combine IPC calls to minimize overhead
4. Virtualization: Virtualize lists > 50 items
5. Indexing: Mandatory indexes for query-critical fields
6. Disposal: Call dispose()/cleanup for all resources

## Testing

```bash
npm run test              # Run all tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:e2e          # E2E tests
```

### Test File Location

- Unit tests: `src/tests/unit/`, `src/tests/main/`, `src/tests/renderer/`
- Integration tests: `src/tests/integration/`
- E2E tests: `src/tests/e2e/`

## MCP Plugin System

MCP (Model Context Protocol) enables extending AI capabilities:

- Filesystem operations
- Git operations
- Web search
- Terminal commands
- Database administration
- CI/CD integration

### MCP Server Template

Located in `src/main/mcp/templates/server.template.ts`

## Troubleshooting

### Common Issues

1. Build fails: Check TypeScript errors with npm run type-check
2. Lint errors: Run npm run lint -- --fix for auto-fixable issues
3. Database issues: Check PGlite logs in logs/ directory
4. Proxy issues: Verify proxy process is running on expected port

### Getting Help

- Check TODO.md
- Review ARCHITECTURE.md
- Check API.md
