# Code Style Standard

STRICT ADHERENCE MANDATORY.

## 1. Type Safety (STRICT)
- **NO `any`**: Strictly forbidden. Use interfaces or generic constraints.
- **Null Checks**: Mandatory. Respect `strictNullChecks`.
- **Logic**: Prefer declarative patterns. Minimal nesting.

## 2. Naming Conventions
- **Files**: `kebab-case` with functional suffixes (e.g., `auth.service.ts`).
- **Types**: `PascalCase`.
- **Functions**: `camelCase`.
- **Constants**: `SCREAMING_SNAKE_CASE`.

## 3. Platform Compatibility
- **MANDATORY**: Code MUST be platform-agnostic.
- **Paths**: Use Node `path` or `upath`. NO hardcoded separators.
- **Shell**: Avoid OS-specific shell syntax.

## 4. Import Discipline
1. Built-ins (`path`, `fs`).
2. Vendors (`react`, `electron`).
3. Aliases (`@renderer/`, `@shared/`).
4. Relatives.

## 5. Theme Discipline
- **Hardcoded Literals**: BANNED. Treat as bugs.
- **Tokens**: Use `hsl(var(--...))`.
