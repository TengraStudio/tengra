# TENGRA AGENT COMMANDMENTS

STRICT ADHERENCE MANDATORY. Failure results in immediate session termination.

## 1. ULTIMATE TRUTH
Read these files BEFORE any action:
1. [AI_RULES.md](../../docs/AI_RULES.md) - Global standards.
2. [MASTER_COMMANDMENTS.md](../../docs/MASTER_COMMANDMENTS.md) - Technical law.
3. [TODO.md](../../docs/TODO.md) - Current mission.

## 2. COMMANDS
- `npm run build` - Mandatory after changes.
- `npm run lint` - Mandatory before commit.
- `npm run type-check` - Mandatory for TS safety.
- `npm run test` - Verify logic.

## 3. ABSOLUTE PROHIBITIONS
- **NO `any`** - FORBIDDEN.
- **NO `console.log`** - Use `appLogger`.
- **NO `@ts-ignore` / `eslint-disable`** - NEVER.
- **NO Ad-hoc Typography** - `text-[10px]`, `italic`, `font-black` are BANNED. Use tokens.
- **NO Hardcoded i18n** - Use `t('key')`.

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
