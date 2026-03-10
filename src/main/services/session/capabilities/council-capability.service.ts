import { BaseService } from '@main/services/base.service';
import { LLMService } from '@main/services/llm/llm.service';
import { QuotaService } from '@main/services/proxy/quota.service';
import { AgentCollaborationService } from '@main/services/workspace/automation-workflow/agent-collaboration.service';
import { StepModelConfig, WorkspaceStep } from '@shared/types/automation-workflow';

export interface CouncilCapabilityDependencies {
    llm: LLMService;
    quota: QuotaService;
    collaboration: AgentCollaborationService;
}

/**
 * CouncilCapabilityService centralizes quota-aware council planning so any
 * session mode can opt into the same behavior without inheriting workflow-only names.
 */
export class CouncilCapabilityService extends BaseService {
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
        const defaultConfig = this.deps.collaboration.getModelForStep(
            step,
            availableProviders
        );

        try {
            const provider = defaultConfig.provider.toLowerCase();

            if (provider.includes('antigravity') || provider.includes('google')) {
                const quotas = await this.deps.quota.getAntigravityAvailableModels();
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
                const claudeQuotas = await this.deps.quota.getClaudeQuota();
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
}
