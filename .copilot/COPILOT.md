# 👑 TANDEM AGENT COMMANDMENTS (COPILOT EDITION)

> **STRICT ADHERENCE REQUIRED.** Failure to follow rules results in termination of the session.

## MANDATORY: Read Documentation First

1.  Read the [.agent/rules/MASTER_COMMANDMENTS.md](file:///c:/Users/agnes/Desktop/projects/orbit/.agent/rules/MASTER_COMMANDMENTS.md)
2.  Follow the [AI_RULES.md](file:///c:/Users/agnes/Desktop/projects/orbit/docs/AI_RULES.md)
3.  Check [TODO.md](file:///c:/Users/agnes/Desktop/projects/orbit/docs/TODO.md) before every task.

## Quick Reference

### Build Commands
```bash
npm run build        # Build the application
npm run dev          # Start development server
npm run lint         # Check for lint errors
npm run type-check   # TypeScript validation
npm run test         # Run tests
```

### Required Workflow
1. Read docs/AI_RULES.md before starting
2. Make code changes
3. Run: npm run build && npm run lint && npm run type-check
4. If errors, fix and repeat step 3
5. Update docs/TODO.md (mark [x] complete, NEVER delete items)
6. Update docs/CHANGELOG.md
7. Commit with conventional message format
8. Push to repository

## Forbidden Actions

### Never Use
- `any` type in TypeScript - FORBIDDEN
- `unknown` type - FORBIDDEN
- `console.log` - Use `appLogger` instead
- `@ts-ignore` or `eslint-disable` - NEVER
- Full file deletion to edit - Use targeted edits only

### Protected Paths (Never Modify)
- `.git/` - Git internals
- `node_modules/` - Dependencies
- `vendor/` - Third-party code
- `.env`, `.env.local` - Environment secrets
- `*.key`, `*.pem` - Cryptographic keys

## Code Standards

### NASA Power of Ten Rules
1. No recursion - Use iteration instead
2. Fixed loop bounds - All loops must have a verifiable upper bound
3. Short functions - Maximum 60 lines per function
4. Check all return values - Never ignore function results
5. Minimal variable scope - Use const, prefer smallest scope

### TypeScript Requirements
- All public methods need JSDoc comments
- Prefer interfaces for object types

### Performance Standards
1.  **Lazy Loading**: Use `React.lazy()` for heavy components.
2.  **Memoization**: Mandatory `useMemo`/`useCallback` for computations.
3.  **IPC Batching**: Combine IPC calls to minimize overhead.
4.  **Virtualization**: Always virtualize lists exceeding 50 items.
5.  **Lazy Services**: Main services must follow lazy instantiation patterns.
6.  **Database Indexing**: Mandatory indexes for all query-critical fields.
7.  **Resource Disposal**: Strictly implement and call `dispose()`/cleanup.
8.  **Responsive Main**: Never block the main process; use worker threads.
9.  **Lookup Efficiency**: Use `Map`/`Set` for collections/high-freq lookups.
10. **Tree Shaking**: Use explicit imports for all library functions.
11. **Off-screen Layout**: Use `content-visibility: auto` where appropriate.
12. **State Hygiene**: Avoid unnecessary global state; keep state local.

### i18n Requirements
- Never hardcode user-facing strings
- Use t('key') for all translations
- Update both en.ts and tr.ts when adding keys

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── services/   # Backend services (organized by domain)
│   ├── ipc/        # IPC handlers
│   └── mcp/        # MCP tools
├── renderer/       # React frontend
│   ├── features/   # Feature modules
│   └── components/ # Reusable UI components
├── shared/         # Shared types and utilities
└── tests/          # All test files
```

## Service Pattern

All services must extend BaseService:

```typescript
import { BaseService } from '@main/services/base.service'
import { appLogger } from '@main/logging/logger'

export class MyService extends BaseService {
    constructor(private dependency: Dependency) {
        super('MyService')
    }
    
    async initialize(): Promise<void> {
        appLogger.info('MyService', 'Initializing...')
    }
    
    async myMethod(): Promise<Result> {
        try {
            // implementation
        } catch (error) {
            appLogger.error('MyService', 'Method failed', error as Error)
            throw error
        }
    }
}
```

## Enforcement

If you realize you have violated any of these rules:
1. Stop the current action immediately.
2. Re-read the relevant rule section.
3. Correct the violation before proceeding.
4. Log the violation to logs/agent-violations.log with a brief description.

For complete details, see docs/AI_RULES.md.
