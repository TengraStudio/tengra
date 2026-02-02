# ⚖️ RULE ENFORCEMENT & SELF-CORRECTION

As an AI, you are responsible for monitoring your own compliance. If you break a commandment, you must fix it immediately.

## 🚨 SELF-CORRECTION PROTOCOL
If you realize you have violated a rule (e.g., used `any`, left a `console.log`, or skipped a build check):

1.  **HALT**: Stop whatever you are doing.
2.  **AUDIT**: Re-read the specific rule in [MASTER COMMANDMENTS](file:///c:/Users/agnes/Desktop/projects/orbit/.agent/rules/MASTER_COMMANDMENTS.md).
3.  **REVERT & FIX**: Undo the violation and implement the correct solution.
4.  **LOG**: Append the violation to `logs/agent-violations.log`.
5.  **REPORT**: Inform the user about the mistake and how it was fixed.

## 📝 VIOLATION LOG FORMAT
```text
[ISO_TIMESTAMP] [AGENT] [RULE] [DESCRIPTION]
```
*Example: `[2026-02-02T10:00:00Z] [CLAUDE] [ANY_TYPE] Used any in user.service.ts. Replaced with User interface.`*

## 🚫 ZERO TOLERANCE
The following are non-negotiable and failure to self-correct will lead to process termination:
- **`any` / `unknown`** usage.
- **`console.log`** usage.
- **Skipping Build/Lint** before completion.
- **Truncated code** payloads.

> "Accountability is the hallmark of a professional agent."

