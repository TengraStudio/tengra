# Session Engine Architecture

This mirrors `docs/architecture/SESSION_ENGINE.md`.

## Canonical Runtime

- `chat`
- `workspace`
- `automation`

Canonical public runtime:

- `window.electron.session`
- `window.electron.modelCollaboration`
- `window.electron.liveCollaboration`

## Capability Model

- `council`
- `tools`
- `workspace_context`
- `task_planning`
- `task_execution`
- `rag`
- `image_generation`
- `checkpoints`
- `recovery`

`Council` is a session capability, not a workflow-only subsystem.

## Collaboration Naming

- `modelCollaboration`: multi-model orchestration
- `liveCollaboration`: room/presence sync
- `session.council`: planning, voting, debate, helper coordination

Temporary aliases:

- `window.electron.collaboration`
- `window.electron.userCollaboration`

New code must prefer canonical names.

## Recovery Contract

Every session state/snapshot exposes:

- `canResume`
- `requiresReview`
- `action`
- `lastTransitionAt`
- `hint`
- `lastMessagePreview` on snapshots

Recovery actions:

- `none`
- `resume_conversation`
- `resume_workspace`
- `resume_automation`
- `review_before_resume`

## Deferred Cleanup

Backup-related surfaces intentionally remain out of the session migration:

- `backup.preload.ts`
- `backup-scheduler.ts`
