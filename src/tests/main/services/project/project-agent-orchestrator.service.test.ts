
import { DatabaseService } from '@main/services/data/database.service';
import { LLMService } from '@main/services/llm/llm.service';
import { AgentPersistenceService } from '@main/services/project/agent/agent-persistence.service';
import { AgentProviderRotationService } from '@main/services/project/agent/agent-provider-rotation.service';
import { ProjectAgentServiceV2 } from '@main/services/project/project-agent-orchestrator.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@main/services/data/database.service');
vi.mock('@main/services/llm/llm.service');
vi.mock('@main/services/system/event-bus.service');
vi.mock('@main/services/project/agent/agent-persistence.service');
vi.mock('@main/services/project/agent/agent-provider-rotation.service');

describe('ProjectAgentServiceV2', () => {
    let service: ProjectAgentServiceV2;
    let mockDatabaseService: DatabaseService;
    let mockLLMService: LLMService;
    let mockEventBusService: EventBusService;
    let mockPersistenceService: AgentPersistenceService;
    let mockRotationService: AgentProviderRotationService;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        mockDatabaseService = new DatabaseService({} as any, {} as any, {} as any);
        mockLLMService = new LLMService({} as any, {} as any, {} as any, {} as any);
        mockEventBusService = new EventBusService();
        mockPersistenceService = new AgentPersistenceService({} as any);
        mockRotationService = new AgentProviderRotationService({} as any, {} as any);

        // Setup default mock implementations
        mockPersistenceService.initialize = vi.fn().mockResolvedValue(undefined);
        mockPersistenceService.runMigrations = vi.fn().mockResolvedValue(undefined);
        mockPersistenceService.createTask = vi.fn().mockResolvedValue(undefined);
        mockPersistenceService.updateTaskState = vi.fn().mockResolvedValue(undefined);
        mockRotationService.initialize = vi.fn().mockResolvedValue(undefined);
        mockEventBusService.emit = vi.fn();

        // Mock getProject to return a valid project
        mockDatabaseService.getProject = vi.fn().mockResolvedValue({
            id: 'test-project',
            path: '/path/to/project',
            title: 'Test Project',
            createdAt: new Date(),
            updatedAt: new Date(),
            description: 'Test project description'
        });

        service = new ProjectAgentServiceV2(
            mockDatabaseService,
            mockLLMService,
            mockEventBusService,
            mockPersistenceService,
            mockRotationService
        );

        // Mock executionLoop to prevent async state transitions during lifecycle tests
        // This effectively pauses the agent after initialization
        (service as any).executionLoop = vi.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('initialize', () => {
        it('should initialize dependencies correctly', async () => {
            await service.initialize();

            expect(mockPersistenceService.initialize).toHaveBeenCalled();
            expect(mockRotationService.initialize).toHaveBeenCalled();
            expect(mockPersistenceService.runMigrations).toHaveBeenCalled();
        });

        it('should throw error if initialization fails', async () => {
            mockPersistenceService.initialize = vi.fn().mockRejectedValue(new Error('Init failed'));

            await expect(service.initialize()).rejects.toThrow('Init failed');
        });
    });

    describe('startTask', () => {
        const projectId = 'test-project';
        const description = 'test task description';

        it('should start a new task successfully', async () => {
            const taskId = await service.startTask(projectId, description);

            expect(taskId).toBeDefined();
            expect(mockPersistenceService.createTask).toHaveBeenCalled();
            expect(mockEventBusService.emit).toHaveBeenCalledWith('agent:task_started', expect.anything());
        });
    });

    describe('lifecycle methods', () => {
        const projectId = 'test-project';
        const description = 'test task';

        let taskId: string;

        beforeEach(async () => {
            taskId = await service.startTask(projectId, description);
            // Force state to 'executing' so we can test pause/stop transitions
            const task = (service as any).activeTasks.get(taskId);
            if (task) {
                task.state = 'executing';
            }
        });

        it('should pause task', async () => {
            await service.pauseTask(taskId);

            // Should call updateTaskState via autoSaveState
            expect(mockPersistenceService.updateTaskState).toHaveBeenCalled();
        });

        it('should stop task', async () => {
            await service.stopTask(taskId);

            // Should call updateTaskState via autoSaveState
            expect(mockPersistenceService.updateTaskState).toHaveBeenCalled();
        });
    });
});
