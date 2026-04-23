# Code Style Rules for Copilot

## TypeScript Standards

### Type Safety
- Never use the `any` type. If a type is truly unknown, use a discriminated union or a generic constraint.
- Prefer `interface` for object shapes, `type` for unions and utility types.
- Enable and respect `strictNullChecks`.

### Compatibility
- Default to cross-platform behavior. Code must not silently depend on Windows-only, macOS-only, or Linux-only behavior.
- Use `path`/URL helpers instead of hand-built separators, and prefer portable shell/process abstractions.
- When platform differences are unavoidable, gate them explicitly and provide safe fallbacks.

### Naming Conventions
- Files: `kebab-case` with suffixes (e.g., `my-feature.service.ts`, `user-profile.component.tsx`).
- Classes/Interfaces: `PascalCase`.
- Variables/Functions: `camelCase`.
- Constants: `SCREAMING_SNAKE_CASE`.

### Import Order
1. Node.js built-ins (`fs`, `path`)
2. External packages (`electron`, `react`)
3. Internal path aliases (`@main/`, `@shared/`)
4. Relative imports (same directory only)

### Formatting
- Use Prettier defaults.
- Maximum line length: 100 characters.
- Use template literals for string interpolation.

### Theming Discipline
- In renderer code, treat hardcoded visual literals as a bug unless they are theme preset data or explicitly allowlisted.
- Route new visual tokens through shared CSS variables, theme manifests, and existing theme utilities.
