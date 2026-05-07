/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ipc } from '@main/core/ipc-decorators';
import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { LLMService } from '@main/services/llm/llm.service';
import { ModelSelectionService } from '@main/services/llm/model-selection.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import { serializeToIpc } from '@main/utils/ipc-serializer.util';
import { SESSION_COUNCIL_CHANNELS } from '@shared/constants/ipc-channels';
import { IpcValue,JsonObject, RuntimeValue } from '@shared/types/common';
import {
    ModelRoutingRule,
    StepModelConfig,
    TaskType,
    WorkspaceStep,
} from '@shared/types/council';
import { randomUUID } from 'node:crypto';

/** Default model routing rules based on task type */
const DEFAULT_ROUTING_RULES: ModelRoutingRule[] = [
    { taskType: 'code_generation', provider: 'openai', model: 'gpt-4o', priority: 100 },
    { taskType: 'code_generation', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 90 },
    { taskType: 'code_review', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 100 },
    { taskType: 'code_review', provider: 'openai', model: 'gpt-4o', priority: 80 },
    { taskType: 'research', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 100 },
    { taskType: 'research', provider: 'google', model: 'gemini-1.5-pro', priority: 85 },
    { taskType: 'documentation', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 95 },
    { taskType: 'documentation', provider: 'openai', model: 'gpt-4o', priority: 90 },
    { taskType: 'debugging', provider: 'openai', model: 'gpt-4o', priority: 100 },
    { taskType: 'debugging', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 90 },
    { taskType: 'testing', provider: 'openai', model: 'gpt-4o', priority: 95 },
    { taskType: 'testing', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 90 },
    { taskType: 'refactoring', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 100 },
    { taskType: 'refactoring', provider: 'openai', model: 'gpt-4o', priority: 85 },
    { taskType: 'planning', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 100 },
    { taskType: 'planning', provider: 'openai', model: 'o1', priority: 95 },
    { taskType: 'general', provider: 'openai', model: 'gpt-4o', priority: 90 },
    { taskType: 'general', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 90 },
];

export interface CouncilCapabilityDependencies {
    llm: LLMService;
    proxy: ProxyService;
    modelSelectionService: ModelSelectionService;
    databaseService: DatabaseService;
}

interface StoredChat {
    id: string;
    metadata?: JsonObject;
}

interface TimelineEventRecord {
    id: string;
    timestamp: number;
    type: string;
    stateBeforeTransition: string;
    stateAfterTransition: string;
    payload?: IpcValue;
}

const WORKSPACE_AGENT_METADATA_KEY = 'workspaceAgentSession';

function readJsonObject(value: JsonObject | undefined, key: string): JsonObject | null {
    const candidate = value?.[key];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return null;
    }
    return candidate as JsonObject;
}

function getSessionMetadata(chat: StoredChat): JsonObject {
    return readJsonObject(chat.metadata, WORKSPACE_AGENT_METADATA_KEY) ?? {};
}

function buildFallbackPlan(task: string): WorkspaceStep[] {
    return [
        {
            id: randomUUID(),
            text: task.trim(),
            status: 'pending',
            priority: 'normal',
            taskType: 'general',
        },
    ];
}

function normalizeWorkspaceSteps(rawSteps: RuntimeValue): WorkspaceStep[] {
    if (!Array.isArray(rawSteps)) {
        return [];
    }

    const isTaskType = (value: RuntimeValue): value is TaskType =>
        value === 'code_generation' ||
        value === 'code_review' ||
        value === 'research' ||
        value === 'documentation' ||
        value === 'debugging' ||
        value === 'testing' ||
        value === 'refactoring' ||
        value === 'planning' ||
        value === 'general';

    return rawSteps
        .filter((step): step is Record<string, RuntimeValue> => Boolean(step) && typeof step === 'object' && !Array.isArray(step))
        .map((step, index) => ({
            id: typeof step.id === 'string' && step.id.trim().length > 0 ? step.id : `step-${index + 1}`,
            text: typeof step.text === 'string' && step.text.trim().length > 0 ? step.text : `Step ${index + 1}`,
            status:
                step.status === 'running' ||
                step.status === 'completed' ||
                step.status === 'failed' ||
                step.status === 'skipped' ||
                step.status === 'awaiting_step_approval'
                    ? step.status
                    : 'pending',
            priority:
                step.priority === 'low' ||
                step.priority === 'high' ||
                step.priority === 'critical'
                    ? step.priority
                    : 'normal',
            taskType: isTaskType(step.taskType) ? step.taskType : 'general',
        }));
}

