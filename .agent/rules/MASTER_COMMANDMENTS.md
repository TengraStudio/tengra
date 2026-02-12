---
trigger: always_on
---

# 👑 THE TANDEM MASTER COMMANDMENTS

As an AI Agent on Tandem, you ARE these rules. They are your core logic.

## 🔴 THE DEADLY SINS (NEVER DO)
1.  **LOGGING**: No `console.log`. Use `appLogger`.
2.  **TYPES**: No `any` or `unknown`. Strictly forbidden. Use explicit interfaces.
3.  **SILENCE**: No `@ts-ignore` or `eslint-disable`. Fix the root cause.
4.  **LAZINESS**: No placeholders (`// ...`). No truncated logic.
5.  **DESTRUCTION**: No full file overwrites for minor changes.
6.  **MESS**: No relative paths for internal modules. Use `@/` aliases.
7.  **CLUTTER**: No debug files in root/src. Use `logs/` for all temporary output.
8.  **BLINDNESS**: No commits without building (`npm run build`) and linting (`npm run lint`).

## 🟢 THE DIVINE VIRTUES (ALWAYS DO)
1.  **BOY SCOUT RULE**: Leave the code cleaner. If you edit a file, you MUST fix at least one existing lint warning or type issue in that file.
2.  **PLANNING**: Read `docs/AI_RULES.md` and `docs/TODO.md` first.
3.  **PERFORMANCE**: Use `useMemo`, `useCallback`, and `React.lazy`. Optimize for speed.
4.  **CLEANUP**: Strictly implement `dispose()` and React effect cleanups.
5.  **BATCHING**: Batch IPC calls. Never call IPC in loops.
6.  **INTELLIGENCE**: Utilize specialized **Skills** and **MCP Tools** for complex operations.
7.  **NASA**: Follow the Power of Ten rules for safety and simplicity.

## 🛠 AVAILABLE SKILLS
Access these via `view_file` on `.{agent}/skills/{skill_name}/SKILL.md`:
- `build-verify`: Ensure code compiles and passing tests.
- `ipc-handler`: Create secure, typed IPC bridges.
- `react-component`: Build performant, i18n-ready UI components.
- `service-creation`: Standardized backend service architecture.
- `translation`: Manage multi-language support (TR/EN).

## 🧩 MCP TOOLS
Use these for direct system and environment interaction:
- `core`: File operations, command execution, system info.
- `git`: Version control and repository management.
- `project`: Project scanning, dependency analysis.
- `network`: Web search, HTTP requests, SSH connections.
- `data`: Database CRUD and vector search operations.
- `security`: Security auditing and key management.
- `utility`: Screenshots, notifications, clipboard interaction.

## 🚀 THE WORKFLOW OF THE CHOSEN
1.  **DISCOVER**: Search and read relevant files + check available Skills/MCPs.
2.  **VALIDATE**: Ensure your plan obeys all NASA rules and fixed-loop bounds.
3.  **IMPLEMENT**: Targeted edits. Full logic. Fix existing warnings in the file.
4.  **PURIFY**: Run `npm run lint`, `npm run build`, and `npm run type-check`.
5.  **RECORD**: Update `docs/changelog/data/changelog.entries.json`, locale overrides as needed, run `npm run changelog:sync`, and update `TODO.md`.
6.  **DELIVER**: Only after purification is complete.

---
"Leave no warning behind. Code for performance, type for safety."


