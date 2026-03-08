import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { BaseService } from '@main/services/base.service';
import {
    AGENT_COLLABORATION_PERFORMANCE_BUDGETS,
    AgentCollaborationTelemetryEvent,
    ModelRoutingRule,
    StepModelConfig,
    TaskType,
    WorkspaceStep,
} from '@shared/types/workspace-agent';

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

export interface RoutingDependencies {
    telemetry?: TelemetryService;
}

/**
 * AgentRoutingService
 * Extracted from AgentCollaborationService to handle model routing and task type detection.
 * AI-SYS-14 refactor.
 */
export class AgentRoutingService extends BaseService {
    private rules: ModelRoutingRule[] = [...DEFAULT_ROUTING_RULES];

    constructor(private deps: RoutingDependencies) {
        super('AgentRoutingService');
    }

    /**
     * Set the telemetry service dependency
     */
    setTelemetryService(telemetry: TelemetryService): void {
        this.deps.telemetry = telemetry;
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing Agent Routing Service...');
    }

    analyzeSteps(steps: WorkspaceStep[]): WorkspaceStep[] {
        return steps.map(step => ({
            ...step,
            taskType: this.detectTaskType(step.text)
        }));
    }

    getModelForStep(step: WorkspaceStep, availableProviders: string[]): StepModelConfig {
        const startMs = Date.now();
        const taskType = step.taskType || this.detectTaskType(step.text);

        const config = this.routeByTaskType(taskType, availableProviders);

        this.track(AgentCollaborationTelemetryEvent.MODEL_ROUTED, {
            stepId: step.id,
            taskType,
            provider: config.provider,
            model: config.model
        });

        this.warnIfOverBudget('getModelForStep', startMs, AGENT_COLLABORATION_PERFORMANCE_BUDGETS.ROUTE_MODEL_MS);
        return config;
    }

    routeByTaskType(taskType: TaskType, availableProviders: string[]): StepModelConfig {
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

    detectTaskType(text: string): TaskType {
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

    getRules(): ModelRoutingRule[] {
        return [...this.rules];
    }

    addRule(rule: ModelRoutingRule): void {
        this.rules.push(rule);
    }

    private track(event: AgentCollaborationTelemetryEvent, payload: Record<string, unknown>): void {
        if (this.deps.telemetry) {
            this.deps.telemetry.track(event, payload);
        }
    }

    private warnIfOverBudget(operation: string, startMs: number, budgetMs: number): void {
        const duration = Date.now() - startMs;
        if (duration > budgetMs) {
            this.logWarn(`Performance budget exceeded for ${operation}: ${duration}ms (budget: ${budgetMs}ms)`);
        }
    }

    override async cleanup(): Promise<void> {
        // No persistent state
    }
}
