---
trigger: always_on
---

# TENGRA AI AGENT: CODE STYLE GUIDE

> **CRITICAL**: Read [AGENTS.md](./AGENTS.md) completely before making any changes.

## Quick Start

1. Read [AGENTS.md](./AGENTS.md) - Complete project guide
2. Read [AI_RULES.md](./AI_RULES.md) - Comprehensive coding standards
3. Check [TODO.md](./TODO.md) - Current tasks and priorities

## Forbidden Actions

- ❌ **NEVER** use `any` type
- ❌ **NEVER** use `console.log` - Use `appLogger`
- ❌ **NEVER** use `@ts-ignore` or `// eslint-disable`
- ❌ **NEVER** delete entire files to edit them
- ❌ **NEVER** use `while(true)` without bounds
- ❌ **NEVER** hardcode user-facing strings
- ❌ **NEVER** use Tailwind utility classes directly in renderer JSX
- ❌ **NEVER** create/import additional renderer CSS files; `src/renderer/index.css` is the only renderer stylesheet
- ❌ **NEVER** describe internal rule execution in user-facing delivery messages

## Required Actions

- ✅ **ALWAYS** run `npm run build && npm run lint` before committing
- ✅ **ALWAYS** update `TODO.md` after completing tasks
- ✅ **ALWAYS** use `t('key')` for translations
- ✅ **ALWAYS** check return values
- ✅ **ALWAYS** handle Promise rejections
- ✅ **ALWAYS** use JSDoc for public methods
- ✅ **ALWAYS** style renderer UI via semantic classes defined in `src/renderer/index.css`
- ✅ **ALWAYS** define reusable spacing/radius/border/shadow/typography values under `:root` tokens in `src/renderer/index.css`

## NASA Power of Ten Rules

1. No recursion
2. Fixed loop bounds
3. Short functions (max 60 lines)
4. Check all return values
5. Minimal variable scope

## Workflow

1. Read AI_RULES.md
2. Make changes
3. `npm run build && npm run lint`
4. Update TODO.md (mark `[x]`, don't delete)
5. Update the relevant markdown docs if user-facing behavior changed
6. Commit and push

For complete details, see [AGENTS.md](./AGENTS.md) and [AI_RULES.md](./AI_RULES.md).


