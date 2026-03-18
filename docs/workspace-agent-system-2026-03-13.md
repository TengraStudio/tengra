# Workspace Agent System Notes

Date: 2026-03-13
Status: In progress
Scope: Right-side workspace agent panel, workspace-scoped sessions, council flow, permissions, session lifecycle, panel redesign

## 1. Purpose

This document records:

1. What was changed today for the workspace-specific agent system.
2. What the system currently does.
3. Which parts are already working.
4. Which parts still need work.
5. The recommended implementation order for remaining work.

This is the new system that lives in the right-side panel inside a workspace view. It is no longer treated as a generic global chat. It is now a workspace-scoped execution surface.

## 2. Product Direction

The right panel is being turned into a workspace-native agent surface with these principles:

1. Sessions belong to a workspace.
2. Sessions persist and can continue in the background.
3. A real session is not created until the user sends the first message.
4. `Council` is a dedicated orchestration layer inside the same panel.
5. `Plan` is not a separate end state. Once approved, execution proceeds like agent behavior.
6. Permissions are session-scoped.
7. Model/provider selection is quota-aware and can fall back.

## 3. High-Level Architecture Added

The new system now has these main layers:

1. Shared domain types and schemas for workspace-agent sessions, council runtime, permissions, quotas, and telemetry.
2. Main-process IPC for workspace-agent session CRUD and session state updates.
3. Preload bridge exposure for renderer access.
4. Renderer session orchestration hooks.
5. Redesigned right-panel UI components.
6. Council runtime mutation helpers.
7. Renderer tests for session controls, council runtime, and council board flows.

## 4. What Was Implemented Today

### 4.1 Shared contracts and IPC surface

The workspace-agent system now has dedicated shared types and validated IPC support.

Implemented:

1. Workspace-agent session types.
2. Council runtime types.
3. Permission policy types.
4. Context telemetry types.
5. Normalized quota and fallback candidate types.
6. IPC channels and preload bridge for workspace-agent session operations.

Primary files:

1. [workspace-agent-session.ts](c:/Users/agnes/Desktop/projects/tengra/src/shared/types/workspace-agent-session.ts)
2. [workspace-agent-session.schema.ts](c:/Users/agnes/Desktop/projects/tengra/src/shared/schemas/workspace-agent-session.schema.ts)
3. [workspace-agent-session.ts](c:/Users/agnes/Desktop/projects/tengra/src/main/ipc/workspace-agent-session.ts)
4. [workspace-agent-session.preload.ts](c:/Users/agnes/Desktop/projects/tengra/src/main/preload/domains/workspace-agent-session.preload.ts)
5. [session.preload.ts](c:/Users/agnes/Desktop/projects/tengra/src/main/preload/domains/session.preload.ts)

### 4.2 Workspace-scoped session management

The panel is now backed by real workspace sessions rather than a simple chat-only surface.

Implemented:

1. Create, select, rename, archive, and persist workspace-agent sessions.
2. Session persistence per workspace.
3. Session summary hydration from chat records.
4. Background resume handling.
5. Lazy session creation on first user message.

Primary files:

1. [useWorkspaceAgentSessions.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/hooks/useWorkspaceAgentSessions.ts)
2. [useWorkspaceAgentSessionManagement.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/hooks/useWorkspaceAgentSessionManagement.ts)
3. [useWorkspaceAgentSessionMessaging.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/hooks/useWorkspaceAgentSessionMessaging.ts)
4. [useWorkspaceAgentSessionState.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/hooks/useWorkspaceAgentSessionState.ts)
5. [workspace-agent-session-utils.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/utils/workspace-agent-session-utils.ts)

### 4.3 Right panel redesign

The right panel is no longer a minimal AI chat column. It now has a workspace-agent shell layout.

Implemented:

1. Session header or session list at the top.
2. Main middle surface that adapts to chat vs council.
3. Persistent composer area at the bottom.
4. Session picker modal.
5. Selected-session context telemetry display.
6. Session archive action in header and recent-session rail.

Primary files:

1. [AIAssistantSidebar.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/AIAssistantSidebar.tsx)
2. [WorkspaceAgentPanelHeader.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentPanelHeader.tsx)
3. [WorkspaceAgentConversation.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentConversation.tsx)
4. [WorkspaceAgentComposer.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentComposer.tsx)
5. [WorkspaceAgentSessionModal.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentSessionModal.tsx)

