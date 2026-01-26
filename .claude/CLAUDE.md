# Orbit AI Assistant - Project Memory

## MANDATORY: Read Documentation First

Before making ANY code changes, read these files:
- @docs/AI_RULES.md - Complete coding standards
- @docs/ARCHITECTURE.md - System architecture
- @docs/SERVICES.md - Service patterns
- @docs/TODO.md - Current tasks

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
5. Update docs/CHANGELOG.md
6. Commit and push

## Forbidden Actions

### Never Use
- `any` type - FORBIDDEN
- `console.log` - Use `appLogger` instead
- `@ts-ignore` - NEVER
- Full file deletion to edit

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

- Strict types, no `any`
- All public methods need JSDoc

### Performance
1. Lazy Loading: `React.lazy()` for heavy components.
2. Memoization: `useMemo`/`useCallback` for computations.
3. IPC Batching: Combine IPC calls to minimize overhead.
4. Virtualization: Virtualize lists > 50 items.
5. Lazy Services: Main services use lazy instantiation.
6. Indexing: Mandatory indexes for query-critical fields.
7. Disposal: Call `dispose()`/cleanup for all resources.
8. Responsive: Use worker threads for blocking tasks.
9. Lookups: Use `Map`/`Set` for collections.
10. Tree Shaking: Use explicit library imports.
11. UI Cost: `content-visibility: auto` where appropriate.
12. State: Keep state local; avoid global UI state.

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

export class MyService extends BaseService {
    constructor(private dep: Dependency) {
        super('MyService')
    }
    
    async myMethod(): Promise<Result> {
        appLogger.info('MyService', 'Doing work...')
        // implementation
    }
}
```
