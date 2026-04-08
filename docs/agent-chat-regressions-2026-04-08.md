# Agent Chat Regressions Report

Date: 2026-04-08

## Status

The issues are not fully resolved. Multiple regressions are still observable in the chat agent flow.

## User-visible problems

### 1. Thought rendering still does not behave like persistent Antigravity-style thought blocks

Observed behavior:

- The assistant still appears to update the current assistant message instead of behaving like a clean sequence of persistent thought entries followed by a normal final answer.
- In practice, the user experience still feels like "one message keeps changing" rather than "new thought block started, thought block finished, next thought block started".

Expected behavior:

- Each new reasoning phase should appear as a persistent thought block in chat history.
- The final answer should render as a normal assistant message, outside the thought block flow.
- Thought blocks must remain visible after streaming completes.

Current likely cause:

- The UI still depends on the normal assistant message lifecycle and streaming placeholder flow.
- Reasoning state is being derived from the same assistant message identity, so the display still behaves like a mutated message stream instead of a true event log.
- The renderer flattening logic was improved, but the runtime model/message lifecycle still treats thoughts as part of the same assistant turn.

Affected areas:

- `src/renderer/features/chat/components/MessageList.tsx`
- `src/renderer/features/chat/components/message/SingleMessageViewContent.tsx`
- `src/renderer/features/chat/components/message/message-bubble-compare.util.ts`
- `src/renderer/features/chat/hooks/process-stream.ts`

## 2. The assistant enters repetition loops and starts spamming the same wording or tool family

Observed behavior:

- After some time, the assistant starts repeating the same phrases.
- It may repeatedly call the same tool or the same intent-equivalent tool call with only small argument variations.
- In real usage, the user may need to manually stop the stream.

Expected behavior:

- Repeated tool intent should be detected early and converted into a final answer or a different tool strategy.
- Cached or previously returned evidence should not be treated as fresh progress.
- Low-signal filler responses should force termination or deterministic finalization much earlier.

Current likely cause:

- The anti-loop guard is still too literal for tool-family repetition.
- The model can bypass repetition detection by changing only the path string while preserving the same underlying intent.
- Example observed pattern:
  - `resolve_path("~/Desktop/todo-app")`
  - `resolve_path("~/Desktop/nextjs-todo-app")`
  - `resolve_path("%USERPROFILE%/Desktop/todo-app")`
- These calls are semantically close enough to be treated as a repeated exploration pattern, but the runtime still allows them to extend the turn.
- The loop safety policy is better than before, but still not strict enough for path-resolution churn and wording churn.

Log evidence:

- `C:\Users\agnes\AppData\Roaming\Tengra\logs\2026-04-08\session-21-50-38-40952.log`
- Repeated `resolve_path` calls and cache hits were observed in that session.

Affected areas:

- `src/renderer/features/chat/hooks/tool-turn-loop-execution.util.ts`
- `src/shared/utils/ai-runtime.util.ts`
- `src/renderer/features/chat/hooks/ai-runtime-chat.util.ts`
- `src/shared/instructions.ts`

## 3. The assistant still emits incomplete or low-quality tool calls

Observed behavior:

- Required tool parameters are still sometimes omitted.
- Some invalid tool calls are blocked locally now, but the model still generates them.
- This means the runtime is catching part of the failure, but the prompting/tool-use policy is still not strong enough.

Expected behavior:

- The model should not emit tool calls with missing required arguments.
- If the required argument is unknown, the assistant should infer it, resolve it first, or stop and answer from available evidence.

Current likely cause:

- Runtime validation exists, but validation alone does not solve the generation problem.
- The system prompt and tool descriptions are still insufficient to prevent malformed tool emission under agentic pressure.
- The model continues to "try something" instead of pausing when the argument is unknown.

Affected areas:

- `src/renderer/features/chat/hooks/tool-call-execution.util.ts`
- `src/main/tools/tool-definitions.ts`
- `src/shared/instructions.ts`

## 4. Oversized streaming content has caused session instability before, and the loop pattern increases the chance of recurrence

Observed behavior:

- Earlier logs showed the session state exceeding the IPC schema size limit for message content.
- Once that happens, even `session:get-state` can fail.

Evidence already observed:

- `messages.5.content` exceeded the 200000-character limit in an earlier 2026-04-08 session log.

Why this still matters:

- If the agent loops and keeps appending low-signal or repeated content, the system can drift back toward the same failure mode.

Affected areas:

- `src/renderer/features/chat/hooks/process-stream.ts`
- `src/main/services/session/session-directory.service.ts`

## Root cause summary

This does not look like one bug. It is a layered failure:

1. The UI message model still does not represent thoughts as first-class persistent chat events.
2. The anti-loop system is still too weak against semantic repetition with slight argument variation.
3. Tool argument validation happens too late in the pipeline to prevent bad generation behavior.
4. The prompt/tool contract still allows the model to "keep trying" instead of converging.
5. Cached evidence and repeated path-resolution work are still not treated aggressively enough as "no new progress".

## What is still needed

### A. Convert thought blocks into first-class chat events

Do not model them only as `reasonings[]` attached to one assistant message.

Instead:

- introduce a dedicated display/event model for thought entries
- persist them separately from the final assistant answer
- render them as independent chat history rows

### B. Add semantic tool-family loop detection

The loop guard should stop not only exact duplicate signatures, but also repeated calls inside the same intent family.

Examples:

- repeated `resolve_path` calls for the same parent target
- repeated directory/path probing after successful path evidence already exists
- repeated "thinking/progress" content without new evidence

### C. Enforce required-argument gating before model continuation

If a tool call is malformed:

- record the invalid call
- count it as negative progress
- raise loop pressure immediately
- do not let the model continue for many more turns in the same pattern

### D. Strengthen prompt instructions for tool convergence

The prompt should explicitly say:

- never retry the same tool family for the same target after one successful result
- never issue a required argument as an empty placeholder
- once path evidence exists, move to creation/writing/finalization instead of resolving again

## Recommended next debugging target

The next investigation should focus on the live path from streamed model output to rendered chat rows:

1. Inspect how streamed reasoning is attached to the placeholder assistant message.
2. Inspect how display entries are built from assistant messages during streaming.
3. Inspect why the runtime still allows repeated `resolve_path` exploration after a successful resolution result.
4. Add explicit log lines for:
   - assistant turn state transitions
   - reasoning-segment creation
   - loop-break decisions
   - malformed tool call suppression
   - semantic repetition detection

## Reference logs

- `C:\Users\agnes\AppData\Roaming\Tengra\logs\2026-04-08\session-21-50-38-40952.log`
- `C:\Users\agnes\AppData\Roaming\Tengra\logs\2026-04-08\session-21-35-24-15120.log`
- `C:\Users\agnes\AppData\Roaming\Tengra\logs\2026-04-08\session-19-18-13-19900.log`
