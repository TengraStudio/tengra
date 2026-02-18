import { createHash } from 'crypto';
import { gunzipSync, gzipSync } from 'zlib';

import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { AgentTaskState } from '@shared/types/agent-state';
import {
    AgentCheckpointItem,
    AgentCheckpointSnapshotV1,
    AgentCheckpointTrigger,
    PlanVersionItem,
    ProjectStep
} from '@shared/types/project-agent';
import { safeJsonParse } from '@shared/utils/sanitize.util';

interface RollbackPreparation {
    resumedCheckpoint: AgentCheckpointItem;
    preRollbackCheckpointId: string;
}

const CHECKPOINT_TRIGGER_VALUES: AgentCheckpointTrigger[] = [
    'manual_snapshot',
    'auto_step_completion',
    'auto_state_sync',
    'pre_rollback',
    'rollback_resume',
    'resume_restore'
];

const CHECKPOINT_SNAPSHOT_PREFIX = 'gzip:';
const MAX_CHECKPOINTS_PER_TASK = 200;

export class AgentCheckpointService extends BaseService {
    constructor(private databaseService: DatabaseService) {
        super('AgentCheckpointService');
    }

    async initialize(): Promise<void> {
        this.logInfo('AgentCheckpointService initialized');
    }

    async saveCheckpoint(
        taskId: string,
        stepIndex: number,
        state: AgentTaskState,
        trigger: AgentCheckpointTrigger = 'manual_snapshot'
    ): Promise<string> {
        if (trigger === 'auto_state_sync') {
            const latestCheckpoint = await this.databaseService.uac.getLatestCheckpoint(taskId);
            if (latestCheckpoint) {
                const parsedLatest = this.parseSnapshot(
                    latestCheckpoint.snapshot,
                    latestCheckpoint.trigger,
                    latestCheckpoint.created_at
                );
                const latestHash = this.createStateFingerprint(parsedLatest.state);
                const nextHash = this.createStateFingerprint(state);
                if (latestHash === nextHash) {
                    return latestCheckpoint.id;
                }
            }
        }

        const snapshot = this.serializeSnapshot(state, trigger);
        const checkpointId = await this.databaseService.uac.createCheckpoint(
            taskId,
            stepIndex,
            trigger,
            snapshot
        );
        await this.databaseService.uac.trimCheckpoints(taskId, MAX_CHECKPOINTS_PER_TASK);
        return checkpointId;
    }

    async getCheckpoints(taskId: string): Promise<AgentCheckpointItem[]> {
        const rows = await this.databaseService.uac.getCheckpoints(taskId);

        return rows.map(row => ({
            id: row.id,
            taskId: row.task_id,
            stepIndex: row.step_index,
            trigger: this.normalizeTrigger(row.trigger),
            createdAt: row.created_at
        }));
    }

    async loadCheckpoint(checkpointId: string): Promise<AgentCheckpointItem | null> {
        const row = await this.databaseService.uac.getCheckpoint(checkpointId);
        if (!row) {
            return null;
        }

        const parsed = this.parseSnapshot(row.snapshot, row.trigger, row.created_at);
        return {
            id: row.id,
            taskId: row.task_id,
            stepIndex: row.step_index,
            trigger: parsed.trigger,
            createdAt: parsed.createdAt,
            state: parsed.state
        };
    }

    async getLatestCheckpoint(taskId: string): Promise<AgentCheckpointItem | null> {
        const row = await this.databaseService.uac.getLatestCheckpoint(taskId);
        if (!row) {
            return null;
        }

        const parsed = this.parseSnapshot(row.snapshot, row.trigger, row.created_at);
        return {
            id: row.id,
            taskId: row.task_id,
            stepIndex: row.step_index,
            trigger: parsed.trigger,
            createdAt: parsed.createdAt,
            state: parsed.state
        };
    }

    async prepareRollback(checkpointId: string, currentState: AgentTaskState): Promise<RollbackPreparation> {
        const checkpoint = await this.loadCheckpoint(checkpointId);
        if (!checkpoint?.state) {
            throw new Error(`Checkpoint ${checkpointId} not found`);
        }

        const preRollbackCheckpointId = await this.saveCheckpoint(
            currentState.taskId,
            currentState.currentStep,
            currentState,
            'pre_rollback'
        );

        return {
            resumedCheckpoint: checkpoint,
            preRollbackCheckpointId
        };
    }

    async createPlanVersion(
        taskId: string,
        plan: ProjectStep[],
        reason: PlanVersionItem['reason']
    ): Promise<PlanVersionItem> {
        const latest = await this.databaseService.uac.getLatestPlanVersion(taskId);
        const versionNumber = (latest?.version_number ?? 0) + 1;
        const createdAt = Date.now();

        const id = await this.databaseService.uac.createPlanVersion(
            taskId,
            versionNumber,
            reason,
            JSON.stringify(plan),
        );

        return {
            id,
            taskId,
            versionNumber,
            reason,
            plan,
            createdAt
        };
    }

