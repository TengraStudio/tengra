import { gzipSync } from 'zlib';

import {
    AgentCheckpointService,
    AgentCheckpointTelemetryEvent,
} from '@main/services/project/agent/agent-checkpoint.service';
import { AgentTaskState } from '@shared/types/agent-state';
import { ProjectStep } from '@shared/types/project-agent';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMockTaskState = (): AgentTaskState => ({
    taskId: 'task-123',
    projectId: 'project-123',
    description: 'Checkpoint test task',
    state: 'executing',
    currentStep: 2,
    totalSteps: 3,
    plan: {
        steps: [
            { index: 0, description: 'Step 1', type: 'analysis', status: 'completed', toolsUsed: [] },
            { index: 1, description: 'Step 2', type: 'code_generation', status: 'in_progress', toolsUsed: [], startedAt: new Date('2026-02-08T10:00:00.000Z') }
        ],
        requiredTools: [],
        dependencies: []
    },
    context: {
        projectPath: 'C:/tmp/project',
        projectName: 'project',
        workspace: {
            rootPath: 'C:/tmp/project',
            hasGit: true,
            hasDependencies: true
        },
        constraints: {
            maxIterations: 5,
            maxDuration: 300000,
            maxToolCalls: 20,
            allowedTools: []
        }
    },
    messageHistory: [
        { id: 'm1', role: 'user', content: 'start', timestamp: new Date('2026-02-08T09:59:00.000Z') }
    ],
    eventHistory: [
        {
            id: 'e1',
            timestamp: new Date('2026-02-08T10:00:00.000Z'),
            type: 'EXECUTE_STEP',
            payload: { stepIndex: 1 },
            stateBeforeTransition: 'planning',
            stateAfterTransition: 'executing'
        }
    ],
    currentProvider: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        accountIndex: 0,
        status: 'active'
    },
    providerHistory: [
        {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            accountIndex: 0,
            startedAt: new Date('2026-02-08T10:00:00.000Z'),
            status: 'success',
            requestCount: 1
        }
    ],
    errors: [],
    recoveryAttempts: 0,
    createdAt: new Date('2026-02-08T09:58:00.000Z'),
    updatedAt: new Date('2026-02-08T10:00:30.000Z'),
    startedAt: new Date('2026-02-08T09:59:30.000Z'),
    completedAt: null,
    metrics: {
        duration: 30000,
        llmCalls: 1,
        toolCalls: 0,
        tokensUsed: 123,
        providersUsed: ['anthropic'],
        errorCount: 0,
        recoveryCount: 0,
        estimatedCost: 0.01
    },
    result: null
});

