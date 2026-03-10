import { AgentPersistenceService } from '@main/services/workspace/automation-workflow/agent-persistence.service';
import { WORKSPACE_COMPAT_SCHEMA_VALUES } from '@shared/constants';
import { AgentTaskState } from '@shared/types/agent-state';
import { beforeEach,describe, expect, it, vi } from 'vitest';

describe('AgentPersistenceService', () => {
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

    const mockTask: AgentTaskState = {
        taskId: 'task-123',
        workspaceId: 'proj-456',
        description: 'Test task',
        state: 'idle',
        currentStep: 0,
        totalSteps: 0,
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

    it('should create a task in the database', async () => {
        await service.createTask(mockTask);

        expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO agent_tasks'));
        expect(mockRun).toHaveBeenCalledWith(
            'task-123',
            'proj-456',
            'Test task',
            'idle',
            0,
            0,
            'null',
            expect.any(String),
            expect.any(String),
            0,
            0,
            0,
            0,
            expect.any(String),
            expect.any(String),
            null,
            0
        );
    });

    it('should update task state', async () => {
        await service.updateTaskState('task-123', { state: 'executing', currentStep: 1 });

        expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE agent_tasks SET state = ?, current_step = ?'));
        expect(mockRun).toHaveBeenCalledWith('executing', 1, expect.any(String), 'task-123');
    });

    it('should load a task from database', async () => {
        const mockRow = {
            id: 'task-123',
            [WORKSPACE_COMPAT_SCHEMA_VALUES.ID_COLUMN]: 'proj-456',
            description: 'Test task',
            state: 'idle',
            current_step: 0,
            total_steps: 0,
            execution_plan: null,
            context: JSON.stringify(mockTask.context),
            current_provider: JSON.stringify(mockTask.currentProvider),
            recovery_attempts: 0,
            total_tokens_used: 0,
            total_llm_calls: 0,
            total_tool_calls: 0,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            started_at: null,
            completed_at: null,
            result: null,
            estimated_cost: 0
        };

        mockGet.mockResolvedValue(mockRow);
        mockAll.mockResolvedValue([]); // No messages

        const loadedTask = await service.loadTask('task-123');

        expect(loadedTask).toBeDefined();
        expect(loadedTask?.taskId).toBe('task-123');
        expect(loadedTask?.state).toBe('idle');
    });

    it('should repair legacy agent_tasks state column during migrations', async () => {
        mockAll.mockResolvedValueOnce([{ name: 'agent_tasks' }]);

        await service.runMigrations();

        expect(mockExec).toHaveBeenCalledWith(
            expect.stringContaining('ALTER TABLE agent_tasks ADD COLUMN state TEXT NOT NULL DEFAULT')
        );
    });
});
