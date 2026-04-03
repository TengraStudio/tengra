import { EventBusService } from '@main/services/system/event-bus.service';
import {
    SessionMode,
    SessionState,
    SessionStatus,
} from '@shared/types/session-engine';

import { SessionRuntimeModule } from '../base-session-engine.service';

export class TaskExecutionSessionModule implements SessionRuntimeModule {
    readonly id = 'task_execution' as const;

    constructor(private readonly eventBus: EventBusService) {}

    supportsMode(mode: SessionMode): boolean {
        return mode === 'automation';
    }

    async onAttach(state: SessionState): Promise<void> {
        this.eventBus.emitCustom('session:capability:task-execution', {
            phase: 'attached',
            sessionId: state.id,
            taskId: state.metadata.taskId ?? null,
        });
    }

    async onStatusChange(state: SessionState, previousStatus: SessionStatus): Promise<void> {
        if (!['streaming', 'completed', 'failed', 'paused'].includes(state.status)) {
            return;
        }

        this.eventBus.emitCustom('session:capability:task-execution', {
            phase: 'status',
            sessionId: state.id,
            taskId: state.metadata.taskId ?? null,
            previousStatus,
            nextStatus: state.status,
        });

        if (state.status === 'completed' && state.metadata.taskId) {
            this.eventBus.emit('notification:task-completed', {
                taskId: state.metadata.taskId,
                summary: this.buildCompletionSummary(state),
                timestamp: Date.now(),
            });
        }
    }

    private buildCompletionSummary(state: SessionState): string {
        const title = state.metadata.title?.trim();
        if (title) {
            return title;
        }

        return state.metadata.taskId ?? state.id;
    }
}
