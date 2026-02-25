# TENGRA AGENT COMMANDMENTS (CLAUDE EDITION)

> **STRICT ADHERENCE REQUIRED.** Failure to follow rules results in termination of the session.

## MANDATORY: Read Documentation First

1. Read [AGENTS.md](../../AGENTS.md) - Complete project guide
2. Read [docs/AI_RULES.md](../../docs/AI_RULES.md) - Comprehensive coding standards
3. Check [docs/TODO.md](../../docs/TODO.md) - Current tasks and priorities

## Quick Reference

### Build Commands
```bash
npm run build        # Build the application
npm run dev          # Start development server
npm run lint         # Check for lint errors
npm run type-check   # TypeScript validation
npm run test         # Run tests
```

### Workflow
1. Read docs/AI_RULES.md
2. Make changes
3. `npm run build && npm run lint`
4. Update docs/TODO.md (mark `[x]`, don't delete)
5. Update `docs/changelog/data/changelog.entries.json`
6. Run `npm run changelog:sync`
7. Commit and push

## Forbidden Actions

### Never Use
- `any` type - FORBIDDEN
- `console.log` - Use `appLogger` instead
- `@ts-ignore` - NEVER
- `// eslint-disable` - NEVER
- Full file deletion to edit
- `while(true)` without bounds
- Placeholders or TODO comments in code

### Protected Paths (Never Modify)
- `.git/`
- `node_modules/`
- `vendor/`
- `.env`, `.env.local`

## Code Standards

### NASA Power of Ten Rules
1. No recursion
2. Fixed loop bounds
3. Short functions (max 60 lines)
4. Check all return values
5. Minimal variable scope

### Type Safety
- Strict types, no `any`
- All public methods need JSDoc
- Check all return values
- Handle all Promise rejections

### Performance
1. Lazy Loading: `React.lazy()` for heavy components
2. Memoization: `useMemo`/`useCallback` for computations
3. IPC Batching: Combine IPC calls to minimize overhead
4. Virtualization: Virtualize lists > 50 items
5. Lazy Services: Main services use lazy instantiation
6. Indexing: Mandatory indexes for query-critical fields
7. Disposal: Call `dispose()`/cleanup for all resources
8. Responsive: Use worker threads for blocking tasks
9. Lookups: Use `Map`/`Set` for collections
10. Tree Shaking: Use explicit library imports

### i18n
- Never hardcode user-facing strings
- Use `t('key')` for translations
- Update both `en.ts` and `tr.ts`

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── services/   # Backend services (by domain)
│   ├── ipc/        # IPC handlers
│   └── mcp/        # MCP tools
├── renderer/       # React frontend
│   ├── features/   # Feature modules
│   └── components/ # UI components
├── shared/         # Shared types/utils
└── tests/          # All tests
```

## Service Pattern

```typescript
import { BaseService } from '@main/services/base.service'
import { appLogger } from '@main/logging/logger'
import { getErrorMessage } from '@shared/utils/error.util'

export class MyService extends BaseService {
    constructor(
        private dependency1: Dependency1,
        private dependency2: Dependency2
    ) {
        super('MyService')
    }

    async initialize(): Promise<void> {
        appLogger.info('MyService', 'Initializing...')
        // Initialization logic
    }

    async doWork(input: Input): Promise<Result> {
        if (!input) {
            throw new Error('Input is required')
        }

        try {
            const result = await this.dependency1.process(input)
            return { success: true, data: result }
        } catch (error) {
            appLogger.error('MyService', 'doWork failed', error as Error)
            throw error
        }
    }

    async dispose(): Promise<void> {
        appLogger.info('MyService', 'Disposing...')
        // Cleanup logic
    }
}
```

## IPC Handler Pattern

```typescript
import { createIpcHandler } from '@main/utils/ipc-wrapper.util'

export const registerMyHandler = createIpcHandler(
    'my:action',
    async (_event, param: string) => {
        // Implementation
        return result
    }
)
```

## Logging

```typescript
import { appLogger } from '@main/logging/logger'

// Correct usage
appLogger.info('ServiceName', 'Operation completed')
appLogger.warn('ServiceName', 'Resource low', { remaining: 10 })
appLogger.error('ServiceName', 'Operation failed', error as Error)
appLogger.debug('ServiceName', 'Debug info', { data: someData })

// NEVER use
console.log('message')
console.error('error')
```

## Error Handling

```typescript
try {
    await riskyOperation()
} catch (error) {
    appLogger.error('ServiceName', 'Failed:', getErrorMessage(error))
    throw error // Re-throw or handle appropriately
}
```

## Checklist Before Committing

- [ ] Code compiles without errors (`npm run build`)
- [ ] No lint warnings (`npm run lint`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] All tests pass (`npm run test`)
- [ ] TODO.md updated
- [ ] Changelog updated
- [ ] No `any` types used
- [ ] No `console.log` used
- [ ] All public methods have JSDoc
- [ ] User-facing strings use `t()`

