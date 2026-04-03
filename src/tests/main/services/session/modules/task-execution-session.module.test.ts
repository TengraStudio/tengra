import { TaskExecutionSessionModule } from '@main/services/session/modules/task-execution-session.module';
import { EventBusService } from '@main/services/system/event-bus.service';
import { SessionState } from '@shared/types/session-engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function createAutomationState(overrides: Partial<SessionState> = {}): SessionState {
    const now = Date.now();
    return {
        id: 'session-1',
        mode: 'automation',
        status: 'streaming',
        capabilities: ['task_execution'],
        model: { provider: 'antigravity', model: 'gpt-4o' },
        metadata: {
            taskId: 'task-1',
            title: 'Ship proactive notifications',
        },
        messages: [],
        recovery: {
            canResume: false,
            requiresReview: false,
            action: 'none',
            lastTransitionAt: now,
        },
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}

describe('TaskExecutionSessionModule', () => {
    let module: TaskExecutionSessionModule;
    let eventBus: {
        emitCustom: ReturnType<typeof vi.fn>;
        emit: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        eventBus = {
            emitCustom: vi.fn(),
            emit: vi.fn(),
        };
        module = new TaskExecutionSessionModule(eventBus as never as EventBusService);
    });

    it('emits task completion notification event when automation session completes', async () => {
        const state = createAutomationState({ status: 'completed' });

        await module.onStatusChange(state, 'streaming');

        expect(eventBus.emit).toHaveBeenCalledWith(
            'notification:task-completed',
            expect.objectContaining({
                taskId: 'task-1',
                summary: 'Ship proactive notifications',
            })
        );
    });

    it('does not emit task completion notification for non-completed status', async () => {
        const state = createAutomationState({ status: 'failed' });

        await module.onStatusChange(state, 'streaming');

        expect(eventBus.emit).not.toHaveBeenCalledWith('notification:task-completed', expect.anything());
    });
});
