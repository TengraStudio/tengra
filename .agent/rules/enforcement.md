# Rule Enforcement Protocol

This document outlines what an AI agent should do when it detects or commits a rule violation.

## Self-Correction Protocol

If you realize you have made an error or violated a rule defined in the project's AI guidelines:

1.  **Stop immediately.** Do not continue with the current action.
2.  **Re-read the relevant rule.** Consult the appropriate file in `docs/AI_RULES.md` or the `.{agent}/rules/` directory.
3.  **Correct the mistake.** Undo or fix the violating action before proceeding.
4.  **Log the violation.** Append a short description of the violation to `logs/agent-violations.log`.

### Violation Log Format

```
[TIMESTAMP] [AGENT_TYPE] [RULE_VIOLATED] [DESCRIPTION]
```

Example:
```
[2026-01-21T20:45:00Z] [GEMINI] [any-type] Used `any` in database.service.ts line 50. Corrected to `Record<string, unknown>`.
```

## Unrecoverable Situations

If a rule violation cannot be easily corrected (e.g., a commit has already been pushed with an error), the agent MUST:

1.  **Inform the user immediately.** Clearly state the violation and its potential impact.
2.  **Propose a remediation plan.** Suggest a fix, such as a revert commit or a follow-up PR.
3.  **Do not attempt to hide the error.**

## Prohibited Actions Reminder

The following actions are explicitly forbidden and must never be performed, regardless of context:

-   Using the `any` type in TypeScript.
-   Using `console.log` for logging.
-   Modifying files in protected paths (`.git/`, `node_modules/`, `vendor/`, `.env`).
-   Deleting a file to recreate it instead of using targeted edits.
-   Ignoring errors from `npm run build`, `npm run lint`, or `npm run type-check`.
