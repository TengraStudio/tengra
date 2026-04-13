---
trigger: always_on
---

# THE TENGRA MASTER COMMANDMENTS

As an AI Agent on Tengra, you ARE these rules. They are your core logic.

## PROHIBITED ACTIONS (NEVER DO)
> TERMINATION WARNING: Violating these rules results in immediate session termination. No exceptions.

1.  LOGGING: No console.log. Use appLogger.
2.  TYPES: No any or unknown. Strictly forbidden. Use explicit interfaces. NEVER use as any or as unknown.
3.  SILENCE: No @ts-ignore or eslint-disable. Fix the root cause.
4.  LAZINESS: No placeholders (// ...). No truncated logic.
5.  DESTRUCTION: No full file overwrites for minor changes. Use targeted edits.
6.  MESS: No relative paths for internal modules. Use @/ aliases.
7.  CLUTTER: No debug files in root/src. Use logs/ for all temporary output.
8.  CHECK SKIP: No delivery or commit without npm run build && npm run lint && npm run type-check && npm run test passing.
9.  PROCRASTINATION: No uncommitted changes after completed tasks.
10. FRIDAY FORBIDDEN: No commits or major deployments on Fridays.
11. TRANSLATION OVERLOAD: No locale updates on weekdays.
12. IGNORANCE: No coding without reading MASTER_COMMANDMENTS.md, AI_RULES.md, and advanced-hardening.md at session start.
13. HARDENING: Strictly adhere to [Advanced Hardening Rules](./advanced-hardening.md).
14. STYLE CHAOS: No direct Tailwind utility chains in renderer JSX (including src/renderer/components/ui). Use semantic class names only.
15. SINGLE STYLESHEET RULE: Do not create or import additional renderer CSS files. Use src/renderer/index.css only.
16. RULE THEATER: Never mention which rules were applied in delivery messages.
17. NOISE: No slang, sarcastic, or low-signal language. Use clear, concise, professional communication only.


## MANDATORY ACTIONS (ALWAYS DO)
1.  BOY SCOUT RULE: Leave the code cleaner. If you edit a file, you MUST fix at least one existing lint warning or type issue in that file.
2.  PLANNING: Read AI_RULES.md and TODO.md first.
3.  PERFORMANCE: Use useMemo, useCallback, and React.lazy. Optimize for speed.
4.  CLEANUP: Strictly implement dispose() and React effect cleanups.
5.  BATCHING: Batch IPC calls. Never call IPC in loops.
6.  INTELLIGENCE: Utilize specialized Skills and MCP Tools for complex operations.
7.  NASA: Follow the Power of Ten rules for safety and simplicity.
8.  CSS-FIRST UI: In renderer, use semantic classes defined in src/renderer/index.css only, and keep design values tokenized under :root.
9.  OUTPUT QUALITY: Report concrete result, risk, and verification; avoid process narration and motivational filler.

## AVAILABLE SKILLS
Access these via view_file on .{agent}/skills/{skill_name}/SKILL.md:
- build-verify: Ensure code compiles and passing tests.
- ipc-handler: Create secure, typed IPC bridges.
- react-component: Build performant, i18n-ready UI components.
- service-creation: Standardized backend service architecture.
- translation: Manage multi-language support (TR/EN).

## MCP TOOLS
Use these for direct system and environment interaction:
- core: File operations, command execution, system info.
- git: Version control and repository management.
- project: Project scanning, dependency analysis.
- network: Web search, HTTP requests, SSH connections.
- data: Database CRUD and vector search operations.
- security: Security auditing and key management.
- utility: Screenshots, notifications, clipboard interaction.

## WORKFLOW
1.  DISCOVER: Search and read relevant files + check available Skills/MCPs.
2.  VALIDATE: Ensure your plan obeys all NASA rules and fixed-loop bounds.
3.  IMPLEMENT: Targeted edits. Full logic. Fix existing warnings in the file.
4.  PURIFY: Run npm run lint, npm run build, and npm run type-check.
5.  RECORD: Update current markdown docs when behavior changes and update TODO.md.
6.  COMMIT: Commit IMMEDIATELY after TODO completion or minor change. No uncommitted work.
7.  DELIVER: Only after purification and commit is complete.

## COMMIT DISCIPLINE
- TODO Completion: Commit immediately after marking a TODO as done.
- Minor Changes: Every fix, improvement, or refactor gets its own commit.
- Pre-Commit Check: ALWAYS run npm run build && npm run lint && npm run type-check before committing.
- No Errors: If any check fails, fix errors first. Only commit when all checks pass.


## CHANGELOG RULES
- No Structured Source: docs/changelog/data/changelog.entries.json is no longer used in this repo.
- Docs First: Update the current markdown documentation when a user-facing workflow changes.
- Translations on Weekends: Locale files (tr, ar, zh, ja) can ONLY be updated on weekends (Saturday-Sunday).

---
"Leave no warning behind. Code for performance, type for safety."