function readStoredPlan(chat: StoredChat): WorkspaceStep[] {
    const metadata = getSessionMetadata(chat);
    const council = readJsonObject(metadata, 'council');
    const rawProposal = council?.['proposal'];
    if (Array.isArray(rawProposal)) {
        return normalizeWorkspaceSteps(rawProposal);
    }

    const rawDrafts = council?.['drafts'];
    if (Array.isArray(rawDrafts) && rawDrafts.length > 0) {
        return rawDrafts.map((draft, index) => ({
            id:
                typeof (draft as Record<string, unknown>).id === 'string'
                    ? String((draft as Record<string, unknown>).id)
                    : `draft-${index + 1}`,
            text:
                typeof (draft as Record<string, unknown>).patchSummary === 'string' &&
                String((draft as Record<string, unknown>).patchSummary).trim().length > 0
                    ? String((draft as Record<string, unknown>).patchSummary)
                    : `Draft ${index + 1}`,
            status: 'pending',
            priority: 'normal',
            taskType: 'general',
        }));
    }

    return [];
}

function toTimelineEvent(log: { id: string; created_at: number; role: string; content: string }): TimelineEventRecord {
    return {
        id: log.id,
        timestamp: log.created_at,
        type: log.role === 'system' ? 'PLAN_READY' : 'MESSAGE',
        stateBeforeTransition: 'planning',
        stateAfterTransition: 'executing',
        payload: {
            content: log.content,
            role: log.role,
        },
    };
}

/**
 * CouncilCapabilityService centralizes quota-aware council planning so any
 * session mode can opt into the same behavior without inheriting workflow-only names.
 */
export class CouncilCapabilityService extends BaseService {
    private rules: ModelRoutingRule[] = [...DEFAULT_ROUTING_RULES];

    constructor(private readonly deps: CouncilCapabilityDependencies) {
        super('CouncilCapabilityService');
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing council capability...');
    }

    async prepareCouncilPlan(taskId: string, steps: WorkspaceStep[]): Promise<WorkspaceStep[]> {
        this.logInfo(
            `Preparing council plan for task ${taskId} with ${steps.length} steps`
        );

        const enrichedSteps = await Promise.all(
            steps.map(async step => {
                const bestModel = await this.routeWithQuotaAwareness(step);
                return {
                    ...step,
                    modelConfig: bestModel,
                    requiresApproval:
                        step.priority === 'high' || step.priority === 'critical',
                } as WorkspaceStep;
            })
        );

        this.logInfo(`Council plan prepared for task ${taskId}`);
        return enrichedSteps;
    }

    async handleDynamicReassignment(step: WorkspaceStep): Promise<WorkspaceStep> {
        this.logWarn(`Dynamic reassignment triggered for step: ${step.id}`);
        return step;
    }

    override async cleanup(): Promise<void> {
        this.logInfo('Cleaning up council capability...');
    }

