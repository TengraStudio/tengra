import { EventBusService } from '@main/services/system/event-bus.service';
import {
    SessionMode,
    SessionState,
    SessionSubmitMessageOptions,
} from '@shared/types/session-engine';

import { SessionRuntimeModule } from '../base-session-engine.service';

export class WorkspaceContextSessionModule implements SessionRuntimeModule {
    readonly id = 'workspace_context' as const;

    constructor(private readonly eventBus: EventBusService) {}

    supportsMode(mode: SessionMode): boolean {
        return mode === 'workspace' || mode === 'automation';
    }

    async onAttach(state: SessionState): Promise<void> {
        this.eventBus.emitCustom('session:capability:workspace-context', {
            phase: 'attached',
            sessionId: state.id,
            mode: state.mode,
            workspaceId: state.metadata.workspaceId ?? null,
        });
    }

    async onBeforeMessage(
        state: SessionState,
        options: SessionSubmitMessageOptions
    ): Promise<void> {
        this.eventBus.emitCustom('session:capability:workspace-context', {
            phase: 'message',
            sessionId: state.id,
            workspaceId: state.metadata.workspaceId ?? null,
            role: options.message.role,
        });
    }
}
