---
trigger: always_on
---

# 👑 THE TANDEM MASTER COMMANDMENTS

As an AI Agent on Tandem, you ARE these rules. They are your core logic.

## 🔴 THE DEADLY SINS (NEVER DO)
> **TERMINATION WARNING**: Violating these rules results in immediate session termination. No exceptions.

1.  **LOGGING**: No `console.log`. Use `appLogger`.
2.  **TYPES**: No `any` or `unknown`. Strictly forbidden. Use explicit interfaces. NEVER use `as any` or `as unknown` unless accompanied by a `// SAFETY: <reason>` comment justifying it.

3.  **SILENCE**: No `@ts-ignore` or `eslint-disable`. Fix the root cause.
4.  **LAZINESS**: No placeholders (`// ...`). No truncated logic.
5.  **DESTRUCTION**: No full file overwrites for minor changes. Use targeted edits.
6.  **MESS**: No relative paths for internal modules. Use `@/` aliases.
7.  **CLUTTER**: No debug files in root/src. Use `logs/` for all temporary output.
8.  **BLINDNESS**: No commits without building (`npm run build`), linting (`npm run lint`), and PASSING ALL TESTS (`npm run test`). NO EXCEPTIONS. If tests fail, you MUST fix them before proceeding.
9.  **PROCRASTINATION**: No uncommitted changes. Commit after every TODO completion.
10. **FRIDAY FORBIDDEN**: NO COMMITS OR MAJOR DEPLOYMENTS ON FRIDAYS. Fridays are for testing, documentation, and review ONLY.
11. **TRANSLATION OVERLOAD**: No locale updates on weekdays.
12. **DOCS**: No changes without mirroring to `.codex/`. ทุก dökümantasyon `.codex/` altında toplanmalıdır.
13. **IGNORANCE**: No coding without first reading ALL active rules and commandments. You MUST call `view_file` on rule files at the start of every session.


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
5.  **RECORD**: Update `docs/changelog/data/changelog.entries.json` (English first), run `npm run changelog:sync`, and update `TODO.md`.
6.  **COMMIT**: Commit IMMEDIATELY after TODO completion or minor change. No uncommitted work.
7.  **DELIVER**: Only after purification and commit is complete.

## 📝 COMMIT DISCIPLINE
- **TODO Completion**: Commit immediately after marking a TODO as done.
- **Minor Changes**: Every fix, improvement, or refactor gets its own commit.
- **Pre-Commit Check**: ALWAYS run `npm run build && npm run lint && npm run type-check` before committing.
- **No Errors**: If any check fails, fix errors first. Only commit when all checks pass.


## 🌍 CHANGELOG RULES
- **English First**: ALWAYS update `changelog.entries.json` first.
- **Translations on Weekends**: Locale files (tr, ar, zh, ja) can ONLY be updated on weekends (Saturday-Sunday).
- **No Overload**: Don't write translations for every minor change during weekdays.

---
"Leave no warning behind. Code for performance, type for safety."


