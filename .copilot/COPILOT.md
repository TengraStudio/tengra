# Orbit AI Assistant - Copilot Project Rules

## MANDATORY: Read Documentation First

Before making ANY code changes, you MUST read these files:
- docs/AI_RULES.md - Complete coding standards and rules
- docs/ARCHITECTURE.md - System architecture
- docs/SERVICES.md - Service patterns
- docs/TODO.md - Current tasks and known issues

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
- Use path aliases: @/, @main/, @shared/
- Strict types everywhere, no any
- All public methods need JSDoc comments
- Prefer interfaces for object types

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
