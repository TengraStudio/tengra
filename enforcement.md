# ⚖️ ENFORCEMENT & PROHIBITED ACTIONS

## 🚫 ZERO TOLERANCE (Immediate Failure)
- **LOOSE TYPES**: Usage of `any`, `unknown`, or `as any`.
- **SILENT LOGS**: `console.log` or swallowing errors.
- **JSX CHAOS**: Tailwind utility chains in JSX (use semantic classes in `index.css`).
- **CSS CLUTTER**: Importing any CSS files in renderer except `index.css`.
- **LAZINESS**: Truncated code, placeholders, or skipping build/lint.
- **STYLE DRIFT**: Deviating from **Simple & Minimal** design (e.g. Cyber/Premium).

## 🔨 SELF-CORRECTION PROTOCOL
If you detect a violation (yours or existing):
1. **FIX**: Correct the violation immediately.
2. **SCOUT**: Fix at least one additional lint/type issue in the file.
3. **LOG**: Record in `logs/agent-violations.log`.
4. **REPORT**: Briefly inform the user in the delivery message.

## 📝 VIOLATION LOG FORMAT
`[TIMESTAMP] [AGENT] [RULE] [DESCRIPTION]`

"Integrity means doing it right even when no one is looking."
