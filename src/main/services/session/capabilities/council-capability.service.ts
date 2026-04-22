/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { BaseService } from '@main/services/base.service';
import { LLMService } from '@main/services/llm/llm.service';
import { ModelSelectionService } from '@main/services/llm/model-selection.service';
import { ProxyService } from '@main/services/proxy/proxy.service';
import {
    ModelRoutingRule,
    StepModelConfig,
    TaskType,
    WorkspaceStep,
} from '@shared/types/council';

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
}
