import { AgentPersistenceService } from '@main/services/workspace/automation-workflow/agent-persistence.service';
import { AgentTaskState } from '@shared/types/agent-state';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('AgentPersistenceService Checkpoints', () => {
    const mockRun = vi.fn();
    const mockAll = vi.fn();
    const mockGet = vi.fn();
    const mockPrepare = vi.fn().mockReturnValue({
        run: mockRun,
        all: mockAll,
        get: mockGet
    });
    const mockExec = vi.fn();

    const mockDatabaseService = {
        getDatabase: vi.fn().mockReturnValue({
            prepare: mockPrepare,
            exec: mockExec
        })
    };

    let service: AgentPersistenceService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AgentPersistenceService(mockDatabaseService as any);
    });

    const mockState: AgentTaskState = {
        taskId: 'task-123',
        workspaceId: 'proj-456',
        description: 'Test task',
        state: 'idle',
        currentStep: 5,
        totalSteps: 10,
        plan: null,
        messageHistory: [],
        eventHistory: [],
        currentProvider: { provider: 'openai', model: 'gpt-4', accountIndex: 0, status: 'active' },
        providerHistory: [],
        errors: [],
        recoveryAttempts: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        startedAt: null,
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

    describe('saveCheckpoint', () => {
        it('should save a checkpoint successfully', async () => {
            await service.saveCheckpoint('task-123', 5, mockState);

            expect(mockPrepare).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO agent_checkpoints')
            );
            expect(mockRun).toHaveBeenCalledWith(
                expect.any(String), // id
                'task-123',
                5,
                expect.any(String), // serialized state
                expect.any(String)  // created_at
            );

            // Verify the serialized state contains key fields
            const callArgs = mockRun.mock.calls[0];
            const serializedState = callArgs[3];
            const state = JSON.parse(serializedState);
            expect(state.taskId).toBe('task-123');
            expect(state.currentStep).toBe(5);
        });

        it('should throw error if save fails', async () => {
            const error = new Error('Database error');
            mockRun.mockRejectedValue(error);

            await expect(service.saveCheckpoint('task-123', 5, mockState)).rejects.toThrow('Database error');
        });
    });

    describe('getCheckpoints', () => {
        it('should retrieve checkpoints for a task', async () => {
            const mockRows = [
                {
                    id: 'cp-1',
                    task_id: 'task-123',
                    step_index: 1,
                    state_snapshot: JSON.stringify({ ...mockState, currentStep: 1 }),
                    created_at: '2024-01-01T10:00:00.000Z'
                },
                {
                    id: 'cp-2',
                    task_id: 'task-123',
                    step_index: 5,
                    state_snapshot: JSON.stringify({ ...mockState, currentStep: 5 }),
                    created_at: '2024-01-01T11:00:00.000Z'
                }
            ];

            mockAll.mockResolvedValue(mockRows);

            const checkpoints = await service.getCheckpoints('task-123');

            expect(checkpoints).toHaveLength(2);
            expect(checkpoints[0].stepIndex).toBe(1);
            expect(checkpoints[1].stepIndex).toBe(5);
            expect(mockPrepare).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM agent_checkpoints WHERE task_id = ?')
            );
        });
    });

    describe('loadCheckpoint', () => {
        it('should load and hydrate a specific checkpoint', async () => {
            const mockRow = {
                id: 'cp-1',
                task_id: 'task-123',
                step_index: 5,
                state_snapshot: JSON.stringify(mockState),
                created_at: '2024-01-01T10:00:00.000Z'
            };

            mockGet.mockResolvedValue(mockRow);

            const loadedState = await service.loadCheckpoint('cp-1');

            expect(loadedState).toBeDefined();
            expect(loadedState?.taskId).toBe('task-123');
            expect(loadedState?.currentStep).toBe(5);

            // Verify date hydration
            expect(loadedState?.createdAt).toBeInstanceOf(Date);
            expect(loadedState?.updatedAt).toBeInstanceOf(Date);
        });

        it('should return null if checkpoint not found', async () => {
            mockGet.mockResolvedValue(undefined);

            const result = await service.loadCheckpoint('non-existent');
            expect(result).toBeNull();
        });
    });

    describe('getLatestCheckpoint', () => {
        it('should return the latest checkpoint', async () => {
            const mockRow = {
                id: 'cp-latest',
                task_id: 'task-123',
                step_index: 10,
                state_snapshot: JSON.stringify({ ...mockState, currentStep: 10 }),
                created_at: '2024-01-01T12:00:00.000Z'
            };

            mockGet.mockResolvedValue(mockRow);

            const latest = await service.getLatestCheckpoint('task-123');

            expect(latest).toBeDefined();
            expect(latest?.currentStep).toBe(10);
            expect(mockPrepare).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY step_index DESC LIMIT 1')
            );
        });

        it('should return null if no checkpoints exist', async () => {
            mockGet.mockResolvedValue(undefined);

            const result = await service.getLatestCheckpoint('task-123');
            expect(result).toBeNull();
        });
    });
});
