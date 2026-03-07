import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: { getPath: () => '/tmp' }
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

vi.mock('@shared/utils/sanitize.util', () => ({
    safeJsonParse: <T>(str: string, fallback: T): T => {
        try { return JSON.parse(str) as T; } catch { return fallback; }
    }
}));

// Mock AgentTaskExecutor
vi.mock('@main/services/workspace/agent/agent-task-executor', () => {
    class MockAgentTaskExecutor {
        start = vi.fn().mockResolvedValue(undefined);
        stop = vi.fn().mockResolvedValue(undefined);
        pause = vi.fn().mockResolvedValue(undefined);
        cleanup = vi.fn().mockResolvedValue(undefined);
        setToolExecutor = vi.fn();
        restoreStateFromDB = vi.fn().mockResolvedValue(undefined);
        getStatus = vi.fn().mockReturnValue({
            status: 'idle', currentTask: '', plan: [], history: [],
            totalTokens: { prompt: 0, completion: 0 }
        });
        approvePlan = vi.fn().mockResolvedValue(undefined);
        generatePlan = vi.fn().mockResolvedValue(undefined);
        retryStep = vi.fn().mockResolvedValue(undefined);
        approveStep = vi.fn().mockResolvedValue(undefined);
        skipStep = vi.fn().mockResolvedValue(undefined);
        editStep = vi.fn().mockResolvedValue(undefined);
        addStepComment = vi.fn().mockResolvedValue(undefined);
        insertInterventionPoint = vi.fn().mockResolvedValue(undefined);
    }
    return { AgentTaskExecutor: MockAgentTaskExecutor };
});

import { WorkflowExecutionService } from '@main/services/workspace/workflow-execution.service';

interface MockDeps {
    databaseService: {
        getActiveLinkedAccount: ReturnType<typeof vi.fn>;
        uac: {
            updateTaskStatus: ReturnType<typeof vi.fn>;
            addLog: ReturnType<typeof vi.fn>;
            getTask: ReturnType<typeof vi.fn>;
            getSteps: ReturnType<typeof vi.fn>;
            getLogs: ReturnType<typeof vi.fn>;
            findSimilarPatterns: ReturnType<typeof vi.fn>;
            savePlanPattern: ReturnType<typeof vi.fn>;
            getCanvasNodeById: ReturnType<typeof vi.fn>;
            saveCanvasNodes: ReturnType<typeof vi.fn>;
            saveCanvasEdges: ReturnType<typeof vi.fn>;
            updateTaskNodeId: ReturnType<typeof vi.fn>;
            createSteps: ReturnType<typeof vi.fn>;
            deleteStepsByTask: ReturnType<typeof vi.fn>;
            updateStepStatus: ReturnType<typeof vi.fn>;
            createTask: ReturnType<typeof vi.fn>;
            getTasks: ReturnType<typeof vi.fn>;
            deleteTask: ReturnType<typeof vi.fn>;
        };
    };
    llmService: Record<string, unknown>;
    eventBus: {
        emit: ReturnType<typeof vi.fn>;
        on: ReturnType<typeof vi.fn>;
    };
    agentRegistryService: {
        getProfile: ReturnType<typeof vi.fn>;
        getProfiles: ReturnType<typeof vi.fn>;
    };
    agentCheckpointService: Record<string, unknown>;
    gitService: Record<string, unknown>;
    agentCollaborationService: {
        recordAgentTaskProgress: ReturnType<typeof vi.fn>;
        getMessagesForTask: ReturnType<typeof vi.fn>;
    };
    agentTemplateService: Record<string, unknown>;
    agentPerformanceService: {
        initializeMetrics: ReturnType<typeof vi.fn>;
        recordError: ReturnType<typeof vi.fn>;
    };
}

