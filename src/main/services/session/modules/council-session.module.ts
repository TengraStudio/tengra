import { CouncilCapabilityService } from '@main/services/session/capabilities/council-capability.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { AgentCollaborationService } from '@main/services/workspace/automation-workflow/agent-collaboration.service';
import {
    SessionMode,
    SessionState,
    SessionStatus,
    SessionSubmitMessageOptions,
} from '@shared/types/session-engine';

import { SessionRuntimeModule } from '../base-session-engine.service';

export class CouncilSessionModule implements SessionRuntimeModule {
    readonly id = 'council' as const;

    constructor(
        private readonly eventBus: EventBusService,
        private readonly collaborationService: AgentCollaborationService,
        private readonly councilCapabilityService: CouncilCapabilityService
    ) {}

    supportsMode(mode: SessionMode): boolean {
        return ['chat', 'workspace', 'automation'].includes(mode);
    }

    async onAttach(state: SessionState): Promise<void> {
        this.eventBus.emitCustom('session:capability:council', {
            phase: 'attached',
            sessionId: state.id,
            mode: state.mode,
            taskId: state.metadata.taskId ?? null,
        });
    }

    async onBeforeMessage(
        state: SessionState,
        options: SessionSubmitMessageOptions
    ): Promise<void> {
        const preview = options.message.content.slice(0, 160);
        const taskId = state.metadata.taskId;

        if (taskId) {
            this.collaborationService.recordAgentTaskProgress({
                agentId: state.model.model,
                status: 'in_progress',
                taskId,
                reason: `Council capability observed message: ${preview}`,
            });
        }

        this.eventBus.emitCustom('session:capability:council', {
            phase: 'message',
            sessionId: state.id,
            mode: state.mode,
            taskId: taskId ?? null,
            preview,
        });
    }

    async onStatusChange(state: SessionState, previousStatus: SessionStatus): Promise<void> {
        this.eventBus.emitCustom('session:capability:council', {
            phase: 'status',
            sessionId: state.id,
            mode: state.mode,
            taskId: state.metadata.taskId ?? null,
            previousStatus,
            nextStatus: state.status,
            councilReady: typeof this.councilCapabilityService.prepareCouncilPlan === 'function',
        });
    }
}
