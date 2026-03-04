import { appLogger } from '@main/logging/logger';
import { DatabaseService } from '@main/services/data/database.service';
import { LLMService } from '@main/services/llm/llm.service';
import { GitService } from '@main/services/project/git.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { AgentCheckpointService } from '@main/services/workspace/automation-workflow/agent-checkpoint.service';
import { AgentCollaborationService } from '@main/services/workspace/automation-workflow/agent-collaboration.service';
import { AgentPerformanceService } from '@main/services/workspace/automation-workflow/agent-performance.service';
import { AgentRegistryService } from '@main/services/workspace/automation-workflow/agent-registry.service';
import { AgentTaskExecutor } from '@main/services/workspace/automation-workflow/agent-task-executor';
import { AutomationWorkflowCollaborationManager } from '@main/services/workspace/automation-workflow/automation-workflow-collaboration-manager';
import { CouncilService } from '@main/services/workspace/automation-workflow/council.service';
import { ToolExecutor } from '@main/tools/tool-executor';
import { AgentEventRecord, TaskMetrics } from '@shared/types/agent-state';
import {
    AgentStartOptions,
    AgentTaskHistoryItem,
    AutomationWorkflowState,
    AutomationWorkflowStep,
    RollbackCheckpointResult,
} from '@shared/types/automation-workflow';
import { safeJsonParse } from '@shared/utils/sanitize.util';

type TaskPriority = NonNullable<AgentStartOptions['priority']>;

interface QueuedExecutionTask {
    taskId: string;
    priority: TaskPriority;
}

const TASK_PRIORITY_SCORE: Record<TaskPriority, number> = {
    low: 1,
    normal: 2,
    high: 3,
    critical: 4,
};

export interface AutomationWorkflowTaskManagerDependencies {
    databaseService: DatabaseService;
    llmService: LLMService;
    eventBus: EventBusService;
    agentRegistryService: AgentRegistryService;
    agentCheckpointService: AgentCheckpointService;
    gitService: GitService;
    agentCollaborationService: AgentCollaborationService;
    agentPerformanceService: AgentPerformanceService;
    councilService: CouncilService;
    collaborationManager: AutomationWorkflowCollaborationManager;
}

export class AutomationWorkflowTaskManager {
    private executors = new Map<string, AgentTaskExecutor>();
    private currentTaskId: string | null = null;
    private toolExecutor?: ToolExecutor;

    private readonly databaseService: DatabaseService;
    private readonly llmService: LLMService;
    public readonly eventBus: EventBusService;
    private readonly agentRegistryService: AgentRegistryService;
    private readonly agentCheckpointService: AgentCheckpointService;
    private readonly gitService: GitService;
    private readonly agentCollaborationService: AgentCollaborationService;
    private readonly agentPerformanceService: AgentPerformanceService;
    private readonly councilService: CouncilService;
    private readonly collaborationManager: AutomationWorkflowCollaborationManager;

    private readonly activeExecutionTaskIds = new Set<string>();
    private readonly queuedExecutionTasks: QueuedExecutionTask[] = [];
    private readonly taskAgentAssignments = new Map<string, string>();
    private readonly maxConcurrentExecutionTasks = 3;
    private unsubscribeExecutionObserver?: () => void;

    constructor(deps: AutomationWorkflowTaskManagerDependencies) {
        this.databaseService = deps.databaseService;
        this.llmService = deps.llmService;
        this.eventBus = deps.eventBus;
        this.agentRegistryService = deps.agentRegistryService;
        this.agentCheckpointService = deps.agentCheckpointService;
        this.gitService = deps.gitService;
        this.agentCollaborationService = deps.agentCollaborationService;
        this.agentPerformanceService = deps.agentPerformanceService;
        this.councilService = deps.councilService;
        this.collaborationManager = deps.collaborationManager;
    }

    setToolExecutor(toolExecutor: ToolExecutor) {
        this.toolExecutor = toolExecutor;
        for (const executor of this.executors.values()) {
            executor.setToolExecutor(toolExecutor);
        }
    }

    async initialize(): Promise<void> {
        this.observeExecutionState();
        await this.restoreActiveTasks();
    }

    async cleanup(): Promise<void> {
        this.unsubscribeExecutionObserver?.();
        this.unsubscribeExecutionObserver = undefined;
        for (const executor of this.executors.values()) {
            await executor.cleanup();
        }
        this.executors.clear();
    }

