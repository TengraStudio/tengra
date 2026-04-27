# 🤖 TENGRA AI COMPREHENSIVE GUIDE
> **ULTIMATE TRUTH**: [MASTER COMMANDMENTS](./MASTER_COMMANDMENTS.md) | [ENFORCEMENT](./enforcement.md)

## 1. STACK & ARCHITECTURE
- **ELECTRON**: Main (Node.js) | Renderer (React 18 + TS + Tailwind) | Shared (Logic/Schemas).
- **NATIVE**: Rust sidecars (`db-service`, `proxy`, `memory-service`) in `src/native`.
- **UI**: Shadcn/ui + Lucide. **STRICTLY MINIMAL & PREMIUM DESIGN.**
- **TYPOGRAPHY**: 
    - **FORBIDDEN**: `text-[...]`, `tracking-[...]`, `italic`, `font-black`.
    - **MANDATORY**: Use semantic classes (`typo-overline`, `typo-caption`) or tailwind tokens (`text-10`, `tracking-tight`).
- **IPC**: Typed Zod contracts via `createValidatedIpcHandler`.

## 2. REPOSITORY MAP
- `src/main/`: IPC handlers, background services.
- `src/renderer/`: React components, hooks, stores.
- `src/shared/`: Cross-process schemas (`src/shared/schemas/`) and types.
- `src/native/`: Rust source for sidecar binaries.
- `src/tests/`: Unit, integration, and E2E tests.

## 3. NASA SAFETY RULES
- **Short**: Max 60 lines/function.
- **Simple**: No recursion, no `goto`.
- **Safe**: Check EVERY return. Use static loop bounds.
- **Typed**: NO `any`/`unknown`. Use interfaces.
- **Traceable**: Use `appLogger`. NO `console.log`.

## 4. DEVELOPMENT WORKFLOW
1. **Initialize**: Extend `BaseService`. Register in `services.ts`. Implement `dispose()`.
2. **IPC**: Define `argsSchema` and `responseSchema` in `src/shared/schemas/`.
3. **UI**: 
    - Use semantic classes in `index.css`. 
    - No complex Tailwind chains in JSX.
    - **NO AD-HOC TYPOGRAPHY.** Use tokens.
4. **Test**: Vitest for unit, Playwright for E2E. Target 60% coverage.
5. **Verify**: `npm run build && npm run lint && npm run type-check`.

## 5. HANDOFF FORMAT
- **Action**: What changed.
- **Scope**: Key files affected.
- **Validation**: Build/Lint/Test results.
- **Risks**: Any follow-up items.

"Simple code is reliable code. Less is more."