describe('AgentCheckpointService', () => {
    const mockUac = {
        createCheckpoint: vi.fn(),
        trimCheckpoints: vi.fn(),
        getCheckpoints: vi.fn(),
        getCheckpoint: vi.fn(),
        getLatestCheckpoint: vi.fn(),
        createPlanVersion: vi.fn(),
        getPlanVersions: vi.fn(),
        getLatestPlanVersion: vi.fn()
    };

    const mockTelemetryService = {
        track: vi.fn().mockReturnValue({ success: true })
    };

    const mockDatabaseService = {
        uac: mockUac
    };

    let service: AgentCheckpointService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AgentCheckpointService(mockDatabaseService as never);
        service.setTelemetryService(mockTelemetryService as never);
    });

    it('hydrates checkpoint snapshots with Date fields', async () => {
        const state = createMockTaskState();
        const snapshot = JSON.stringify({
            schemaVersion: 1,
            trigger: 'manual_snapshot',
            createdAt: 1739008800000,
            state
        });

        mockUac.getCheckpoint.mockResolvedValue({
            id: 'cp-1',
            task_id: 'task-123',
            step_index: 2,
            trigger: 'manual_snapshot',
            snapshot,
            created_at: 1739008800000
        });

        const checkpoint = await service.loadCheckpoint('cp-1');
        if (!checkpoint?.state) {
            throw new Error('Checkpoint state should be present');
        }
        expect(checkpoint.state.createdAt).toBeInstanceOf(Date);
        expect(checkpoint.state.updatedAt).toBeInstanceOf(Date);
        expect(checkpoint.state.eventHistory[0]?.timestamp).toBeInstanceOf(Date);
        expect(checkpoint.state.providerHistory[0]?.startedAt).toBeInstanceOf(Date);
    });

    it('prepares rollback by creating a pre-rollback snapshot', async () => {
        const state = createMockTaskState();
        const snapshot = JSON.stringify({
            schemaVersion: 1,
            trigger: 'manual_snapshot',
            createdAt: Date.now(),
            state
        });

        mockUac.getCheckpoint.mockResolvedValue({
            id: 'cp-target',
            task_id: 'task-123',
            step_index: 2,
            trigger: 'manual_snapshot',
            snapshot,
            created_at: Date.now()
        });
        mockUac.createCheckpoint.mockResolvedValue('cp-pre');

        const rollback = await service.prepareRollback('cp-target', state);
        expect(rollback.preRollbackCheckpointId).toBe('cp-pre');
        expect(rollback.resumedCheckpoint.id).toBe('cp-target');
        expect(mockUac.createCheckpoint).toHaveBeenCalledTimes(1);
        expect(mockUac.createCheckpoint).toHaveBeenCalledWith(
            'task-123',
            2,
            'pre_rollback',
            expect.any(String)
        );
        expect(mockUac.trimCheckpoints).toHaveBeenCalledWith('task-123', 200);
    });

    it('skips duplicate auto_state_sync checkpoint snapshots', async () => {
        const state = createMockTaskState();
        const snapshotPayload = JSON.stringify({
            schemaVersion: 1,
            trigger: 'auto_state_sync',
            createdAt: 1739008800000,
            state
        });
        const snapshot = `gzip:${gzipSync(Buffer.from(snapshotPayload, 'utf8')).toString('base64')}`;

        mockUac.getLatestCheckpoint.mockResolvedValue({
            id: 'cp-existing',
            task_id: 'task-123',
            step_index: 2,
            trigger: 'auto_state_sync',
            snapshot,
            created_at: 1739008800000
        });

        const checkpointId = await service.saveCheckpoint('task-123', 2, state, 'auto_state_sync');
        expect(checkpointId).toBe('cp-existing');
        expect(mockUac.createCheckpoint).not.toHaveBeenCalled();
        expect(mockUac.trimCheckpoints).not.toHaveBeenCalled();
    });

    it('creates monotonically increasing plan versions', async () => {
        const plan: ProjectStep[] = [
            { id: 's1', text: 'Analyze', status: 'pending' },
            { id: 's2', text: 'Implement', status: 'pending' }
        ];

        mockUac.getLatestPlanVersion.mockResolvedValue({
            id: 'pv-2',
            task_id: 'task-123',
            version_number: 2,
            reason: 'approved',
            plan_snapshot: '[]',
            created_at: Date.now()
        });
        mockUac.createPlanVersion.mockResolvedValue('pv-3');

        const version = await service.createPlanVersion('task-123', plan, 'approved');
        expect(version.versionNumber).toBe(3);
        expect(version.reason).toBe('approved');
        expect(mockUac.createPlanVersion).toHaveBeenCalledWith(
            'task-123',
            3,
            'approved',
            expect.any(String)
        );
    });

    it('lists plan versions with parsed snapshots', async () => {
        const plan: ProjectStep[] = [{ id: 's1', text: 'Plan', status: 'pending' }];
        mockUac.getPlanVersions.mockResolvedValue([
            {
                id: 'pv-1',
                task_id: 'task-123',
                version_number: 1,
                reason: 'proposed',
                plan_snapshot: JSON.stringify(plan),
                created_at: 1739008800000
            }
        ]);

        const versions = await service.getPlanVersions('task-123');
        expect(versions).toHaveLength(1);
        expect(versions[0]?.plan[0]?.text).toBe('Plan');
        expect(versions[0]?.reason).toBe('proposed');
    });

    describe('telemetry events', () => {
        it('emits CHECKPOINT_SAVED on successful save', async () => {
            const state = createMockTaskState();
            mockUac.createCheckpoint.mockResolvedValue('cp-new');

            await service.saveCheckpoint('task-123', 2, state, 'manual_snapshot');

            expect(mockTelemetryService.track).toHaveBeenCalledWith(
                AgentCheckpointTelemetryEvent.CHECKPOINT_SAVED,
                expect.objectContaining({
                    taskId: 'task-123',
                    checkpointId: 'cp-new',
                    trigger: 'manual_snapshot',
                    stepIndex: 2,
                    durationMs: expect.any(Number)
                })
            );
        });

        it('emits CHECKPOINT_SAVED with failure details on save error', async () => {
            const state = createMockTaskState();
            mockUac.createCheckpoint.mockRejectedValue(new Error('DB write failed'));

            await expect(service.saveCheckpoint('task-123', 2, state)).rejects.toThrow();

            expect(mockTelemetryService.track).toHaveBeenCalledWith(
                AgentCheckpointTelemetryEvent.CHECKPOINT_SAVED,
                expect.objectContaining({
                    taskId: 'task-123',
                    success: false,
                    error: expect.any(String),
                    durationMs: expect.any(Number)
                })
            );
        });

        it('emits CHECKPOINT_RESTORED on successful load', async () => {
            const state = createMockTaskState();
            const snapshot = JSON.stringify({
                schemaVersion: 1,
                trigger: 'manual_snapshot',
                createdAt: 1739008800000,
                state
            });

            mockUac.getCheckpoint.mockResolvedValue({
                id: 'cp-1',
                task_id: 'task-123',
                step_index: 2,
                trigger: 'manual_snapshot',
                snapshot,
                created_at: 1739008800000
            });

            await service.loadCheckpoint('cp-1');

            expect(mockTelemetryService.track).toHaveBeenCalledWith(
                AgentCheckpointTelemetryEvent.CHECKPOINT_RESTORED,
                expect.objectContaining({
                    checkpointId: 'cp-1',
                    taskId: 'task-123',
                    trigger: 'manual_snapshot',
                    durationMs: expect.any(Number)
                })
            );
        });

        it('emits ROLLBACK_STARTED and ROLLBACK_COMPLETED on prepareRollback', async () => {
            const state = createMockTaskState();
            const snapshot = JSON.stringify({
                schemaVersion: 1,
                trigger: 'manual_snapshot',
                createdAt: Date.now(),
                state
            });

            mockUac.getCheckpoint.mockResolvedValue({
                id: 'cp-target',
                task_id: 'task-123',
                step_index: 2,
                trigger: 'manual_snapshot',
                snapshot,
                created_at: Date.now()
            });
            mockUac.createCheckpoint.mockResolvedValue('cp-pre');

            await service.prepareRollback('cp-target', state);

            expect(mockTelemetryService.track).toHaveBeenCalledWith(
                AgentCheckpointTelemetryEvent.ROLLBACK_STARTED,
                expect.objectContaining({
                    checkpointId: 'cp-target',
                    taskId: 'task-123'
                })
            );
            expect(mockTelemetryService.track).toHaveBeenCalledWith(
                AgentCheckpointTelemetryEvent.ROLLBACK_COMPLETED,
                expect.objectContaining({
                    checkpointId: 'cp-target',
                    preRollbackCheckpointId: 'cp-pre',
                    taskId: 'task-123',
                    durationMs: expect.any(Number)
                })
            );
        });

        it('does not throw when telemetry service is not set', async () => {
            const serviceWithoutTelemetry = new AgentCheckpointService(mockDatabaseService as never);
            const state = createMockTaskState();
            mockUac.createCheckpoint.mockResolvedValue('cp-no-tel');

            const id = await serviceWithoutTelemetry.saveCheckpoint('task-123', 0, state);
            expect(id).toBe('cp-no-tel');
        });
    });
});