    private async restoreActiveTasks(): Promise<void> {
        try {
            const tasks = await this.databaseService.uac.getTasks('');
            if (tasks.length > 0) {
                const lastTask = tasks[0];
                this.currentTaskId = lastTask.id;

                for (const task of tasks) {
                    const isTerminal = ['completed', 'failed', 'idle'].includes(task.status);
                    if (!isTerminal || task.id === this.currentTaskId) {
                        const executor = await this.getOrCreateExecutor(task.id, {
                            task: task.description,
                            workspaceId: task.project_path,
                            nodeId: task.node_id,
                            ...safeJsonParse<Record<string, unknown>>(task.metadata, {})
                        });
                        const metadata = safeJsonParse<Record<string, unknown>>(task.metadata, {});
                        const restoredAgentId = typeof metadata['agentProfileId'] === 'string'
                            ? metadata['agentProfileId']
                            : 'default';
                        this.taskAgentAssignments.set(task.id, restoredAgentId);
                        await executor.restoreStateFromDB();
                        await this.collaborationManager.getCollaborationMessages({
                            taskId: task.id,
                            includeExpired: true
                        });
                    }
                }
            }
        } catch (error) {
            appLogger.error('AutomationWorkflowTaskManager', 'Failed to restore active tasks', error as Error);
        }
    }

    private async getOrCreateExecutor(taskId: string, options: AgentStartOptions): Promise<AgentTaskExecutor> {
        let executor = this.executors.get(taskId);
        if (!executor) {
            executor = new AgentTaskExecutor(
                taskId,
                options,
                {
                    database: this.databaseService,
                    llm: this.llmService,
                    eventBus: this.eventBus,
                    registry: this.agentRegistryService,
                    checkpoint: this.agentCheckpointService,
                    git: this.gitService,
                    collaboration: this.agentCollaborationService,
                    council: this.councilService,
                }
            );
            if (this.toolExecutor) {
                executor.setToolExecutor(this.toolExecutor);
            }
            this.executors.set(taskId, executor);
        }
        return executor;
    }

    private observeExecutionState(): void {
        this.unsubscribeExecutionObserver?.();
        this.unsubscribeExecutionObserver = this.eventBus.on('project:update', payload => {
            const taskId = payload.taskId;
            if (!taskId) {
                return;
            }
            if (payload.status === 'running') {
                this.activeExecutionTaskIds.add(taskId);
                const agentId = this.taskAgentAssignments.get(taskId);
                if (agentId) {
                    this.agentCollaborationService.recordAgentTaskProgress({
                        agentId,
                        status: 'in_progress',
                        taskId
                    });
                }
                return;
            }
            const isTerminalState = ['idle', 'failed', 'completed', 'error', 'paused'].includes(
                payload.status
            );
            if (isTerminalState && this.activeExecutionTaskIds.delete(taskId)) {
                const agentId = this.taskAgentAssignments.get(taskId);
                if (agentId && (payload.status === 'completed' || payload.status === 'failed' || payload.status === 'error')) {
                    const durationMs = payload.timing?.startedAt
                        ? Date.now() - payload.timing.startedAt
                        : undefined;
                    this.agentCollaborationService.recordAgentTaskProgress({
                        agentId,
                        status: payload.status === 'completed' ? 'completed' : 'failed',
                        durationMs,
                        taskId
                    });
                }
                void this.drainExecutionQueue();
            }
        });
    }

    private getPriority(priority?: AgentStartOptions['priority']): TaskPriority {
        return priority ?? 'normal';
    }

    private enqueueExecutionTask(task: QueuedExecutionTask): void {
        this.queuedExecutionTasks.push(task);
        this.queuedExecutionTasks.sort((left, right) => {
            const leftScore = TASK_PRIORITY_SCORE[left.priority];
            const rightScore = TASK_PRIORITY_SCORE[right.priority];
            if (leftScore === rightScore) {
                return 0;
            }
            return rightScore - leftScore;
        });
    }

    private async scheduleExecutionStart(taskId: string, priority?: AgentStartOptions['priority']): Promise<boolean> {
        const normalizedPriority = this.getPriority(priority);
        if (this.activeExecutionTaskIds.has(taskId)) {
            return true;
        }
        if (this.activeExecutionTaskIds.size >= this.maxConcurrentExecutionTasks) {
            const alreadyQueued = this.queuedExecutionTasks.some(t => t.taskId === taskId);
            if (!alreadyQueued) {
                this.enqueueExecutionTask({ taskId, priority: normalizedPriority });
            }
            appLogger.info('AutomationWorkflowTaskManager', `Queued task ${taskId} with priority ${normalizedPriority}`);
            return false;
        }
        this.activeExecutionTaskIds.add(taskId);
        return true;
    }

