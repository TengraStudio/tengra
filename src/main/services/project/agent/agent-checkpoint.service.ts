import { createHash } from 'crypto';
import { gunzipSync, gzipSync } from 'zlib';

import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import {
    AgentCheckpointSnapshotV1Schema,
    AgentTaskStateSchema
} from '@shared/schemas/agent-checkpoint.schema';
import { AgentTaskState } from '@shared/types/agent-state';
import {
    AgentCheckpointItem,
    AgentCheckpointSnapshotV1,
    AgentCheckpointTrigger,
    PlanVersionItem,
    ProjectStep
} from '@shared/types/project-agent';
import { safeJsonParse } from '@shared/utils/sanitize.util';

/** Standardized error for agent checkpointing */
export class AgentCheckpointError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'AgentCheckpointError';
    }
}

/** Telemetry events emitted by AgentCheckpointService */
export enum AgentCheckpointTelemetryEvent {
    CHECKPOINT_SAVED = 'agent_checkpoint_saved',
    CHECKPOINT_RESTORED = 'agent_checkpoint_restored',
    CHECKPOINT_DELETED = 'agent_checkpoint_deleted',
    ROLLBACK_STARTED = 'agent_checkpoint_rollback_started',
    ROLLBACK_COMPLETED = 'agent_checkpoint_rollback_completed',
    CHECKPOINT_COMPRESSED = 'agent_checkpoint_compressed',
    CHECKPOINT_LIMIT_REACHED = 'agent_checkpoint_limit_reached'
}

/** Performance regression budgets (in milliseconds) for checkpoint operations */
export const AGENT_CHECKPOINT_PERFORMANCE_BUDGETS = {
    SAVE_CHECKPOINT_MS: 2000,
    RESTORE_CHECKPOINT_MS: 2000,
    DELETE_CHECKPOINT_MS: 500,
    ROLLBACK_MS: 5000,
    COMPRESS_MS: 1000,
    LIST_CHECKPOINTS_MS: 500,
    INITIALIZE_MS: 100
} as const;

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

/** Health metrics for the agent checkpoint subsystem */
export interface AgentCheckpointHealth {
    totalSaves: number;
    totalLoads: number;
    totalRollbacks: number;
    totalErrors: number;
    avgSaveDurationMs: number;
    avgLoadDurationMs: number;
    budgetBreaches: number;
}

export class AgentCheckpointService extends BaseService {
    private telemetryService: TelemetryService | null = null;
    private totalSaves = 0;
    private totalLoads = 0;
    private totalRollbacks = 0;
    private totalErrors = 0;
    private totalSaveDurationMs = 0;
    private totalLoadDurationMs = 0;
    private budgetBreaches = 0;

    constructor(private databaseService: DatabaseService) {
        super('AgentCheckpointService');
    }

    /** Set the telemetry service dependency */
    setTelemetryService(service: TelemetryService): void {
        this.telemetryService = service;
    }

    /** Track telemetry event if service is available */
    private trackEvent(eventName: AgentCheckpointTelemetryEvent, properties?: Record<string, unknown>): void {
        if (this.telemetryService) {
            this.telemetryService.track(eventName, properties);
        }
    }

    /**
     * Warn and track when an operation exceeds its performance budget.
     * @param method - The method name being measured
     * @param startTime - Start timestamp from performance.now()
     * @param budgetMs - Budget in milliseconds
     */
    private warnIfOverBudget(method: string, startTime: number, budgetMs: number): void {
        const elapsed = performance.now() - startTime;
        if (elapsed > budgetMs) {
            this.budgetBreaches++;
            this.logWarn(`Performance budget exceeded for ${method}`, {
                elapsedMs: Math.round(elapsed),
                budgetMs,
            });
        }
    }

    /** Returns health dashboard metrics for this service */
    getHealthMetrics(): AgentCheckpointHealth {
        return {
            totalSaves: this.totalSaves,
            totalLoads: this.totalLoads,
            totalRollbacks: this.totalRollbacks,
            totalErrors: this.totalErrors,
            avgSaveDurationMs: this.totalSaves > 0
                ? Math.round(this.totalSaveDurationMs / this.totalSaves)
                : 0,
            avgLoadDurationMs: this.totalLoads > 0
                ? Math.round(this.totalLoadDurationMs / this.totalLoads)
                : 0,
            budgetBreaches: this.budgetBreaches,
        };
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
        if (!taskId) {throw new AgentCheckpointError('taskId is required', 'MISSING_TASK_ID');}
        const perfStart = performance.now();
        const startTime = Date.now();

        try {
            AgentTaskStateSchema.parse(state);

            if (trigger === 'auto_state_sync') {
                const latestCheckpointId = await this.skipIfDuplicate(taskId, state);
                if (latestCheckpointId) {return latestCheckpointId;}
            }

            const snapshot = this.serializeSnapshot(state, trigger);
            const checkpointId = await this.databaseService.uac.createCheckpoint(
                taskId, stepIndex, trigger, snapshot
            );
            await this.databaseService.uac.trimCheckpoints(taskId, MAX_CHECKPOINTS_PER_TASK);
            const durationMs = Date.now() - startTime;
            this.totalSaves++;
            this.totalSaveDurationMs += durationMs;
            this.logInfo(`Saved checkpoint ${checkpointId} for task ${taskId} (trigger: ${trigger})`);
            this.trackEvent(AgentCheckpointTelemetryEvent.CHECKPOINT_SAVED, {
                taskId, checkpointId, trigger, stepIndex, durationMs
            });
            return checkpointId;
        } catch (error) {
            this.totalErrors++;
            const durationMs = Date.now() - startTime;
            this.trackEvent(AgentCheckpointTelemetryEvent.CHECKPOINT_SAVED, {
                taskId, trigger, stepIndex, durationMs, success: false,
                error: (error as Error).message
            });
            throw new AgentCheckpointError('Failed to save checkpoint', 'SAVE_FAILED', { error, taskId });
        } finally {
            this.warnIfOverBudget('saveCheckpoint', perfStart, AGENT_CHECKPOINT_PERFORMANCE_BUDGETS.SAVE_CHECKPOINT_MS);
        }
    }

