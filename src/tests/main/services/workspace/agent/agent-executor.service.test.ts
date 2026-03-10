import { AgentExecutorService } from '@main/services/workspace/automation-workflow/agent-executor.service';
import { AgentPersistenceService } from '@main/services/workspace/automation-workflow/agent-persistence.service';
import { AgentTaskState } from '@shared/types/agent-state';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('AgentExecutorService', () => {
    let executor: AgentExecutorService;
    let mockPersistenceService: any;

    const mockState: AgentTaskState = {
        taskId: 'task-123',
        workspaceId: 'proj-456',
        description: 'Test task',
        state: 'executing',
        currentStep: 1,
        totalSteps: 5,
        plan: null,
        messageHistory: [],
        eventHistory: [],
        currentProvider: { provider: 'openai', model: 'gpt-4', accountIndex: 0, status: 'active' },
        providerHistory: [],
        errors: [],
        recoveryAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        metrics: {
            duration: 0,
            llmCalls: 0,
            toolCalls: 0,
            tokensUsed: 0,
            providersUsed: [],
            errorCount: 0,
            recoveryCount: 0,
            estimatedCost: 0
        },
        context: {
            workspacePath: '/test',
            workspaceName: 'test',
            workspace: { rootPath: '/test', hasGit: true, hasDependencies: true },
            constraints: { maxIterations: 10, maxDuration: 60000, maxToolCalls: 50, allowedTools: [] }
        },
        result: null
    };

    beforeEach(() => {
        mockPersistenceService = {
            updateTaskState: vi.fn(),
            saveCheckpoint: vi.fn(),
            loadTask: vi.fn().mockResolvedValue(mockState)
        };

        executor = new AgentExecutorService(mockPersistenceService as AgentPersistenceService);
    });

    it('should save checkpoint when step changes', async () => {
        const event = {
            type: 'EXECUTE_STEP',
            payload: { stepIndex: 2 }
        } as any;

        const newState = await executor.dispatch(mockState, event);

        expect(newState.currentStep).toBe(2);

        // Check persistence calls
        expect(mockPersistenceService.updateTaskState).toHaveBeenCalledWith(
            'task-123',
            { state: 'executing' }
        );

        expect(mockPersistenceService.saveCheckpoint).toHaveBeenCalledWith(
            'task-123',
            2,
            newState
        );
    });

    it('should save checkpoint when state changes significantly', async () => {
        const initializingState = { ...mockState, state: 'initializing' as const };
        const planEvent = {
            type: 'TASK_VALIDATED',
            payload: { context: mockState.context }
        } as any;

        const newState = await executor.dispatch(initializingState, planEvent);
        expect(newState.state).toBe('planning');

        // 'planning' IS in the list.
        expect(mockPersistenceService.saveCheckpoint).toHaveBeenCalled();
    });

    it('should NOT save checkpoint for minor state changes', async () => {
        const event = {
            type: 'LLM_REQUEST', // executing -> waiting_llm
            payload: {}
        } as any;

        await executor.dispatch(mockState, event);

        // waiting_llm is not in the list
        expect(mockPersistenceService.saveCheckpoint).not.toHaveBeenCalled();
    });

    it('should resume from checkpoint', async () => {
        const checkpointState = { ...mockState, currentStep: 3 };
        mockPersistenceService.loadCheckpoint = vi.fn().mockResolvedValue(checkpointState);

        const resumedState = await executor.resumeFromCheckpoint('cp-123');

        expect(resumedState.currentStep).toBe(3);
        expect(mockPersistenceService.updateTaskState).toHaveBeenCalledWith(
            'task-123',
            checkpointState
        );
    });
});