    private async drainExecutionQueue(): Promise<void> {
        while (
            this.activeExecutionTaskIds.size < this.maxConcurrentExecutionTasks &&
            this.queuedExecutionTasks.length > 0
        ) {
            const nextTask = this.queuedExecutionTasks.shift();
            if (!nextTask) {
                return;
            }
            const executor = this.executors.get(nextTask.taskId);
            if (!executor) {
                continue;
            }
            this.activeExecutionTaskIds.add(nextTask.taskId);
            try {
                await executor.start();
            } catch (error) {
                this.activeExecutionTaskIds.delete(nextTask.taskId);
                appLogger.error('AutomationWorkflowTaskManager', `Failed to start queued task ${nextTask.taskId}`, error as Error);
                this.agentPerformanceService.recordError(nextTask.taskId, {
                    type: 'execution_start_failed',
                    message: (error as Error).message || 'Unknown error'
                });
            }
        }
    }

    public getCurrentTaskId(): string | null {
        return this.currentTaskId;
    }

    async start(options: AgentStartOptions): Promise<string> {
        const taskId = await this.databaseService.uac.createTask({
            description: options.task,
            status: 'idle',
            workspaceId: options.workspaceId || '',
            nodeId: options.nodeId,
            metadata: {
                ...options,
                agentProfileId: options.agentProfileId ?? 'default'
            } as Record<string, unknown>,
        });

        this.currentTaskId = taskId;
        const taskAgentId = options.agentProfileId ?? 'default';
        this.taskAgentAssignments.set(taskId, taskAgentId);

        this.agentPerformanceService.initializeMetrics(taskId);
        this.agentCollaborationService.recordAgentTaskProgress({
            agentId: taskAgentId,
            status: 'in_progress',
            taskId
        });
        const executor = await this.getOrCreateExecutor(taskId, options);
        const canStartNow = await this.scheduleExecutionStart(taskId, options.priority);
        if (canStartNow) {
            try {
                await executor.start();
            } catch (error) {
                this.activeExecutionTaskIds.delete(taskId);
                this.agentPerformanceService.recordError(taskId, {
                    type: 'task_start_failed',
                    message: (error as Error).message || 'Unknown error'
                });
                throw error;
            }
        }

        return taskId;
    }

    async generatePlan(options: AgentStartOptions): Promise<void> {
        const taskId = await this.databaseService.uac.createTask({
            description: options.task,
            status: 'idle',
            workspaceId: options.workspaceId || '',
            nodeId: options.nodeId,
            metadata: {
                ...options,
                agentProfileId: options.agentProfileId ?? 'default'
            } as Record<string, unknown>,
        });

        this.currentTaskId = taskId;
        const taskAgentId = options.agentProfileId ?? 'default';
        this.taskAgentAssignments.set(taskId, taskAgentId);

        this.agentPerformanceService.initializeMetrics(taskId);
        this.agentCollaborationService.recordAgentTaskProgress({
            agentId: taskAgentId,
            status: 'in_progress',
            taskId
        });
        const executor = await this.getOrCreateExecutor(taskId, options);
        await executor.generatePlan();
    }

    async stop(taskId?: string): Promise<void> {
        const targetId = taskId || this.currentTaskId;
        if (!targetId) { return; }

        this.activeExecutionTaskIds.delete(targetId);
        const queueIndex = this.queuedExecutionTasks.findIndex(entry => entry.taskId === targetId);
        if (queueIndex !== -1) {
            this.queuedExecutionTasks.splice(queueIndex, 1);
        }

        const executor = this.executors.get(targetId);
        if (executor) {
            await executor.stop();
        }
    }

    async pauseTask(taskId?: string): Promise<void> {
        const targetId = taskId || this.currentTaskId;
        if (!targetId) { return; }

        const executor = this.executors.get(targetId);
        if (executor) {
            await executor.pause();
        }
    }

    async resumeTask(taskId: string): Promise<boolean> {
        const executor = this.executors.get(taskId);
        if (executor) {
            await executor.start();
            return true;
        }
        return false;
    }