    private async routeWithQuotaAwareness(
        step: WorkspaceStep
    ): Promise<StepModelConfig> {
        const availableProviders = await this.deps.llm.getAvailableProviders();
        const taskType = step.taskType || this.detectTaskType(step.text);
        let defaultConfig = this.routeByTaskType(taskType, availableProviders);
        const recommendation = await this.deps.modelSelectionService.recommendBackgroundModel();
        const suggested = recommendation.selection;
        if (
            suggested &&
            availableProviders.includes(suggested.provider) &&
            (taskType === 'general' || taskType === 'planning')
        ) {
            defaultConfig = {
                provider: suggested.provider,
                model: suggested.model,
                reason: `ModelSelectionService recommendation: ${recommendation.reason}`,
            };
        }

        try {
            const provider = defaultConfig.provider.toLowerCase();

            if (provider.includes('antigravity') || provider.includes('google')) {
                const quotas = await this.deps.proxy.getAntigravityAvailableModels();
                const modelQuota = quotas.find(
                    quota =>
                        quota.id === defaultConfig.model ||
                        quota.name === defaultConfig.model
                );

                if (modelQuota?.quotaInfo?.remainingFraction !== undefined) {
                    const { remainingFraction } = modelQuota.quotaInfo;
                    if (remainingFraction < 0.1) {
                        this.logWarn(
                            `Quota low for ${defaultConfig.model} (${(
                                remainingFraction * 100
                            ).toFixed(1)}%). Attempting fallback.`
                        );
                    }
                }
            } else if (provider.includes('claude')) {
                const claudeQuotas = await this.deps.proxy.getClaudeQuota();
                const bestAccount = [...claudeQuotas.accounts].sort(
                    (left, right) =>
                        (right.fiveHour?.utilization ?? 0) -
                        (left.fiveHour?.utilization ?? 0)
                )[0];

                if (
                    bestAccount?.fiveHour &&
                    bestAccount.fiveHour.utilization > 0.9
                ) {
                    this.logWarn(
                        `Claude utilization high: ${bestAccount.fiveHour.utilization}`
                    );
                }
            }
        } catch (error) {
            this.logError('Failed to fetch quota for routing', error as Error);
        }

        return {
            ...defaultConfig,
            reason: defaultConfig.reason ?? 'Quota-aware selection',
        };
    }

    private routeByTaskType(taskType: TaskType, availableProviders: string[]): StepModelConfig {
        const matchingRules = this.rules
            .filter(rule => rule.taskType === taskType && availableProviders.includes(rule.provider))
            .sort((left, right) => right.priority - left.priority);

        if (matchingRules.length > 0) {
            return {
                provider: matchingRules[0].provider,
                model: matchingRules[0].model,
                reason: `Routed by task type: ${taskType} (priority ${matchingRules[0].priority})`
            };
        }

        const generalRules = this.rules
            .filter(rule => rule.taskType === 'general' && availableProviders.includes(rule.provider))
            .sort((left, right) => right.priority - left.priority);

        if (generalRules.length > 0) {
            return {
                provider: generalRules[0].provider,
                model: generalRules[0].model,
                reason: `Fallback to general routing for task type: ${taskType}`
            };
        }

        return {
            provider: availableProviders[0] || 'openai',
            model: 'gpt-4o',
            reason: 'Default fallback: No matching routing rules found'
        };
    }

    private detectTaskType(text: string): TaskType {
        const input = text.toLowerCase();
        if (input.includes('fix') || input.includes('bug') || input.includes('error')) { return 'debugging'; }
        if (input.includes('test') || input.includes('spec') || input.includes('jest')) { return 'testing'; }
        if (input.includes('refactor') || input.includes('clean') || input.includes('reorganize')) { return 'refactoring'; }
        if (input.includes('doc') || input.includes('readme') || input.includes('comment')) { return 'documentation'; }
        if (input.includes('research') || input.includes('find') || input.includes('analyze')) { return 'research'; }
        if (input.includes('plan') || input.includes('roadmap') || input.includes('structure')) { return 'planning'; }
        if (input.includes('create') || input.includes('implement') || input.includes('add')) { return 'code_generation'; }
        return 'general';
    }

    private async ensureCouncilTask(
        taskId: string,
        task: string
    ): Promise<void> {
        const existingTask = await this.deps.databaseService.uac.getTask(taskId);
        if (!existingTask) {
            await this.deps.databaseService.uac.createTask({
                workspaceId: taskId,
                description: task,
                status: 'planning',
                metadata: { taskId, source: 'workspace-agent-council' },
            });
        }

        const existingSteps = await this.deps.databaseService.uac.getSteps(taskId);
        if (existingSteps.length === 0) {
            await this.deps.databaseService.uac.createSteps(taskId, buildFallbackPlan(task));
        }

        await this.deps.databaseService.uac.addLog(taskId, 'system', `Plan requested: ${task}`);
    }

