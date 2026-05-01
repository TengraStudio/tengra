# TENGRA DEVELOPMENT STANDARDS

STRICT ADHERENCE MANDATORY.

## 1. CODE STYLE (TYPESCRIPT)
- **STRICT TYPES**: NO `any`/`unknown`. Use interfaces.
- **NASA RULES**: Max 60 lines/function. No recursion. Static loop bounds.
- **CLEAN CODE**: Declarative logic, minimal nesting, `const` > `let`.
- **TRACEABLE**: Use `appLogger`. NO `console.log`.

## 2. FRONTEND & UI (STRICT)
- **AESTHETICS**: High-fidelity, premium design system. Glassmorphism + Atmospheric lighting.
- **TYPOGRAPHY (FORBIDDEN)**: `text-[...]`, `tracking-[...]`, `italic`, `font-black`.
- **TYPOGRAPHY (MANDATORY)**: Use semantic classes (`typo-overline`) or tokens (`text-sm`).
- **THEME**: ALL colors MUST use `hsl(var(--...))` tokens.
- **COMPONENTS**: Functional with hooks. Max 100 lines. Split if larger.

## 3. GIT & WORKFLOW
- **COMMITS**: Conventional Commits only. `type(scope): description`.
- **VERIFICATION**: `npm run build && npm run lint` MUST pass before commit.
- **TODO**: Update `TODO.md` immediately after task completion.

## 4. SECURITY & DATA
- **CONTRACTS**: Zod schemas in `src/shared/schemas/` for all IPC.
- **SECRETS**: NEVER log tokens. Use `SecurityService` for encryption.

## 5. TESTING
- Vitest for Unit, Playwright for E2E.
- 60% minimum coverage.