    async approvePlan(plan: AutomationWorkflowStep[] | string[], taskId?: string): Promise<void> {
        const targetId = taskId || this.currentTaskId;
        if (!targetId) { return; }

        const executor = this.executors.get(targetId);
        if (executor) {
            this.activeExecutionTaskIds.add(targetId);
            await executor.approvePlan(plan);
        }
    }

    async approveCurrentPlan(taskId: string): Promise<boolean> {
        const executor = this.executors.get(taskId);
        if (!executor) { return false; }

        const status = executor.getStatus();
        if (status.status !== 'waiting_for_approval') { return false; }

        await executor.approvePlan(status.plan);
        return true;
    }

    async rejectCurrentPlan(taskId: string, _reason?: string): Promise<boolean> {
        const executor = this.executors.get(taskId);
        if (!executor) { return false; }

        await executor.stop();
        return true;
    }

    async getStatus(taskId?: string): Promise<AutomationWorkflowState> {
        const targetId = taskId || this.currentTaskId;
        if (!targetId) {
            return {
                status: 'idle',
                currentTask: '',
                plan: [],
                history: [],
                totalTokens: { prompt: 0, completion: 0 }
            };
        }

        const executor = this.executors.get(targetId);
        if (executor) {
            return executor.getStatus();
        }

        return {
            status: 'idle',
            currentTask: '',
            plan: [],
            history: [],
            totalTokens: { prompt: 0, completion: 0 }
        };
    }

    async retryStep(index: number, taskId?: string): Promise<void> {
        const targetId = taskId || this.currentTaskId;
        if (!targetId) { return; }

        const executor = this.executors.get(targetId);
        if (executor) {
            await executor.retryStep(index);
        }
    }

    async approveStep(taskId: string, stepId: string): Promise<void> {
        const executor = this.executors.get(taskId);
        if (executor) {
            await executor.approveStep(stepId);
        }
    }

    async skipStep(taskId: string, stepId: string): Promise<void> {
        const executor = this.executors.get(taskId);
        if (executor) {
            await executor.skipStep(stepId);
        }
    }

    async editStep(taskId: string, stepId: string, newText: string): Promise<void> {
        const executor = this.executors.get(taskId);
        if (executor) {
            await executor.editStep(stepId, newText);
        }
    }

    async addStepComment(taskId: string, stepId: string, comment: string): Promise<void> {
        const executor = this.executors.get(taskId);
        if (executor) {
            await executor.addStepComment(stepId, comment);
        }
    }

    async insertInterventionPoint(taskId: string, afterStepId: string): Promise<void> {
        const executor = this.executors.get(taskId);
        if (executor) {
            await executor.insertInterventionPoint(afterStepId);
        }
    }

    async resetState(taskId?: string): Promise<void> {
        const targetId = taskId || this.currentTaskId;
        if (!targetId) { return; }

        await this.stop(targetId);
        this.executors.delete(targetId);
        this.taskAgentAssignments.delete(targetId);

        if (targetId === this.currentTaskId) {
            this.currentTaskId = null;
        }
    }

    async getTaskHistory(workspaceId: string): Promise<AgentTaskHistoryItem[]> {
        try {
            const tasks = await this.databaseService.uac.getTasks(workspaceId);
            return await Promise.all(tasks.map(async task => {
                const metadata = safeJsonParse<Record<string, unknown>>(task.metadata, {});
                const modelData = metadata['model'] as { provider?: string; model?: string } | undefined;

                const isRunning = ['running', 'planning', 'waiting_for_approval'].includes(task.status);
                let latestCheckpointId;
                if (!isRunning) {
                    const checkpoint = await this.agentCheckpointService.getLatestCheckpoint(task.id);
                    latestCheckpointId = checkpoint?.id;
                }

                return {
                    id: task.id,
                    description: task.description,
                    provider: modelData?.provider ?? 'unknown',
                    model: modelData?.model ?? 'unknown',
                    status: task.status as AgentTaskHistoryItem['status'],
                    createdAt: task.created_at,
                    updatedAt: task.updated_at,
                    latestCheckpointId,
                };
            }));
        } catch (error) {
            appLogger.error('AutomationWorkflowTaskManager', 'Failed to get task history', error as Error);
            return [];
        }
    }

    async getCheckpoints(taskId: string) {
        return this.agentCheckpointService.getCheckpoints(taskId);
    }

    async getPlanVersions(taskId: string) {
        return this.agentCheckpointService.getPlanVersions(taskId);
    }