function createMockDeps(): MockDeps {
    return {
        databaseService: {
            getActiveLinkedAccount: vi.fn().mockResolvedValue(null),
            uac: {
                updateTaskStatus: vi.fn().mockResolvedValue(undefined),
                addLog: vi.fn().mockResolvedValue(undefined),
                getTask: vi.fn().mockResolvedValue(null),
                getSteps: vi.fn().mockResolvedValue([]),
                getLogs: vi.fn().mockResolvedValue([]),
                findSimilarPatterns: vi.fn().mockResolvedValue([]),
                savePlanPattern: vi.fn().mockResolvedValue(undefined),
                getCanvasNodeById: vi.fn().mockResolvedValue(null),
                saveCanvasNodes: vi.fn().mockResolvedValue(undefined),
                saveCanvasEdges: vi.fn().mockResolvedValue(undefined),
                updateTaskNodeId: vi.fn().mockResolvedValue(undefined),
                createSteps: vi.fn().mockResolvedValue(undefined),
                deleteStepsByTask: vi.fn().mockResolvedValue(undefined),
                updateStepStatus: vi.fn().mockResolvedValue(undefined),
                createTask: vi.fn().mockResolvedValue('task-123'),
                getTasks: vi.fn().mockResolvedValue([]),
                deleteTask: vi.fn().mockResolvedValue(true),
            }
        },
        llmService: {},
        eventBus: {
            emit: vi.fn(),
            on: vi.fn().mockReturnValue(() => undefined),
        },
        agentRegistryService: {
            getProfile: vi.fn().mockReturnValue({ id: 'default', name: 'Default' }),
            getProfiles: vi.fn().mockReturnValue([{ id: 'default', name: 'Default' }]),
        },
        agentCheckpointService: {},
        gitService: {},
        agentCollaborationService: {
            recordAgentTaskProgress: vi.fn(),
            getMessagesForTask: vi.fn().mockResolvedValue([]),
        },
        agentTemplateService: {},
        agentPerformanceService: {
            initializeMetrics: vi.fn(),
            recordError: vi.fn(),
        },
    };
}

describe('WorkflowExecutionService', () => {
    let service: WorkflowExecutionService;
    let deps: MockDeps;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = createMockDeps();
        service = new WorkflowExecutionService(deps as never);
    });

    describe('initialize', () => {
        it('should initialize and restore tasks', async () => {
            await expect(service.initialize()).resolves.toBeUndefined();
            expect(deps.eventBus.on).toHaveBeenCalled();
        });

        it('should handle restore failure gracefully', async () => {
            deps.databaseService.uac.getTasks.mockRejectedValue(new Error('DB error'));
            await expect(service.initialize()).resolves.toBeUndefined();
        });
    });

    describe('cleanup', () => {
        it('should cleanup all executors', async () => {
            await service.cleanup();
            // No error thrown
        });
    });

    describe('start', () => {
        it('should create task and return taskId', async () => {
            const taskId = await service.start({ task: 'Build feature', workspaceId: 'proj-1' });
            expect(taskId).toBe('task-123');
            expect(deps.databaseService.uac.createTask).toHaveBeenCalled();
            expect(deps.agentPerformanceService.initializeMetrics).toHaveBeenCalledWith('task-123');
        });

        it('should record collaboration progress', async () => {
            await service.start({ task: 'Build feature' });
            expect(deps.agentCollaborationService.recordAgentTaskProgress).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'in_progress', taskId: 'task-123' })
            );
        });
    });

    describe('stop', () => {
        it('should do nothing when no current task', async () => {
            await expect(service.stop()).resolves.toBeUndefined();
        });

        it('should stop current task after start', async () => {
            await service.start({ task: 'test' });
            await expect(service.stop()).resolves.toBeUndefined();
        });
    });

    describe('pauseTask', () => {
        it('should do nothing when no task', async () => {
            await expect(service.pauseTask()).resolves.toBeUndefined();
        });
    });

    describe('resumeTask', () => {
        it('should return false for unknown task', async () => {
            const result = await service.resumeTask('unknown-id');
            expect(result).toBe(false);
        });
    });

    describe('getStatus', () => {
        it('should return idle when no current task', async () => {
            const status = await service.getStatus();
            expect(status.status).toBe('idle');
        });

        it('should return status for specific taskId', async () => {
            await service.start({ task: 'test' });
            const status = await service.getStatus('task-123');
            expect(status).toBeDefined();
        });
    });

    describe('getCurrentTaskId', () => {
        it('should return null initially', () => {
            expect(service.getCurrentTaskId()).toBeNull();
        });

        it('should return taskId after start', async () => {
            await service.start({ task: 'test' });
            expect(service.getCurrentTaskId()).toBe('task-123');
        });
    });

    describe('setToolExecutor', () => {
        it('should set tool executor without error', () => {
            const mockToolExecutor = { execute: vi.fn() };
            expect(() => service.setToolExecutor(mockToolExecutor as never)).not.toThrow();
        });
    });

    describe('approvePlan', () => {
        it('should do nothing when no task', async () => {
            await expect(service.approvePlan([], 'nonexistent')).resolves.toBeUndefined();
        });
    });

    describe('deleteTask', () => {
        it('should delete task from database', async () => {
            const result = await service.deleteTask('task-123');
            expect(result).toBe(true);
            expect(deps.databaseService.uac.deleteTask).toHaveBeenCalledWith('task-123');
        });
    });
});