    private async skipIfDuplicate(taskId: string, state: AgentTaskState): Promise<string | null> {
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
        return null;
    }

    async getCheckpoints(taskId: string): Promise<AgentCheckpointItem[]> {
        const perfStart = performance.now();
        const rows = await this.databaseService.uac.getCheckpoints(taskId);

        this.warnIfOverBudget('getCheckpoints', perfStart, AGENT_CHECKPOINT_PERFORMANCE_BUDGETS.LIST_CHECKPOINTS_MS);
        return rows.map(row => ({
            id: row.id,
            taskId: row.task_id,
            stepIndex: row.step_index,
            trigger: this.normalizeTrigger(row.trigger),
            createdAt: row.created_at
        }));
    }

    async loadCheckpoint(checkpointId: string): Promise<AgentCheckpointItem | null> {
        const perfStart = performance.now();
        const startTime = Date.now();
        try {
            const row = await this.databaseService.uac.getCheckpoint(checkpointId);
            if (!row) {
                return null;
            }

            const parsed = this.parseSnapshot(row.snapshot, row.trigger, row.created_at);
            const durationMs = Date.now() - startTime;
            this.totalLoads++;
            this.totalLoadDurationMs += durationMs;
            this.trackEvent(AgentCheckpointTelemetryEvent.CHECKPOINT_RESTORED, {
                checkpointId, taskId: row.task_id, trigger: row.trigger, durationMs
            });
            return {
                id: row.id,
                taskId: row.task_id,
                stepIndex: row.step_index,
                trigger: parsed.trigger,
                createdAt: parsed.createdAt,
                state: parsed.state
            };
        } catch (error) {
            this.totalErrors++;
            throw new AgentCheckpointError(
                'Failed to load checkpoint', 'LOAD_FAILED',
                { error, checkpointId }
            );
        } finally {
            this.warnIfOverBudget('loadCheckpoint', perfStart, AGENT_CHECKPOINT_PERFORMANCE_BUDGETS.RESTORE_CHECKPOINT_MS);
        }
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
        const perfStart = performance.now();
        const startTime = Date.now();
        this.trackEvent(AgentCheckpointTelemetryEvent.ROLLBACK_STARTED, {
            checkpointId, taskId: currentState.taskId
        });

        try {
            const checkpoint = await this.loadCheckpoint(checkpointId);
            if (!checkpoint?.state) {
                throw new AgentCheckpointError(
                    `Checkpoint ${checkpointId} not found`,
                    'CHECKPOINT_NOT_FOUND',
                    { checkpointId }
                );
            }

            const preRollbackCheckpointId = await this.saveCheckpoint(
                currentState.taskId,
                currentState.currentStep,
                currentState,
                'pre_rollback'
            );

            const durationMs = Date.now() - startTime;
            this.totalRollbacks++;
            this.trackEvent(AgentCheckpointTelemetryEvent.ROLLBACK_COMPLETED, {
                checkpointId, preRollbackCheckpointId,
                taskId: currentState.taskId, durationMs
            });

            return { resumedCheckpoint: checkpoint, preRollbackCheckpointId };
        } catch (error) {
            if (error instanceof AgentCheckpointError) { throw error; }
            this.totalErrors++;
            throw new AgentCheckpointError(
                'Rollback preparation failed', 'ROLLBACK_FAILED',
                { error, checkpointId }
            );
        } finally {
            this.warnIfOverBudget('prepareRollback', perfStart, AGENT_CHECKPOINT_PERFORMANCE_BUDGETS.ROLLBACK_MS);
        }
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
        try {
            const snapshot: AgentCheckpointSnapshotV1 = {
                schemaVersion: 1,
                trigger,
                createdAt: Date.now(),
                state
            };

            // Double check validation before compression
            AgentCheckpointSnapshotV1Schema.parse(snapshot);

            const serialized = JSON.stringify(snapshot);
            const compressed = gzipSync(Buffer.from(serialized, 'utf8'));
            return `${CHECKPOINT_SNAPSHOT_PREFIX}${compressed.toString('base64')}`;
        } catch (error) {
            throw new AgentCheckpointError('Failed to serialize snapshot', 'SERIALIZATION_FAILED', { error });
        }
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