    // --- IPC Decorated Methods ---

    @ipc(SESSION_COUNCIL_CHANNELS.GENERATE_PLAN)
    async generatePlanIpc(payload: { taskId: string; task: string }): Promise<RuntimeValue> {
        await this.ensureCouncilTask(payload.taskId, payload.task);
        return serializeToIpc({ success: true });
    }

    @ipc(SESSION_COUNCIL_CHANNELS.GET_PROPOSAL)
    async getProposalIpc(payload: { taskId: string }): Promise<RuntimeValue> {
        const chat = await this.deps.databaseService.getChat(payload.taskId);
        const storedPlan = chat ? readStoredPlan(chat as StoredChat) : [];

        if (storedPlan.length > 0) {
            return serializeToIpc({ success: true, plan: storedPlan });
        }

        const steps = await this.deps.databaseService.uac.getSteps(payload.taskId);
        const plan = steps.map(step => ({
            id: step.id,
            text: step.text,
            status:
                step.status === 'running' ||
                step.status === 'completed' ||
                step.status === 'failed' ||
                step.status === 'skipped' ||
                step.status === 'awaiting_step_approval'
                    ? step.status
                    : 'pending',
        } satisfies WorkspaceStep));

        return serializeToIpc({ success: true, plan });
    }

    @ipc(SESSION_COUNCIL_CHANNELS.GET_TIMELINE)
    async getTimelineIpc(payload: { taskId: string }): Promise<RuntimeValue> {
        const logs = await this.deps.databaseService.uac.getLogs(payload.taskId);
        return serializeToIpc({
            success: true,
            events: logs.map(toTimelineEvent),
        });
    }

    @ipc(SESSION_COUNCIL_CHANNELS.APPROVE_PROPOSAL)
    async approveProposalIpc(payload: { taskId: string; reason?: string }): Promise<RuntimeValue> {
        await this.deps.databaseService.uac.updateTaskStatus(payload.taskId, 'waiting_for_approval');
        await this.deps.databaseService.uac.addLog(payload.taskId, 'system', 'Proposal approved');
        return serializeToIpc({ success: true });
    }

    @ipc(SESSION_COUNCIL_CHANNELS.REJECT_PROPOSAL)
    async rejectProposalIpc(payload: { taskId: string; reason?: string }): Promise<RuntimeValue> {
        await this.deps.databaseService.uac.updateTaskStatus(payload.taskId, 'failed');
        await this.deps.databaseService.uac.addLog(payload.taskId, 'system', `Proposal rejected${payload.reason ? `: ${payload.reason}` : ''}`);
        return serializeToIpc({ success: true });
    }

    @ipc(SESSION_COUNCIL_CHANNELS.START_EXECUTION)
    async startExecutionIpc(payload: { taskId: string; reason?: string }): Promise<RuntimeValue> {
        await this.deps.databaseService.uac.updateTaskStatus(payload.taskId, 'running');
        await this.deps.databaseService.uac.addLog(payload.taskId, 'system', 'Execution started');
        return serializeToIpc({ success: true });
    }

    @ipc(SESSION_COUNCIL_CHANNELS.PAUSE_EXECUTION)
    async pauseExecutionIpc(payload: { taskId: string; reason?: string }): Promise<RuntimeValue> {
        await this.deps.databaseService.uac.updateTaskStatus(payload.taskId, 'paused');
        await this.deps.databaseService.uac.addLog(payload.taskId, 'system', 'Execution paused');
        return serializeToIpc({ success: true });
    }

    @ipc(SESSION_COUNCIL_CHANNELS.RESUME_EXECUTION)
    async resumeExecutionIpc(payload: { taskId: string; reason?: string }): Promise<RuntimeValue> {
        await this.deps.databaseService.uac.updateTaskStatus(payload.taskId, 'running');
        await this.deps.databaseService.uac.addLog(payload.taskId, 'system', 'Execution resumed');
        return serializeToIpc({ success: true });
    }
}

