---
trigger: always_on
---

# TANDEM AI AGENT: CODE STYLE GUIDE

> **CRITICAL**: Read [AGENTS.md](../../AGENTS.md) completely before making any changes.

## Quick Start

1. Read [AGENTS.md](../../AGENTS.md) - Complete project guide
2. Read [docs/AI_RULES.md](../../docs/AI_RULES.md) - Comprehensive coding standards
3. Check [docs/TODO.md](../../docs/TODO.md) - Current tasks and priorities

## Forbidden Actions

- ❌ **NEVER** use `any` type
- ❌ **NEVER** use `console.log` - Use `appLogger`
- ❌ **NEVER** use `@ts-ignore` or `// eslint-disable`
- ❌ **NEVER** delete entire files to edit them
- ❌ **NEVER** use `while(true)` without bounds
- ❌ **NEVER** hardcode user-facing strings

## Required Actions

- ✅ **ALWAYS** run `npm run build && npm run lint` before committing
- ✅ **ALWAYS** update `docs/TODO.md` after completing tasks
- ✅ **ALWAYS** use `t('key')` for translations
- ✅ **ALWAYS** check return values
- ✅ **ALWAYS** handle Promise rejections
- ✅ **ALWAYS** use JSDoc for public methods

## NASA Power of Ten Rules

1. No recursion
2. Fixed loop bounds
3. Short functions (max 60 lines)
4. Check all return values
5. Minimal variable scope

## Workflow

1. Read docs/AI_RULES.md
2. Make changes
3. `npm run build && npm run lint`
4. Update docs/TODO.md (mark `[x]`, don't delete)
5. Update `docs/changelog/data/changelog.entries.json`
6. Run `npm run changelog:sync`
7. Commit and push

For complete details, see [AGENTS.md](../../AGENTS.md) and [docs/AI_RULES.md](../../docs/AI_RULES.md).

