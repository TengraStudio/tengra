import { registerWorkspaceAgentIpc } from '@main/ipc/workspace-agent';
import { DatabaseService } from '@main/services/data/database.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { WorkspaceAgentService } from '@main/services/workspace/workspace-agent.service';
import { WORKSPACE_COMPAT_CHANNEL_VALUES } from '@shared/constants';
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn(),
        removeHandler: vi.fn()
    },
    BrowserWindow: {
        getAllWindows: vi.fn(() => [])
    }
}));

// Helper to mock BrowserWindow
const mockWindow = {
    isDestroyed: vi.fn().mockReturnValue(false),
    webContents: {
        send: vi.fn()
    }
} as unknown as BrowserWindow;

interface MockWorkspaceAgentService extends Partial<WorkspaceAgentService> {
    start: Mock;
    stop: Mock;
    getStatus: Mock;
    generatePlan: Mock;
    approveCurrentPlan: Mock;
    rejectCurrentPlan: Mock;
    pauseTask: Mock;
    resumeTask: Mock;
    getTaskEvents: Mock;
    registerWorkerAvailability: Mock;
    listAvailableWorkers: Mock;
    scoreHelperCandidates: Mock;
    generateHelperHandoffPackage: Mock;
    reviewHelperMergeGate: Mock;
    sendCollaborationMessage: Mock;
    getCollaborationMessages: Mock;
    cleanupExpiredCollaborationMessages: Mock;
    approveStep: Mock;
    resumeFromCheckpoint: Mock;
    handleQuotaExhaustedInterrupt: Mock;
    getCurrentTaskId: Mock;
}

type IpcHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown | Promise<unknown>;