### 4.4 Council runtime and board behavior

The council system is no longer treated as a static placeholder. It now mutates runtime/session state.

Implemented:

1. Review decisions mutate runtime state.
2. Assist handoffs mutate runtime state.
3. Inter-agent discussion mutates runtime state.
4. Council board view and council map view exist inside the session flow.
5. Chairman review queue behavior is surfaced in the panel.
6. Draft submission and review actions are wired.

Primary files:

1. [workspace-agent-council-runtime.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/utils/workspace-agent-council-runtime.ts)
2. [useWorkspaceAgentSessionCouncil.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/hooks/useWorkspaceAgentSessionCouncil.ts)
3. [WorkspaceAgentCouncilBoard.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentCouncilBoard.tsx)

### 4.5 Quota normalization and routing

A quota-aware routing layer was added so the system can rank model/provider candidates and hand off when quota conditions change.

Implemented:

1. Normalized quota snapshot shape.
2. Shared bucket modeling.
3. Reasoning-weighted candidate ranking.
4. Local-model bonus for simple tasks.
5. Council chairman and subagent recommendation helpers.

Primary files:

1. [workspace-agent-routing.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/utils/workspace-agent-routing.ts)

### 4.6 Permission editing

Session permission policies are editable at runtime and enforced as part of the workspace-agent flow.

Implemented:

1. Command policy support.
2. Path policy support.
3. Allowlist editing UI for commands and paths when allowlist modes are active.
4. Session-scoped permission updates.

Primary files:

1. [WorkspaceAgentPermissionEditor.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentPermissionEditor.tsx)
2. [useWorkspaceAgentSessions.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/hooks/useWorkspaceAgentSessions.ts)

### 4.7 Context telemetry and handoff visibility

The selected session header now surfaces context and provider handoff state.

Implemented:

1. Context usage bar.
2. Used tokens, context window, remaining tokens.
3. Pressure state badge.
4. Handoff count and last handoff summary.

Primary files:

1. [WorkspaceAgentPanelHeader.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentPanelHeader.tsx)
2. [WorkspaceAgentConversation.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentConversation.tsx)

### 4.8 Session archive flow

Session archiving was added as a visible feature, not only a hidden state update.

Implemented:

1. Archive/unarchive from session picker modal.
2. Archive action from recent session list at the top of the panel.
3. Archive action from selected session header.
4. Archived sessions removed from recent-session rail.
5. Archived sessions still available in the full picker.

Primary files:

1. [WorkspaceAgentPanelHeader.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentPanelHeader.tsx)
2. [WorkspaceAgentSessionModal.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentSessionModal.tsx)
3. [useWorkspaceAgentSessions.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/hooks/useWorkspaceAgentSessions.ts)

### 4.9 Session filtering from normal sidebar chat lists

Workspace-agent sessions should not appear as normal global/sidebar chat sessions.

Implemented:

1. Workspace-agent sessions are tagged with workspace-agent session metadata and dedicated chat type behavior.
2. The normal chat sidebar filters them out.

Primary files:

1. [workspace-agent-session.ts](c:/Users/agnes/Desktop/projects/tengra/src/shared/types/workspace-agent-session.ts)
2. [workspace-agent-session.ts](c:/Users/agnes/Desktop/projects/tengra/src/main/ipc/workspace-agent-session.ts)
3. [useChatManager.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/chat/hooks/useChatManager.ts)

### 4.10 Council setup redesign

The council setup sheet that opens from the `Council` button was simplified today.

Implemented:

1. Removed duplicated command/path policy badges from the council setup surface.
2. Kept the setup focused on:
   - chairman mode
   - strategy
   - subagent count
   - manual provider/model binding when manual mode is selected
3. Added a more readable summary area for those council choices.

Primary file:

1. [WorkspaceAgentCouncilSetup.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentCouncilSetup.tsx)

### 4.11 Stability and bug fixes completed during the work

Fixed during this implementation:

1. `chat.updatedAt.getTime is not a function`
2. `workspace:clearActive` null/undefined schema failure
3. secondary error-boundary crash cascade
4. typed logging issue in IPC validation that broke `npm run type-check`

Primary files:

