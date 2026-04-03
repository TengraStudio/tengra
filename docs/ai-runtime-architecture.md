# AI Runtime Architecture

## Goal

Tengra should not rely on provider-specific prompt behavior for core orchestration.
The runtime must make deterministic decisions about:

- intent classification
- tool loop budgets
- repeated tool handling
- assistant presentation metadata
- visible reasoning style

This document defines the current runtime organization and the boundaries each module owns.

## Core Principles

1. Prompt is not the orchestration engine.
2. Tool results are runtime evidence, not only conversation text.
3. Provider output must be normalized before UI rendering.
4. User-visible assistant style must stay consistent across providers and surfaces.
5. Session chat, workspace chat, and standard chat should share the same runtime contract.

## Current Runtime Layers

### 1. Shared Intent and Presentation Contract

Files:

- `src/shared/types/ai-runtime.ts`
- `src/shared/utils/ai-runtime.util.ts`

Responsibilities:

- classify user intent into stable runtime categories
- define tool-loop budgets from intent
- normalize tool call signatures
- build provider-agnostic presentation metadata
- extract normalized evidence entries from tool results
- compose deterministic answers for simple lookup flows when model output stays low-signal

This layer is provider-independent and shared by renderer and main-process consumers.

### 2. Shared Prompt Builder

Files:

- `src/shared/instructions.ts`
- `src/renderer/lib/identity.ts`
- `src/main/ipc/session-conversation.ts`
- `src/main/ipc/session-conversation-runtime.util.ts`
- `src/main/ipc/session-conversation-prompt.util.ts`

Responsibilities:

- locale-aware system prompt construction
- marketplace locale-pack prompt support
- provider compatibility instructions
- visible response contract
- anti-loop tool guidance
- shared locale metadata mapping for renderer and main-process prompt injection

Important rule:
Prompt instructions support runtime policy, but do not replace it.

### 3. Renderer Chat Runtime Policy

Files:

- `src/renderer/features/chat/hooks/chat-runtime-policy.util.ts`
- `src/renderer/features/chat/hooks/tool-loop.util.ts`
- `src/renderer/features/chat/hooks/tool-turn-management.util.ts`
- `src/renderer/features/chat/hooks/tool-call-execution.util.ts`
- `src/renderer/features/chat/hooks/tool-batch-execution.util.ts`
- `src/renderer/features/chat/hooks/tool-turn-loop-execution.util.ts`
- `src/renderer/features/chat/hooks/tool-evidence-store.util.ts`
- `src/renderer/features/chat/hooks/ai-runtime-chat.util.ts`

Responsibilities:

- determine image-only flows
- validate executable tool calls
- prevent repeated same-signature tool execution
- centralize turn-local tool evidence state instead of scattering maps/arrays in the hook
- isolate the model/tool turn loop so the hook only coordinates chat entry and state wiring
- manage low-signal recovery turns
- finalize assistant state from accumulated evidence
- emit normalized assistant metadata

These modules exist so `useChatGenerator.ts` remains an orchestration entrypoint instead of a monolith.

### 4. Message Preparation and Persistence

Files:

- `src/renderer/features/chat/hooks/message-preparation.util.ts`
- `src/renderer/features/chat/hooks/message-persistence.util.ts`
- `src/renderer/features/chat/hooks/process-stream.ts`

Responsibilities:

- build provider-ready message arrays
- persist assistant/tool state
- update streaming UI state
- preserve normalized metadata across throttled streaming and final writes

### 5. Unified Presentation Layer

Files:

- `src/renderer/features/chat/components/message/AiPresentationPanel.tsx`
- `src/renderer/features/chat/components/message/SingleMessageViewContent.tsx`
- `src/renderer/features/chat/components/message/PermissionErrorCard.tsx`
- `src/renderer/features/chat/components/message/ToolRecoveryNotice.tsx`
- `src/renderer/features/chat/components/message/MessageBubble.types.ts`
- `src/renderer/features/chat/components/message/MessageBubbleContent.util.ts`
- `src/renderer/features/chat/components/message/message-bubble-compare.util.ts`
- `src/renderer/features/chat/components/message/message-presentation.util.ts`
- `src/renderer/features/chat/components/message/MessageUtils.ts`
- `src/renderer/features/chat/components/MessageBubble.tsx`

Responsibilities:

- convert assistant metadata into one visible UI style
- suppress raw hidden reasoning when normalized presentation exists
- keep provider output visually consistent
- preserve compact evidence-oriented summaries
- keep permission, recovery, and single-message layout elements shared across chat surfaces

### 6. Session and Workspace Surfaces

Files:

- `src/main/ipc/session-conversation-runtime.util.ts`
- `src/main/ipc/session-conversation-prompt.util.ts`
- `src/main/ipc/session-conversation-rag.util.ts`
- `src/main/ipc/session-conversation-validation.util.ts`
- `src/main/ipc/session-conversation-persistence.util.ts`
- `src/main/ipc/session-conversation-stream-ipc.util.ts`
- `src/main/ipc/session-conversation-stream-evidence.util.ts`
- `src/main/ipc/session-conversation.ts`
- `src/renderer/hooks/session-conversation-stream-consumer.util.ts`
- `src/renderer/hooks/useSessionConversationStream.ts`
- `src/renderer/features/workspace/hooks/useWorkspaceChatStream.ts`

Responsibilities:

- reuse shared system prompt construction
- keep session prompt and RAG helpers out of the IPC manager so the manager stays orchestration-focused
- keep session request sanitization and reasoning-option parsing in dedicated runtime helpers
- reuse shared intent classification
- emit normalized assistant presentation metadata
- persist main-process assistant records with the same runtime metadata contract
- keep streamed assistant persistence, session-envelope writes, and token accounting in dedicated helpers instead of in the IPC manager
- return complete-response metadata for non-stream session consumers
- centralize session stream evidence accumulation for both proxy and opencode paths
- isolate binary/plain stream chunk transport from conversation orchestration
- keep renderer session stream consumption separate from the hook shell so UI state and stream transport logic do not collapse back together
- keep workspace chat behavior aligned with main chat behavior

## Runtime Data Flow

1. User sends a message.
2. Runtime classifies intent.
3. Runtime chooses tool budget and response mode.
4. Prompt builder constructs locale/provider-aware system instructions with locale-pack metadata in both renderer and main-process flows.
5. Stream processing normalizes content, reasoning, variants, and tool calls.
6. Tool execution stores structured evidence and repeated-call protection is applied.
7. Assistant metadata is rebuilt from normalized runtime evidence.
8. Main-process persistence and non-stream session results carry the same assistant metadata contract.
9. UI renders a single presentation style regardless of upstream provider.

## Non-Negotiable Rules

- Do not reintroduce provider-specific visible reasoning rendering.
- Do not add prompt-only fixes for runtime orchestration problems.
- Do not let the same tool+args execute twice in one turn unless the runtime explicitly marks it as new evidence.
- Do not add new chat surfaces without wiring `aiPresentation` metadata.

## Next Recommended Refactor Steps

1. Introduce a dedicated evidence store abstraction if tool results need to survive beyond a single runtime turn.
2. Replace remaining session-stream-specific helpers with shared runtime modules where the call paths overlap.
3. Introduce a dedicated evidence store abstraction for main-process session orchestration and deterministic answer composition.