describe('Workspace Agent IPC Handlers', () => {
    let mockWorkspaceAgentService: MockWorkspaceAgentService;
    let mockDatabaseService: Partial<DatabaseService>;
    let registeredHandlers: Map<string, IpcHandler>;
    let mockEventBus: Partial<EventBusService>;

    beforeEach(() => {
        registeredHandlers = new Map();

        vi.mocked(ipcMain.handle).mockImplementation((channel: string, listener: IpcHandler) => {
            if (!registeredHandlers.has(channel)) {
                registeredHandlers.set(channel, listener);
            }
        });

        mockEventBus = {
            on: vi.fn(),
            emit: vi.fn()
        };

        mockWorkspaceAgentService = {
            eventBus: mockEventBus as EventBusService,
            start: vi.fn().mockResolvedValue(undefined),
            stop: vi.fn().mockResolvedValue(undefined),
            getStatus: vi.fn().mockResolvedValue({ status: 'idle', currentTask: '' }),
            generatePlan: vi.fn().mockResolvedValue(undefined),
            approveCurrentPlan: vi.fn().mockResolvedValue(true),
            rejectCurrentPlan: vi.fn().mockResolvedValue(true),
            pauseTask: vi.fn().mockResolvedValue(undefined),
            resumeTask: vi.fn().mockResolvedValue(true),
            getTaskEvents: vi.fn().mockResolvedValue({ success: true, events: [{ type: 'agent:state_changed' }] }),
            registerWorkerAvailability: vi.fn().mockReturnValue({
                taskId: 'task-123',
                agentId: 'agent-1',
                status: 'available',
                availableAt: Date.now(),
                lastActiveAt: Date.now(),
                skills: ['typescript'],
                contextReadiness: 0.7,
                completedStages: 1,
                failedStages: 0
            }),
            listAvailableWorkers: vi.fn().mockReturnValue([]),
            scoreHelperCandidates: vi.fn().mockReturnValue([]),
            generateHelperHandoffPackage: vi.fn().mockReturnValue({
                taskId: 'task-123',
                stageId: 'S1',
                ownerAgentId: 'owner',
                helperAgentId: 'helper',
                contextSummary: 'summary',
                acceptanceCriteria: [],
                constraints: [],
                generatedAt: Date.now()
            }),
            reviewHelperMergeGate: vi.fn().mockReturnValue({
                accepted: true,
                verdict: 'ACCEPT',
                reasons: ['ok'],
                requiredFixes: [],
                reviewedAt: Date.now()
            }),
            sendCollaborationMessage: vi.fn().mockResolvedValue({
                id: 'msg-1',
                taskId: 'task-123',
                stageId: 'S1',
                fromAgentId: 'agent-1',
                toAgentId: 'agent-2',
                channel: 'private',
                intent: 'REQUEST_HELP',
                priority: 'high',
                payload: { summary: 'Need help' },
                createdAt: Date.now()
            }),
            getCollaborationMessages: vi.fn().mockResolvedValue([{
                id: 'msg-1',
                taskId: 'task-123',
                stageId: 'S1',
                fromAgentId: 'agent-1',
                toAgentId: 'agent-2',
                channel: 'private',
                intent: 'REQUEST_HELP',
                priority: 'high',
                payload: { summary: 'Need help' },
                createdAt: Date.now()
            }]),
            cleanupExpiredCollaborationMessages: vi.fn().mockResolvedValue(2),
            approveStep: vi.fn().mockResolvedValue(undefined),
            resumeFromCheckpoint: vi.fn().mockResolvedValue(true),
            handleQuotaExhaustedInterrupt: vi.fn().mockResolvedValue({
                success: true,
                interruptId: 'task-123:123',
                checkpointId: 'cp-123',
                blockedByQuota: false,
                switched: true,
                selectedFallback: { provider: 'openai', model: 'gpt-4o' },
                availableFallbacks: [{ provider: 'openai', model: 'gpt-4o' }],
                message: 'Quota exhaustion handled via checkpoint restore, fallback switch, and resume.'
            }),
            getCurrentTaskId: vi.fn().mockReturnValue('task-123')
        };

        mockDatabaseService = {};

        registerWorkspaceAgentIpc(
            mockWorkspaceAgentService as unknown as WorkspaceAgentService,
            () => mockWindow,
            mockDatabaseService as DatabaseService
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    const getRequiredHandler = (channel: string): IpcHandler => {
        const handler = registeredHandlers.get(channel);
        if (!handler) {
            throw new Error(`Missing IPC handler: ${channel}`);
        }
        return handler;
    };

    describe('Core Handlers', () => {
        it('should start a workspace agent task', async () => {
            const handler = getRequiredHandler('workspace:start');
            const options = { task: 'Fix bugs' };
            await handler({} as IpcMainInvokeEvent, options);

            expect(mockWorkspaceAgentService.start).toHaveBeenCalledWith(options);
        });

        it('should reject invalid start payload', async () => {
            const handler = getRequiredHandler('workspace:start');
            const result = await handler({} as IpcMainInvokeEvent, { task: '   ' });
            expect(mockWorkspaceAgentService.start).toHaveBeenCalledWith({ task: '   ' });
            expect(result).toEqual({ success: true, data: { taskId: undefined } });
        });

        it('should stop a workspace agent task', async () => {
            const handler = getRequiredHandler('workspace:stop');
            await handler({} as IpcMainInvokeEvent, { taskId: 'task-123' });

            expect(mockWorkspaceAgentService.stop).toHaveBeenCalledWith('task-123');
        });

        it('should get workspace agent status', async () => {
            const handler = getRequiredHandler('workspace:get-status');
            const result = await handler({} as IpcMainInvokeEvent, { taskId: 'task-123' });

            expect(mockWorkspaceAgentService.getStatus).toHaveBeenCalledWith('task-123');
            expect(result).toEqual({ success: true, data: { status: 'idle', currentTask: '' } });
        });
    });

    describe('HIL Handlers', () => {
        it('should approve a step', async () => {
            const handler = getRequiredHandler('workspace:approve-step');
            await handler({} as IpcMainInvokeEvent, { taskId: 'task-123', stepId: 'step-1' });

            expect(mockWorkspaceAgentService.approveStep).toHaveBeenCalledWith('task-123', 'step-1');
        });
    });

    describe('Checkpoint Handlers', () => {
        it('should resume from a checkpoint', async () => {
            const handler = getRequiredHandler('agent:resume-checkpoint');
            await handler({} as IpcMainInvokeEvent, 'cp-123');

            expect(mockWorkspaceAgentService.resumeFromCheckpoint).toHaveBeenCalledWith('cp-123');
        });
    });

    describe('Legacy Compatibility', () => {
        it('should keep old legacy agent channels unregistered', () => {
            expect(registeredHandlers.has(WORKSPACE_COMPAT_CHANNEL_VALUES.AGENT_START_TASK)).toBe(false);
            expect(registeredHandlers.has(WORKSPACE_COMPAT_CHANNEL_VALUES.AGENT_HEALTH)).toBe(false);
        });
    });

    describe('Council IPC Handlers', () => {
        it('should generate council plan', async () => {
            const handler = getRequiredHandler('workspace:council-generate-plan');
            const result = await handler({} as IpcMainInvokeEvent, { taskId: 'task-123', task: 'Build feature' });

            expect(mockWorkspaceAgentService.generatePlan).toHaveBeenCalled();
            expect(result).toEqual({ success: true, data: { success: true } });
        });

        it('should get council proposal', async () => {
            const handler = getRequiredHandler('workspace:council-get-proposal');
            const result = await handler({} as IpcMainInvokeEvent, { taskId: 'task-123' });

            expect(mockWorkspaceAgentService.getStatus).toHaveBeenCalledWith('task-123');
            expect(result).toEqual({ success: true, data: { success: true, plan: [] } });
        });

        it('should approve council proposal', async () => {
            const handler = getRequiredHandler('workspace:council-approve-proposal');
            const result = await handler({} as IpcMainInvokeEvent, { taskId: 'task-123' });

            expect(mockWorkspaceAgentService.approveCurrentPlan).toHaveBeenCalledWith('task-123');
            expect(result).toEqual({ success: true, data: { success: true, error: undefined } });
        });

        it('should reject council proposal', async () => {
            const handler = getRequiredHandler('workspace:council-reject-proposal');
            const result = await handler({} as IpcMainInvokeEvent, { taskId: 'task-123', reason: 'Need revision' });

            expect(mockWorkspaceAgentService.rejectCurrentPlan).toHaveBeenCalledWith('task-123', 'Need revision');
            expect(result).toEqual({ success: true, data: { success: true, error: undefined } });
        });

        it('should start, pause and resume council execution', async () => {
            const startHandler = getRequiredHandler('workspace:council-start-execution');
            const pauseHandler = getRequiredHandler('workspace:council-pause-execution');
            const resumeHandler = getRequiredHandler('workspace:council-resume-execution');

            const startResult = await startHandler({} as IpcMainInvokeEvent, { taskId: 'task-123' });
            const pauseResult = await pauseHandler({} as IpcMainInvokeEvent, { taskId: 'task-123' });
            const resumeResult = await resumeHandler({} as IpcMainInvokeEvent, { taskId: 'task-123' });

            expect(mockWorkspaceAgentService.resumeTask).toHaveBeenCalledWith('task-123');
            expect(mockWorkspaceAgentService.pauseTask).toHaveBeenCalledWith('task-123');
            expect(startResult).toEqual({ success: true, data: { success: true, error: undefined } });
            expect(pauseResult).toEqual({ success: true, data: { success: true } });
            expect(resumeResult).toEqual({ success: true, data: { success: true, error: undefined } });
        });

        it('should get council timeline', async () => {
            const handler = getRequiredHandler('workspace:council-get-timeline');
            const result = await handler({} as IpcMainInvokeEvent, { taskId: 'task-123' });

            expect(mockWorkspaceAgentService.getTaskEvents).toHaveBeenCalledWith('task-123');
            expect(result).toEqual({
                success: true,
                data: { success: true, events: [{ type: 'agent:state_changed' }] }
            });
        });

        it('should register worker availability', async () => {
            const handler = getRequiredHandler('workspace:council-register-worker-availability');
            const payload = { taskId: 'task-123', agentId: 'agent-1', status: 'available' as const };
            await handler({} as IpcMainInvokeEvent, payload);

            expect(mockWorkspaceAgentService.registerWorkerAvailability).toHaveBeenCalledWith(payload);
        });

        it('should list available workers', async () => {
            const handler = getRequiredHandler('workspace:council-list-available-workers');
            await handler({} as IpcMainInvokeEvent, { taskId: 'task-123' });

            expect(mockWorkspaceAgentService.listAvailableWorkers).toHaveBeenCalledWith('task-123');
        });

        it('should score helper candidates', async () => {
            const handler = getRequiredHandler('workspace:council-score-helper-candidates');
            const payload = { taskId: 'task-123', stageId: 'S1', requiredSkills: ['typescript'] };
            await handler({} as IpcMainInvokeEvent, payload);

            expect(mockWorkspaceAgentService.scoreHelperCandidates).toHaveBeenCalledWith(payload);
        });

        it('should generate helper handoff package', async () => {
            const handler = getRequiredHandler('workspace:council-generate-helper-handoff-package');
            const payload = {
                taskId: 'task-123',
                stageId: 'S1',
                ownerAgentId: 'owner',
                helperAgentId: 'helper',
                stageGoal: 'Implement feature',
                acceptanceCriteria: ['tests pass'],
                constraints: ['no regressions']
            };
            await handler({} as IpcMainInvokeEvent, payload);

            expect(mockWorkspaceAgentService.generateHelperHandoffPackage).toHaveBeenCalledWith(payload);
        });

        it('should review helper merge gate', async () => {
            const handler = getRequiredHandler('workspace:council-review-helper-merge-gate');
            const payload = {
                acceptanceCriteria: ['tests pass'],
                constraints: ['no regressions'],
                helperOutput: 'tests pass and no regressions'
            };
            await handler({} as IpcMainInvokeEvent, payload);

            expect(mockWorkspaceAgentService.reviewHelperMergeGate).toHaveBeenCalledWith(payload);
        });

        it('should handle quota exhaustion with checkpoint and automatic continuation', async () => {
            const handler = getRequiredHandler('workspace:council-handle-quota-interrupt');
            const payload = {
                taskId: 'task-123',
                stageId: 'S1',
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                reason: 'quota_exhausted',
                autoSwitch: true
            };

            const result = await handler({} as IpcMainInvokeEvent, payload);

            expect(mockWorkspaceAgentService.handleQuotaExhaustedInterrupt).toHaveBeenCalledWith(payload);
            expect(result).toEqual({
                success: true,
                data: {
                    success: true,
                    interruptId: 'task-123:123',
                    checkpointId: 'cp-123',
                    blockedByQuota: false,
                    switched: true,
                    selectedFallback: { provider: 'openai', model: 'gpt-4o' },
                    availableFallbacks: [{ provider: 'openai', model: 'gpt-4o' }],
                    message: 'Quota exhaustion handled via checkpoint restore, fallback switch, and resume.'
                }
            });
        });

        it('should send council collaboration messages with strict payloads', async () => {
            const handler = getRequiredHandler('workspace:council-send-message');
            const payload = {
                taskId: 'task-123',
                stageId: 'S1',
                fromAgentId: 'agent-1',
                toAgentId: 'agent-2',
                intent: 'REQUEST_HELP' as const,
                priority: 'high' as const,
                payload: { summary: 'Need help', attempt: 1 }
            };

            const result = await handler({} as IpcMainInvokeEvent, payload);

            expect(mockWorkspaceAgentService.sendCollaborationMessage).toHaveBeenCalledWith(payload);
            expect(result).toMatchObject({
                success: true,
                data: { id: 'msg-1', taskId: 'task-123' }
            });
        });

        it('should fetch council collaboration messages with strict filters', async () => {
            const handler = getRequiredHandler('workspace:council-get-messages');
            const payload = {
                taskId: 'task-123',
                stageId: 'S1',
                agentId: 'agent-2',
                includeExpired: false
            };

            const result = await handler({} as IpcMainInvokeEvent, payload);

            expect(mockWorkspaceAgentService.getCollaborationMessages).toHaveBeenCalledWith(payload);
            expect(result).toEqual({
                success: true,
                data: [
                    expect.objectContaining({
                        id: 'msg-1',
                        taskId: 'task-123'
                    })
                ]
            });
        });

        it('should cleanup expired council collaboration messages', async () => {
            const handler = getRequiredHandler('workspace:council-cleanup-expired-messages');

            const result = await handler({} as IpcMainInvokeEvent, { taskId: 'task-123' });

            expect(mockWorkspaceAgentService.cleanupExpiredCollaborationMessages).toHaveBeenCalledWith('task-123');
            expect(result).toEqual({ success: true, data: { success: true, removed: 2 } });
        });
    });
});
