import { registerProjectAgentIpc } from '@main/ipc/project-agent';
import { DatabaseService } from '@main/services/data/database.service';
import { ProjectAgentService } from '@main/services/project/project-agent.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn(),
        removeHandler: vi.fn()
    }
}));

// Helper to mock BrowserWindow
const mockWindow = {
    isDestroyed: vi.fn().mockReturnValue(false),
    webContents: {
        send: vi.fn()
    }
} as unknown as BrowserWindow;

interface MockProjectAgentService extends Partial<ProjectAgentService> {
    start: Mock;
    stop: Mock;
    getStatus: Mock;
    approveStep: Mock;
    resumeFromCheckpoint: Mock;
    getCurrentTaskId: Mock;
}

describe('Project Agent IPC Handlers', () => {
    let mockProjectAgentService: MockProjectAgentService;
    let mockDatabaseService: Partial<DatabaseService>;
    let registeredHandlers: Map<string, any>;
    let mockEventBus: Partial<EventBusService>;

    beforeEach(() => {
        registeredHandlers = new Map();

        vi.mocked(ipcMain.handle).mockImplementation((channel: string, listener: any) => {
            if (!registeredHandlers.has(channel)) {
                registeredHandlers.set(channel, listener);
            }
        });

        mockEventBus = {
            on: vi.fn(),
            emit: vi.fn()
        };

        mockProjectAgentService = {
            eventBus: mockEventBus as EventBusService,
            start: vi.fn().mockResolvedValue(undefined),
            stop: vi.fn().mockResolvedValue(undefined),
            getStatus: vi.fn().mockResolvedValue({ status: 'idle', currentTask: '' }),
            approveStep: vi.fn().mockResolvedValue(undefined),
            resumeFromCheckpoint: vi.fn().mockResolvedValue(true),
            getCurrentTaskId: vi.fn().mockReturnValue('task-123')
        };

        mockDatabaseService = {};

        registerProjectAgentIpc(
            mockProjectAgentService as unknown as ProjectAgentService,
            () => mockWindow,
            mockDatabaseService as DatabaseService
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Core Handlers', () => {
        it('should start a project agent task', async () => {
            const handler = registeredHandlers.get('project:start');
            const options = { task: 'Fix bugs' };
            await handler({} as IpcMainInvokeEvent, options);

            expect(mockProjectAgentService.start).toHaveBeenCalledWith(options);
        });

        it('should reject invalid start payload', async () => {
            const handler = registeredHandlers.get('project:start');
            const result = await handler({} as IpcMainInvokeEvent, { task: '   ' });
            expect(mockProjectAgentService.start).not.toHaveBeenCalled();
            expect(result).toBeUndefined();
        });

        it('should stop a project agent task', async () => {
            const handler = registeredHandlers.get('project:stop');
            await handler({} as IpcMainInvokeEvent, { taskId: 'task-123' });

            expect(mockProjectAgentService.stop).toHaveBeenCalledWith('task-123');
        });

        it('should get project agent status', async () => {
            const handler = registeredHandlers.get('project:get-status');
            const result = await handler({} as IpcMainInvokeEvent, { taskId: 'task-123' });

            expect(mockProjectAgentService.getStatus).toHaveBeenCalledWith('task-123');
            expect(result).toEqual({ status: 'idle', currentTask: '' });
        });
    });

    describe('HIL Handlers', () => {
        it('should approve a step', async () => {
            const handler = registeredHandlers.get('project:approve-step');
            await handler({} as IpcMainInvokeEvent, { taskId: 'task-123', stepId: 'step-1' });

            expect(mockProjectAgentService.approveStep).toHaveBeenCalledWith('task-123', 'step-1');
        });
    });

    describe('Checkpoint Handlers', () => {
        it('should resume from a checkpoint', async () => {
            const handler = registeredHandlers.get('project:resume-checkpoint');
            await handler({} as IpcMainInvokeEvent, 'cp-123');

            expect(mockProjectAgentService.resumeFromCheckpoint).toHaveBeenCalledWith('cp-123');
        });
    });

    describe('Legacy Compatibility', () => {
        it('should handle project-agent:start-task', async () => {
            const handler = registeredHandlers.get('project-agent:start-task');
            const result = await handler({} as IpcMainInvokeEvent, { description: 'Legacy task' });

            expect(mockProjectAgentService.start).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.taskId).toBe('task-123');
        });
    });
});