1. [workspace-agent-session-utils.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/utils/workspace-agent-session-utils.ts)
2. [workspace.ts](c:/Users/agnes/Desktop/projects/tengra/src/main/ipc/workspace.ts)
3. [workspace.preload.ts](c:/Users/agnes/Desktop/projects/tengra/src/main/preload/domains/workspace.preload.ts)
4. [ErrorBoundary.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/components/shared/ErrorBoundary.tsx)
5. [ipc-wrapper.util.ts](c:/Users/agnes/Desktop/projects/tengra/src/main/utils/ipc-wrapper.util.ts)

## 5. Current User-Facing Behavior

As of this document, the system behaves like this:

### 5.1 Empty panel state

1. No real session exists until the user sends the first message.
2. Pressing the top `new session` button returns the panel to the empty state instead of eagerly creating a session.
3. Recent sessions are listed at the top, up to 5 visible entries.

### 5.2 Selected session state

1. The header shows session title, context telemetry, mode indicators, permission tone, handoff data, and background status.
2. The middle area shows:
   - normal conversation timeline if council is not active
   - council board or council map if council is active
3. The bottom composer contains:
   - input
   - send/stop button
   - settings dropdown
   - council button
   - icon-only model selector

### 5.3 Council setup state

When the user presses the `Council` button:

1. An inline setup sheet opens above the composer.
2. The sheet currently lets the user choose:
   - chairman mode
   - strategy
   - requested subagent count
   - provider/model if manual chairman mode is selected
3. The setup sheet no longer repeats command/path policy badges.

### 5.4 Permissions

1. Command and path policy controls still live in the normal settings dropdown and the allowlist editor.
2. Allowlist editing remains active when permission policies are set to `allowlist`.

### 5.5 Archiving

1. Sessions can be archived from the recent-session rail.
2. Sessions can be archived from the selected-session header.
3. Sessions can be archived/unarchived from the full session picker modal.
4. Archived sessions do not stay in the recent-session rail.

## 6. Files Most Relevant To The System

If someone continues this work, these files are the main entry points:

### 6.1 Renderer entry and shell

1. [AIAssistantSidebar.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/AIAssistantSidebar.tsx)
2. [WorkspaceSidebar.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceSidebar.tsx)
3. [WorkspaceDetails.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/WorkspaceDetails.tsx)

### 6.2 Renderer hooks

1. [useWorkspaceAgentSessions.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/hooks/useWorkspaceAgentSessions.ts)
2. [useWorkspaceAgentSessionManagement.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/hooks/useWorkspaceAgentSessionManagement.ts)
3. [useWorkspaceAgentSessionMessaging.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/hooks/useWorkspaceAgentSessionMessaging.ts)
4. [useWorkspaceAgentSessionCouncil.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/hooks/useWorkspaceAgentSessionCouncil.ts)
5. [useWorkspaceAgentSessionTelemetry.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/hooks/useWorkspaceAgentSessionTelemetry.ts)

### 6.3 Renderer components

1. [WorkspaceAgentPanelHeader.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentPanelHeader.tsx)
2. [WorkspaceAgentComposer.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentComposer.tsx)
3. [WorkspaceAgentCouncilSetup.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentCouncilSetup.tsx)
4. [WorkspaceAgentCouncilBoard.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentCouncilBoard.tsx)
5. [WorkspaceAgentConversation.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentConversation.tsx)
6. [WorkspaceAgentPermissionEditor.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentPermissionEditor.tsx)
7. [WorkspaceAgentSessionModal.tsx](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/components/workspace/WorkspaceAgentSessionModal.tsx)

### 6.4 Main and shared contracts

1. [workspace-agent-session.ts](c:/Users/agnes/Desktop/projects/tengra/src/shared/types/workspace-agent-session.ts)
2. [workspace-agent-session.schema.ts](c:/Users/agnes/Desktop/projects/tengra/src/shared/schemas/workspace-agent-session.schema.ts)
3. [workspace-agent-session.ts](c:/Users/agnes/Desktop/projects/tengra/src/main/ipc/workspace-agent-session.ts)
4. [workspace-agent-session.preload.ts](c:/Users/agnes/Desktop/projects/tengra/src/main/preload/domains/workspace-agent-session.preload.ts)

### 6.5 Utilities

1. [workspace-agent-session-utils.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/utils/workspace-agent-session-utils.ts)
2. [workspace-agent-council-runtime.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/utils/workspace-agent-council-runtime.ts)
3. [workspace-agent-routing.ts](c:/Users/agnes/Desktop/projects/tengra/src/renderer/features/workspace/utils/workspace-agent-routing.ts)

