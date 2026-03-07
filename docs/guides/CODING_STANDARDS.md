# Coding Rules & Guidelines for Tengra

To maintain high code quality, security, and performance, all contributors must adhere to these standards.

## 1. NASA's 10 Rules for Safety-Critical Code (Adapted)

1.  **Simple Control Flow**: Avoid complex recursion or non-standard control jumps.
2.  **Fixed Loop Bounds**: All loops must have a defined upper bound to prevent infinite execution.
3.  **Short Functions**: Functions should prioritize a single responsibility and remain under 150 lines.
4.  **Check Return Values**: Every function return value must be checked, and errors handled.
5.  **Minimal Variable Scope**: Declare variables as close to their use as possible.

## 2. Type Safety

- **NO `any` or `unknown`**: Use strict TypeScript interfaces and types. Technical debt related to typing must be addressed immediately.
- **Strict Null Checks**: Maintain `strictNullChecks: true` to prevent runtime crashes.

## 3. Logging & Debugging

- **Use `appLogger`**: Never use `console.log`. All logging must go through the centralized logging system for auditability and rotation.
- **Service Tags**: Include the service name in all log entries for easier tracing.

## 4. Performance Standards

- **Lazy Loading**: Use `React.lazy()` for heavy components and defer non-essential main-process services.
- **Memoization**: Utilize `useMemo` and `useCallback` for expensive computations to minimize re-renders.
- **IPC Batching**: Combine high-frequency updates to keep the IPC bridge efficient.
- **Resource Disposal**: Always implement `dispose()` or cleanup logic for native handles and timers.

## 5. Security & Privacy

- **Safe Defaults**: Privacy is local-first. Don't transmit data to cloud services without user consent.
- **Token Protection**: Encrypt API keys and tokens using the system-level SecurityService.
- **Zero Suppression**: Do not use `@ts-ignore` or `eslint-disable`. Fix the underlying issue.

## 6. Development Workflow

1.  Ensure code builds locally with `npm run build`.
2.  Verify type safety with `npm run type-check`.
3.  Run the linting suite with `npm run lint`.
4.  Update documentation for all user-facing changes.

---
"Leave no warning behind. Code for performance, type for safety."
