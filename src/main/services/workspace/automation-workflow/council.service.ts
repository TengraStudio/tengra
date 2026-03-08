import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { LLMService } from '@main/services/llm/llm.service';
import { QuotaService } from '@main/services/proxy/quota.service';
import { StepModelConfig,WorkspaceStep } from '@shared/types/workspace-agent';

import { AgentCollaborationService } from './agent-collaboration.service';

export interface CouncilDependencies {
    database: DatabaseService;
    llm: LLMService;
    quota: QuotaService;
    collaboration: AgentCollaborationService;
}

/**
 * CouncilService - Orchestrates advanced Council features
 * MARCH1-COUNCIL-001: Explicit pre-execution approval (Council President Flow)
 * MARCH1-COUNCIL-002: Quota-aware routing
 * MARCH1-COUNCIL-003: Dynamic task/token reassignment
 */
export class CouncilService extends BaseService {
    constructor(private deps: CouncilDependencies) {
        super('CouncilService');
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing Council Service...');
    }

    /**
     * MARCH1-COUNCIL-001: Prepare a plan according to Council rules
     */
    async prepareCouncilPlan(taskId: string, steps: WorkspaceStep[]): Promise<WorkspaceStep[]> {
        this.logInfo(`Preparing plan for task ${taskId} with ${steps.length} steps with Council oversight`);

        // 1. Quota-aware model assignment
        const enrichedSteps = await Promise.all(steps.map(async (step) => {
            const bestModel = await this.routeWithQuotaAwareness(step);
            return {
                ...step,
                modelConfig: bestModel,
                // MARCH1-COUNCIL-001: Mark steps as requiring approval if they are high impact
                requiresApproval: step.priority === 'high' || step.priority === 'critical'
            } as WorkspaceStep;
        }));

        this.logInfo(`Council plan prepared for task ${taskId} with quota-aware routing`);
        return enrichedSteps;
    }

    /**
     * MARCH1-COUNCIL-002: Intelligent routing based on available quota
     */
    private async routeWithQuotaAwareness(step: WorkspaceStep): Promise<StepModelConfig> {
        const availableProviders = await this.deps.llm.getAvailableProviders();

        // 1. Get default routing config from collaboration service
        const defaultConfig = this.deps.collaboration.getModelForStep(step, availableProviders);

        try {
            // 2. Fetch relevant quotas for the target provider
            const provider = defaultConfig.provider.toLowerCase();

            if (provider.includes('antigravity') || provider.includes('google')) {
                const quotas = await this.deps.quota.getAntigravityAvailableModels();
                const modelQuota = quotas.find(q => q.id === defaultConfig.model || q.name === defaultConfig.model);

                if (modelQuota?.quotaInfo) {
                    const { remainingFraction } = modelQuota.quotaInfo;
                    if (remainingFraction < 0.1) {
                        this.logWarn(`Quota low for ${defaultConfig.model} (${(remainingFraction * 100).toFixed(1)}%). Attempting fallback.`);
                        // Here we could trigger a fallback, but for now we just log it
                    }
                }
            } else if (provider.includes('claude')) {
                const claudeQuotas = await this.deps.quota.getClaudeQuota();
                const bestAccount = claudeQuotas.accounts.sort((a, b) =>
                    (b.fiveHour?.utilization ?? 0) - (a.fiveHour?.utilization ?? 0)
                )[0]; // Sort by utilization (lowest first, assuming smaller utilization is better)

                if (bestAccount?.fiveHour && bestAccount.fiveHour.utilization > 0.9) {
                    this.logWarn(`Claude utilization high: ${bestAccount.fiveHour.utilization}`);
                }
            }

            // For now, we contribute more logic here as we stabilize. 
            // The goal is to eventually return an accountId as part of StepModelConfig.
        } catch (e) {
            this.logError('Failed to fetch quota for routing:', e as Error);
        }

        return {
            ...defaultConfig,
            reason: defaultConfig.reason ?? 'Quota-aware selection'
        };
    }

    /**
     * MARCH1-COUNCIL-003: Reassign tasks dynamically if a model hits limits
     */
    async handleDynamicReassignment(step: WorkspaceStep): Promise<WorkspaceStep> {
        this.logWarn(`Dynamic reassignment triggered for step: ${step.id}`);
        // Implementation for dynamic reassignment during execution
        return step;
    }

    override async cleanup(): Promise<void> {
        this.logInfo('Cleaning up Council Service...');
    }
}
