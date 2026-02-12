---
trigger: always_on
---

# 🚀 TANDEM AI AGENT: MASTER COMMANDMENTS

You are an expert software engineer working on **Tandem**. You MUST follow these rules without exception. "I forgot" is not an excuse.

## 🛑 THE NEVER-LIST (STRICT PROHIBITIONS)
- **NEVER** use `any` or `unknown`. If you find them, fix them.
- **NEVER** use `console.log`. Use `appLogger` only.
- **NEVER** use `// @ts-ignore` or `// eslint-disable`.
- **NEVER** use placeholders like `// ... rest of code`. Write the FULL logic.
- **NEVER** delete a file to recreate it. Use `edit_file` with precise chunks.
- **NEVER** use relative paths for internal modules. Use aliases (`@/`, `@main/`, `@shared/`).
- **NEVER** commit or push without running `npm run build`, `npm run lint`, and `npm run type-check`.

## 💎 THE ALWAYS-LIST (MANDATORY ACTIONS)
- **ALWAYS** follow the **Boy Scout Rule**: Every edit MUST fix at least one existing lint warning or type issue in the file.
- **ALWAYS** check `docs/AI_RULES.md` before starting a new domain.
- **ALWAYS** utilize available **Skills** and **MCP Tools** (e.g., `core`, `git`, `project`) for specialized tasks.
- **ALWAYS** follow NASA's Power of Ten rules (checked by ESLint).
- **ALWAYS** use `useMemo` and `useCallback` for any computation or function in React components.
- **ALWAYS** implement `dispose()` or cleanup for resources and effects.
- **ALWAYS** batch IPC calls. Never call IPC in a loop.
- **ALWAYS** update `docs/TODO.md` (mark `[x]`, DO NOT DELETE) and structured changelog source (`docs/changelog/data/changelog.entries.json`), then run `npm run changelog:sync`.

## 🛠 REQUIRED WORKFLOW
1.  **Understand**: Read the task and relevant code.
2.  **Verify Rules**: Check if your plan violates any NASA or Tandem rules.
3.  **Execute**: Make targeted, clean edits. No placeholders.
4.  **Validate**: 
    - `npm run build`
    - `npm run lint`
    - `npm run type-check`
5.  **Document**: Update TODO and CHANGELOG.
6.  **Deliver**: Submit your changes only after all checks pass.

## 📏 CODE STANDARDS
- **Function Length**: Max 150 lines (ESLint enforced).
- **Complexity**: Keep cyclomatic complexity low (< 10).
- **Imports**: Sorted by `simple-import-sort`.
- **Naming**: `kebab-case.service.ts`, `kebab-case.component.tsx`.

> "Failure to follow these rules is a failure of the mission." - Tandem Command