### 6.6 Tests

1. [workspace-agent-panel-controls.test.tsx](c:/Users/agnes/Desktop/projects/tengra/src/tests/renderer/features/workspace/workspace-agent-panel-controls.test.tsx)
2. [workspace-agent-council-runtime.test.ts](c:/Users/agnes/Desktop/projects/tengra/src/tests/renderer/features/workspace/workspace-agent-council-runtime.test.ts)
3. [workspace-agent-council-board.test.tsx](c:/Users/agnes/Desktop/projects/tengra/src/tests/renderer/features/workspace/workspace-agent-council-board.test.tsx)
4. [workspace-agent-session-utils.test.ts](c:/Users/agnes/Desktop/projects/tengra/src/tests/renderer/features/workspace/workspace-agent-session-utils.test.ts)

## 7. Remaining Work

This section lists what still needs to be done.

### 7.1 UI and UX refinements

1. Replace remaining hardcoded workspace-agent labels once locale freeze allows locale edits.
2. Review the council setup copy and labels with real translated keys instead of raw internal strategy strings where needed.
3. Refine empty-state messaging so it explains draft state vs real session state more clearly.
4. Revisit the selected-session header density if more runtime signals are added.
5. Audit the bottom composer controls for narrow-width behavior and overflow.

### 7.2 Council setup improvements

1. Make the council setup even more self-explanatory without relying on internal raw values.
2. Surface why a strategy matters:
   - reasoning-oriented
   - balanced
   - local-first-simple
3. Surface what subagent count means in practice.
4. Show the manual chairman binding more clearly when manual mode is enabled.
5. Decide whether the setup needs a dedicated advanced section later.

### 7.3 Council execution depth

1. Wire real isolated subagent workspaces more deeply if current draft abstraction is not enough.
2. Expand the chairman review experience for approve/reject/revise/reassign decisions.
3. Improve merge/review visibility for draft packages.
4. Expand inter-agent discussion UI beyond the current board activity feed if needed.
5. Keep `Board` as the readable source of truth and treat `Map` as secondary.

### 7.4 Model routing and quota visibility

1. Continue improving model selection transparency.
2. Show why a provider/model handoff happened in more explicit language.
3. Add clearer visual distinctions when local fallback is used.
4. Validate bucket grouping behavior against all provider edge cases.
5. Add more targeted tests for shared quota buckets and request-limit behavior.

### 7.5 Session lifecycle and persistence

1. Verify all edge cases around draft council setup before first message.
2. Verify session background continuation behavior across workspace switches and app reloads.
3. Confirm archived session behavior across persistence reloads.
4. Continue guarding against malformed chat dates and stale metadata records.

### 7.6 Permissions

1. Revisit whether command/path controls should stay in the generic settings dropdown or move into a more explicit safety surface.
2. Clarify the difference between `allowlist`, `ask-every-time`, and dangerous modes visually.
3. Add more tests for runtime enforcement, not just UI mutation.

## 8. Recommended Next Implementation Order

If work continues tomorrow or later, this is the recommended order:

1. Finish the council setup UX pass.
   Reason: this is the current active surface the user is iterating on.

2. Clean up remaining hardcoded panel copy once locale edits are allowed.
   Reason: several labels currently rely on raw internal values or fallback copy.

3. Strengthen isolated subagent workspace and review flow.
   Reason: council quality depends on clear ownership and merge gates.

4. Improve quota and fallback visibility in the live timeline and setup stage.
   Reason: model switching is core to this system and must be understandable.

5. Add more renderer and integration coverage around:
   - archive behavior
   - first-message lazy creation
   - council setup transitions
   - provider handoff visibility

6. Re-evaluate whether the permission controls deserve a separate surface later.
   Reason: current behavior works, but the product model is growing more complex.

## 9. Validation Completed Today

During the work today, these checks were run successfully at different stages:

1. `npm run lint`
2. `npm run type-check`
3. `npm run build`
4. `npx vitest run --config vitest.config.renderer.ts src/tests/renderer/features/workspace/workspace-agent-panel-controls.test.tsx`

Additional targeted renderer and integration tests were also expanded earlier in the day for workspace-agent runtime behavior.

## 10. Notes

1. No commit was created because today is Friday and repository rules forbid commits on Fridays.
2. Locale files were intentionally not edited because weekday locale freeze rules are active.
3. This document is a working engineering note, not an end-user spec.
