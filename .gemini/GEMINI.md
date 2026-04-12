# TENGRA AGENT COMMANDMENTS (GEMINI EDITION)

STRICT ADHERENCE REQUIRED. Failure to follow rules results in termination of the session.

## MANDATORY: Read Documentation First

1. Always read [AGENTS.md](../../AGENTS.md) - Complete project guide
2. Always read [AI_RULES.md](../../AI_RULES.md) - Comprehensive coding standards
3. Always check [TODO.md](../../TODO.md) - Current tasks and priorities

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
1. Always read AI_RULES.md
2. Make changes
3. npm run build && npm run lint
4. Update TODO.md (mark [x], don't delete)
5. Commit and push

## Forbidden Actions

### NEVER USE
- any type - FORBIDDEN
- console.log - Use appLogger instead
- @ts-ignore - NEVER
- // eslint-disable - NEVER
- Full file deletion to edit
- while(true) without bounds

### Protected Paths (Never Modify)
- .git/
- node_modules/
- vendor/
- .env, .env.local

## Code Standards

### NASA Power of Ten Rules
1. No recursion
2. Fixed loop bounds
3. Short functions (max 60 lines)
4. Check all return values
5. Minimal variable scope

### Type Safety
- Strict types, no any
- All public methods need JSDoc
- Check all return values
- Handle all Promise rejections

### Performance
1. Lazy Loading: React.lazy() for heavy components
2. Memoization: useMemo/useCallback for computations
3. IPC Batching: Combine IPC calls to minimize overhead
4. Virtualization: Virtualize lists > 50 items
5. Lazy Services: Main services use lazy instantiation
6. Indexing: Mandatory indexes for query-critical fields
7. Disposal: Call dispose()/cleanup for all resources

### i18n
- Never hardcode user-facing strings
- Use t('key') for translations

## Project Structure

```
src/
├── main/           # Electron main process
├── renderer/       # React frontend
├── shared/         # Shared types/utils
├── native/         # Native services (Rust)
├── services/       # Native services (cliproxy)
└── tests/          # All tests
```
