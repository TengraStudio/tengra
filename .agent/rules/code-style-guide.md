---
trigger: always_on
---

# Orbit AI Agent Rules

## MANDATORY: Documentation First

Before doing ANY work, you MUST read and follow these documents:

### Required Reading (in order):
1. `docs/AI_RULES.md` - Complete coding standards and rules
2. `docs/ARCHITECTURE.md` - System architecture
3. `docs/SERVICES.md` - Service patterns
4. `docs/TODO.md` - Current tasks and known issues

### Key Rules Summary:

**Build Before Commit:**
```
npm run build → npm run lint → npm run type-check → commit → push
```

**Never Do:**
- Use `any` and `unknown` type
- Use `console.log` (use `appLogger`)
- Delete file to recreate (use targeted edits)
- Ignore lint/type errors
- Access forbidden paths (.git/, node_modules/, vendor/, .env)

**Always Do:**
- Follow NASA's Power of Ten rules
- Mark TODO.md items as `[x]` (don't delete)
- Update CHANGELOG.md for changes
- Use path aliases (@/, @main/, @shared/)
- Write clean, documented code

## For Full Details

See `docs/AI_RULES.md` for complete guidelines including:
- Section 11a: Forbidden Tools
- Section 11b: Forbidden Paths
- Section 11c: File Editing Rules
- Section 11d: Tool Transmission Rules
- Section 13: AI Workflow Rules