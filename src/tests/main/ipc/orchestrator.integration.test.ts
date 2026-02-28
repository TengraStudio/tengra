import { registerOrchestratorIpc } from '@main/ipc/orchestrator';
import { OrchestratorState, ProjectStep } from '@shared/types/project-agent';
import { IpcMainInvokeEvent } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ipcMainHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
            ipcMainHandlers.set(channel, handler);
        }),
        setMaxListeners: vi.fn()
    },
    BrowserWindow: vi.fn()
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('@main/utils/ipc-wrapper.util', () => ({
    createIpcHandler: (_name: string, handler: (...args: unknown[]) => unknown) => async (...args: unknown[]) => handler(...args),
    createSafeIpcHandler: (_name: string, handler: (...args: unknown[]) => unknown, defaultValue: unknown) => async (...args: unknown[]) => {
        try {
            return await handler(...args);
        } catch {
            return defaultValue;
        }
    }
}));

describe('Orchestrator IPC Integration', () => {
    const mockEventBus = {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn()
    };

    const mockOrchestratorService = {
        orchestrate: vi.fn().mockResolvedValue(undefined),
        approvePlan: vi.fn().mockResolvedValue(undefined),
        getState: vi.fn().mockReturnValue({
            status: 'idle',
            currentTask: '',
            plan: [],
            history: [],
            assignments: {}
        } as OrchestratorState),
        stop: vi.fn().mockResolvedValue(undefined),
        eventBus: mockEventBus
    };

    const mockWindow = {
        webContents: {
            send: vi.fn()
        },
        isDestroyed: vi.fn().mockReturnValue(false)
    };

    const getMainWindow = vi.fn().mockReturnValue(mockWindow);

    beforeEach(() => {
        ipcMainHandlers.clear();
        vi.clearAllMocks();

        registerOrchestratorIpc(mockOrchestratorService as never, getMainWindow);
    });

    it('registers all orchestrator IPC handlers', () => {
        expect(ipcMainHandlers.has('orchestrator:start')).toBe(true);
        expect(ipcMainHandlers.has('orchestrator:approve')).toBe(true);
        expect(ipcMainHandlers.has('orchestrator:get-state')).toBe(true);
        expect(ipcMainHandlers.has('orchestrator:stop')).toBe(true);
    });

    it('subscribes to orchestrator:update events', () => {
        expect(mockEventBus.on).toHaveBeenCalledWith('orchestrator:update', expect.any(Function));
    });

    it('forwards orchestrator:update events to renderer', () => {
        const updateHandler = mockEventBus.on.mock.calls[0][1];
        const state: OrchestratorState = {
            status: 'planning',
            currentTask: 'Build feature',
            plan: [],
            history: [],
            assignments: {}
        };

        updateHandler(state);

        expect(getMainWindow).toHaveBeenCalled();
        expect(mockWindow.webContents.send).toHaveBeenCalledWith('orchestrator:update', state);
    });

    it('does not send update if window is destroyed', () => {
        mockWindow.isDestroyed.mockReturnValue(true);
        const updateHandler = mockEventBus.on.mock.calls[0][1];
        const state: OrchestratorState = {
            status: 'planning',
            currentTask: 'Build feature',
            plan: [],
            history: [],
            assignments: {}
        };

        updateHandler(state);

        expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('does not send update if window is null', () => {
        getMainWindow.mockReturnValue(null);
        const updateHandler = mockEventBus.on.mock.calls[0][1];
        const state: OrchestratorState = {
            status: 'planning',
            currentTask: 'Build feature',
            plan: [],
            history: [],
            assignments: {}
        };

        updateHandler(state);

        expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('starts orchestration with valid task', async () => {
        const handler = ipcMainHandlers.get('orchestrator:start')!;
        await handler({} as IpcMainInvokeEvent, 'Build login feature');

        expect(mockOrchestratorService.orchestrate).toHaveBeenCalledWith('Build login feature', undefined);
    });

    it('starts orchestration with task and project ID', async () => {
        const handler = ipcMainHandlers.get('orchestrator:start')!;
        await handler({} as IpcMainInvokeEvent, 'Build login feature', 'project-123');

        expect(mockOrchestratorService.orchestrate).toHaveBeenCalledWith('Build login feature', 'project-123');
    });

    it('throws error for empty task string', async () => {
        const handler = ipcMainHandlers.get('orchestrator:start')!;

        await expect(
            handler({} as IpcMainInvokeEvent, '')
        ).rejects.toThrow('Task must be a non-empty string');

        expect(mockOrchestratorService.orchestrate).not.toHaveBeenCalled();
    });

    it('throws error for whitespace-only task string', async () => {
        const handler = ipcMainHandlers.get('orchestrator:start')!;

        await expect(
            handler({} as IpcMainInvokeEvent, '   ')
        ).rejects.toThrow('Task must be a non-empty string');

        expect(mockOrchestratorService.orchestrate).not.toHaveBeenCalled();
    });

    it('throws error for non-string task', async () => {
        const handler = ipcMainHandlers.get('orchestrator:start')!;

        await expect(
            handler({} as IpcMainInvokeEvent, 123)
        ).rejects.toThrow('Task must be a non-empty string');

        expect(mockOrchestratorService.orchestrate).not.toHaveBeenCalled();
    });

    it('throws error for non-string project ID', async () => {
        const handler = ipcMainHandlers.get('orchestrator:start')!;

        await expect(
            handler({} as IpcMainInvokeEvent, 'Build feature', 123)
        ).rejects.toThrow('Project ID must be a string');

        expect(mockOrchestratorService.orchestrate).not.toHaveBeenCalled();
    });

    it('approves plan with valid array', async () => {
        const handler = ipcMainHandlers.get('orchestrator:approve')!;
        const plan: ProjectStep[] = [
            { id: '1', text: 'Initialize project', status: 'pending' },
            { id: '2', text: 'Build feature', status: 'pending' }
        ];

        await handler({} as IpcMainInvokeEvent, plan);

        expect(mockOrchestratorService.approvePlan).toHaveBeenCalledWith(plan);
    });

    it('approves empty plan array', async () => {
        const handler = ipcMainHandlers.get('orchestrator:approve')!;
        await handler({} as IpcMainInvokeEvent, []);

        expect(mockOrchestratorService.approvePlan).toHaveBeenCalledWith([]);
    });

    it('throws error when plan is not an array', async () => {
        const handler = ipcMainHandlers.get('orchestrator:approve')!;

        await expect(
            handler({} as IpcMainInvokeEvent, 'not an array')
        ).rejects.toThrow('Plan must be an array of ProjectStep');

        expect(mockOrchestratorService.approvePlan).not.toHaveBeenCalled();
    });

    it('throws error when plan is null', async () => {
        const handler = ipcMainHandlers.get('orchestrator:approve')!;

        await expect(
            handler({} as IpcMainInvokeEvent, null)
        ).rejects.toThrow('Plan must be an array of ProjectStep');

        expect(mockOrchestratorService.approvePlan).not.toHaveBeenCalled();
    });

    it('throws error when plan is object but not array', async () => {
        const handler = ipcMainHandlers.get('orchestrator:approve')!;

        await expect(
            handler({} as IpcMainInvokeEvent, { step: 'build' })
        ).rejects.toThrow('Plan must be an array of ProjectStep');

        expect(mockOrchestratorService.approvePlan).not.toHaveBeenCalled();
    });

    it('retrieves current orchestrator state', async () => {
        mockOrchestratorService.getState.mockReturnValue({
            status: 'executing',
            currentTask: 'Building feature',
            plan: [{ id: '1', title: 'Step 1', description: 'First step', status: 'in-progress', agentType: 'coder' }],
            history: [],
            assignments: { '1': 'agent-coder-1' }
        });

        const handler = ipcMainHandlers.get('orchestrator:get-state')!;
        const result = await handler({} as IpcMainInvokeEvent);

        expect(result).toEqual({
            status: 'executing',
            currentTask: 'Building feature',
            plan: [{ id: '1', title: 'Step 1', description: 'First step', status: 'in-progress', agentType: 'coder' }],
            history: [],
            assignments: { '1': 'agent-coder-1' }
        });
        expect(mockOrchestratorService.getState).toHaveBeenCalledTimes(1);
    });

    it('returns default state on getState error (safe handler)', async () => {
        mockOrchestratorService.getState.mockImplementation(() => {
            throw new Error('Service error');
        });

        const handler = ipcMainHandlers.get('orchestrator:get-state')!;
        const result = await handler({} as IpcMainInvokeEvent);

        expect(result).toEqual({
            status: 'idle',
            currentTask: '',
            plan: [],
            history: [],
            assignments: {}
        });
    });

    it('stops orchestration', async () => {
        const handler = ipcMainHandlers.get('orchestrator:stop')!;
        await handler({} as IpcMainInvokeEvent);

        expect(mockOrchestratorService.stop).toHaveBeenCalledTimes(1);
    });

    it('handles stop error by propagating it', async () => {
        mockOrchestratorService.stop.mockRejectedValue(new Error('Cannot stop'));

        const handler = ipcMainHandlers.get('orchestrator:stop')!;

        await expect(
            handler({} as IpcMainInvokeEvent)
        ).rejects.toThrow('Cannot stop');
    });
});