    async getPlanVersions(taskId: string): Promise<PlanVersionItem[]> {
        const rows = await this.databaseService.uac.getPlanVersions(taskId);
        return rows.map(row => ({
            id: row.id,
            taskId: row.task_id,
            versionNumber: row.version_number,
            reason: this.normalizePlanVersionReason(row.reason),
            plan: safeJsonParse<ProjectStep[]>(row.plan_snapshot, []),
            createdAt: row.created_at
        }));
    }

    private serializeSnapshot(state: AgentTaskState, trigger: AgentCheckpointTrigger): string {
        const snapshot: AgentCheckpointSnapshotV1 = {
            schemaVersion: 1,
            trigger,
            createdAt: Date.now(),
            state
        };

        const serialized = JSON.stringify(snapshot);
        const compressed = gzipSync(Buffer.from(serialized, 'utf8'));
        return `${CHECKPOINT_SNAPSHOT_PREFIX}${compressed.toString('base64')}`;
    }

    private parseSnapshot(
        snapshotText: string,
        fallbackTrigger: string,
        fallbackCreatedAt: number
    ): { trigger: AgentCheckpointTrigger; createdAt: number; state: AgentTaskState } {
        const decodedSnapshot = this.decodeSnapshot(snapshotText);
        const parsed = safeJsonParse<AgentCheckpointSnapshotV1 | AgentTaskState | null>(
            decodedSnapshot,
            null
        );
        if (!parsed) {
            throw new Error('Invalid checkpoint snapshot payload');
        }

        if (this.isSnapshotEnvelope(parsed)) {
            return {
                trigger: this.normalizeTrigger(parsed.trigger),
                createdAt: parsed.createdAt,
                state: this.hydrateStateDates(parsed.state)
            };
        }

        return {
            trigger: this.normalizeTrigger(fallbackTrigger),
            createdAt: fallbackCreatedAt,
            state: this.hydrateStateDates(parsed)
        };
    }

    private decodeSnapshot(snapshotText: string): string {
        if (!snapshotText.startsWith(CHECKPOINT_SNAPSHOT_PREFIX)) {
            return snapshotText;
        }

        const compressedPayload = snapshotText.slice(CHECKPOINT_SNAPSHOT_PREFIX.length);
        try {
            const compressed = Buffer.from(compressedPayload, 'base64');
            return gunzipSync(compressed).toString('utf8');
        } catch (error) {
            throw new Error(`Invalid compressed checkpoint snapshot: ${(error as Error).message}`);
        }
    }

    private isSnapshotEnvelope(value: AgentCheckpointSnapshotV1 | AgentTaskState): value is AgentCheckpointSnapshotV1 {
        return (
            'schemaVersion' in value &&
            'trigger' in value &&
            'createdAt' in value &&
            'state' in value
        );
    }

    private normalizeTrigger(value: string): AgentCheckpointTrigger {
        if (CHECKPOINT_TRIGGER_VALUES.includes(value as AgentCheckpointTrigger)) {
            return value as AgentCheckpointTrigger;
        }
        return 'manual_snapshot';
    }

    private normalizePlanVersionReason(value: string): PlanVersionItem['reason'] {
        if (value === 'proposed' || value === 'approved' || value === 'rollback' || value === 'manual') {
            return value;
        }
        return 'manual';
    }

    private hydrateStateDates(state: AgentTaskState): AgentTaskState {
        return {
            ...state,
            createdAt: new Date(state.createdAt),
            updatedAt: new Date(state.updatedAt),
            startedAt: state.startedAt ? new Date(state.startedAt) : null,
            completedAt: state.completedAt ? new Date(state.completedAt) : null,
            plan: state.plan ? {
                ...state.plan,
                steps: state.plan.steps.map(step => ({
                    ...step,
                    startedAt: step.startedAt ? new Date(step.startedAt) : undefined,
                    completedAt: step.completedAt ? new Date(step.completedAt) : undefined
                }))
            } : null,
            eventHistory: state.eventHistory.map(evt => ({
                ...evt,
                timestamp: new Date(evt.timestamp)
            })),
            errors: state.errors.map(err => ({
                ...err,
                timestamp: new Date(err.timestamp)
            })),
            providerHistory: state.providerHistory.map(providerAttempt => ({
                ...providerAttempt,
                startedAt: new Date(providerAttempt.startedAt),
                endedAt: providerAttempt.endedAt ? new Date(providerAttempt.endedAt) : undefined
            }))
        };
    }

    private createStateFingerprint(state: AgentTaskState): string {
        const serialized = JSON.stringify(state, (_key, value) => {
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        });
        return createHash('sha256').update(serialized).digest('hex');
    }
}
