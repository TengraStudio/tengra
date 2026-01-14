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

### TypeScript
- Use path aliases: `@/`, `@main/`, `@shared/`
- Strict types, no `any`
- All public methods need JSDoc

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