    async resumeFromCheckpoint(checkpointId: string): Promise<void> {
        const checkpoint = await this.agentCheckpointService.loadCheckpoint(checkpointId);
        if (!checkpoint) { return; }

        const taskId = checkpoint.taskId;
        const executor = await this.getOrCreateExecutor(taskId, {
            task: 'Resumed Task',
            workspaceId: ''
        });

        await executor.rollback(checkpointId);
    }

    async rollbackCheckpoint(checkpointId: string): Promise<RollbackCheckpointResult> {
        const checkpoint = await this.agentCheckpointService.loadCheckpoint(checkpointId);
        if (!checkpoint) { throw new Error('Checkpoint not found'); }

        const executor = await this.getOrCreateExecutor(checkpoint.taskId, {
            task: 'Resumed Task',
            workspaceId: ''
        });

        return await executor.rollback(checkpointId);
    }

    async saveSnapshot(taskId: string): Promise<string> {
        const executor = this.executors.get(taskId);
        if (executor) {
            return await executor.saveManualSnapshot();
        }

        const latestCheckpoint = await this.agentCheckpointService.getLatestCheckpoint(taskId);
        if (latestCheckpoint?.id) {
            return latestCheckpoint.id;
        }

        throw new Error(`Unable to save snapshot for task ${taskId}`);
    }

    async deleteTask(taskId: string): Promise<boolean> {
        await this.stop(taskId);
        this.executors.delete(taskId);
        this.taskAgentAssignments.delete(taskId);
        await this.databaseService.uac.deleteTask(taskId);
        return true;
    }

    async deleteTaskByNodeId(nodeId: string): Promise<boolean> {
        const tasks = await this.databaseService.uac.getTasks('');
        const task = tasks.find(t => t.node_id === nodeId);
        if (task) {
            return this.deleteTask(task.id);
        }
        return false;
    }

    async selectModel(taskId: string, provider: string, model: string): Promise<boolean> {
        const executor = this.executors.get(taskId);
        if (executor) {
            const status = executor.getStatus();
            if (status.config) {
                status.config.model = { provider, model };
            }
        }

        const task = await this.databaseService.uac.getTask(taskId);
        if (!task) {
            return false;
        }

        const metadata = safeJsonParse<Record<string, unknown>>(task.metadata, {});
        metadata['model'] = { provider, model };
        await this.databaseService.uac.updateTaskMetadata(taskId, metadata);
        return true;
    }

    async getTaskStatusDetails(taskId: string) { return this.getStatus(taskId); }
    async getTaskMessages(taskId: string) {
        const status = await this.getStatus(taskId);
        return { success: true, messages: status.history };
    }
    async getTaskEvents(taskId: string) {
        const latestCheckpoint = await this.agentCheckpointService.getLatestCheckpoint(taskId);
        const events = latestCheckpoint?.state?.eventHistory ?? [];
        return { success: true, events: events as AgentEventRecord[] };
    }
    async getTaskTelemetry(taskId: string) {
        const metrics = await this.agentPerformanceService.loadMetrics(taskId);
        if (!metrics) {
            return { success: true, telemetry: [] as TaskMetrics[] };
        }

        const checkpoint = await this.agentCheckpointService.getLatestCheckpoint(taskId);
        const state = checkpoint?.state;

        const providerNames = (state?.providerHistory ?? []).map(
            (p: { provider: string }) => p.provider
        );
        const uniqueProviders = Array.from(new Set(providerNames));

        const telemetry: TaskMetrics = {
            duration: metrics.resources.totalExecutionTimeMs,
            llmCalls: metrics.resources.apiCallCount,
            toolCalls: state?.metrics?.toolCalls ?? 0,
            tokensUsed: metrics.resources.totalTokensUsed,
            providersUsed: uniqueProviders,
            errorCount: metrics.errors.totalErrors,
            recoveryCount: state?.recoveryAttempts ?? 0,
            estimatedCost: metrics.resources.totalCostUsd,
        };
        return { success: true, telemetry: [telemetry] };
    }

    async getPerformanceMetrics(taskId: string) {
        return this.agentPerformanceService.getMetrics(taskId) ?? null;
    }

    async createPullRequest(taskId?: string): Promise<{ success: boolean; url?: string; error?: string }> {
        const targetId = taskId || this.currentTaskId;
        if (!targetId) {
            return { success: false, error: 'taskId is required' };
        }

        const executor = this.executors.get(targetId);
        if (!executor) {
            return { success: false, error: 'Task not found' };
        }

        return await executor.createPullRequest();
    }
}
