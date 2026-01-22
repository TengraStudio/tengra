# Code Style Rules for Copilot

## TypeScript Standards

### Type Safety
- Never use the `any` type. If a type is truly unknown, use a discriminated union or a generic constraint.
- Prefer `interface` for object shapes, `type` for unions and utility types.
- Enable and respect `strictNullChecks`.

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
