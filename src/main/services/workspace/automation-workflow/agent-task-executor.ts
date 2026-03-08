import { randomUUID } from 'crypto';

import { appLogger } from '@main/logging/logger';
import { DatabaseService } from '@main/services/data/database.service';
import type {
    UacLogRecord,
    UacStepRecord,
    UacTaskRecord,
} from '@main/services/data/repositories/uac.repository';
import { getContextWindowService } from '@main/services/llm/context-window.service';
import { getCostEstimationService } from '@main/services/llm/cost-estimation.service';
import { LLMService } from '@main/services/llm/llm.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { AgentCheckpointService } from '@main/services/workspace/agent/agent-checkpoint.service';
import { AgentCollaborationService } from '@main/services/workspace/agent/agent-collaboration.service';
import { AgentRegistryService } from '@main/services/workspace/agent/agent-registry.service';
import { createInitialAgentState } from '@main/services/workspace/automation-workflow/agent-state-machine';
import { AgentTaskPlanCompiler } from '@main/services/workspace/automation-workflow/agent-task-plan-compiler';
import { AgentTestRunnerService, getAgentTestRunnerService } from '@main/services/workspace/automation-workflow/agent-test-runner.service';
import { TaskStateMachine } from '@main/services/workspace/automation-workflow/task-state-machine';
import { ToolInvocationManager } from '@main/services/workspace/automation-workflow/tool-invocation-manager';
import { GitService } from '@main/services/workspace/git.service';
import { ToolExecutor } from '@main/tools/tool-executor';
import { StateMachine } from '@main/utils/state-machine.util';
import { WORKSPACE_COMPAT_SCHEMA_VALUES } from '@shared/constants';
import { AgentTaskState } from '@shared/types/agent-state';
import { Message, ToolCall, ToolDefinition } from '@shared/types/chat';
import {
    AgentStartOptions,
    PlanVersionItem,
    RollbackCheckpointResult,
    StepComment,
    TestRunConfig,
    TestRunResult,
    WorkspaceState,
    WorkspaceStep,
    WorkspaceStepStatus,
} from '@shared/types/workspace-agent';
import { safeJsonParse } from '@shared/utils/sanitize.util';

const WORKSPACE_COMPAT_PATH_COLUMN = WORKSPACE_COMPAT_SCHEMA_VALUES.PATH_COLUMN;

export interface AgentServices {
    database: DatabaseService;
    llm: LLMService;
    eventBus: EventBusService;
    registry: AgentRegistryService;
    checkpoint: AgentCheckpointService;
    git: GitService;
    collaboration: AgentCollaborationService;
    council: import('./council.service').CouncilService;
    testRunner?: AgentTestRunnerService;
}

interface GitExecutionContext {
    repoPath: string;
    baseBranch: string;
    featureBranch: string;
    autoCreated: boolean;
    enabled: boolean;
}

interface ProviderModelConfig {
    providerId: string;
    modelId: string;
}

export class AgentTaskExecutor {
    private static readonly MAX_HISTORY_SIZE = 100;
    /** AGT-PLN-01: Maximum auto-retry attempts per step */
    private static readonly MAX_AUTO_RETRIES = 2;

    public state: WorkspaceState;
    private stateMachine: StateMachine<WorkspaceState['status'], string>;
    private abortController: AbortController | null = null;
    private toolExecutor?: ToolExecutor;
    private currentStepTokens = { prompt: 0, completion: 0 };
    private shouldStop: boolean = false;
    private gitContext: GitExecutionContext | null = null;
    private readonly errorRecoveryTemplates: Record<string, string> = {
        timeout: 'The tool timed out. I will try again with a longer timeout or a smaller scope.',
        permission: "I encountered a permission error. I'll check if there are alternative ways to achieve the goal or ask the user for help.",
        notFound: "The specified path or resource was not found. I'll search for it or check if I made a typo.",
        limit: "I've hit a rate limit. I'll wait for a while before retrying or reduce the frequency of requests.",
        unknown: 'An unexpected error occurred. I will re-examine the situation and try to recover.',
    };

    /** AGT-TST: Test runner service */
    private testRunner: AgentTestRunnerService;
    /** AGT-TST: Plan-level test configuration */
    private testConfig: TestRunConfig | null = null;

    // Status flags
    private startRequestInFlight = false;
    private planRequestInFlight = false;

    /** AGT-PLN-01: Track retry counts per step */
    private stepRetryCount = new Map<string, number>();

    // Event listeners
    private unsubscribeStepUpdate?: () => void;
    private unsubscribePlanProposed?: () => void;
    private unsubscribePlanRevised?: () => void;
    private readonly taskStateMachine = new TaskStateMachine();
    private readonly planCompiler = new AgentTaskPlanCompiler();
    private readonly toolInvocationManager: ToolInvocationManager;

    constructor(
        public readonly taskId: string,
        initialOptions: AgentStartOptions,
        private readonly services: AgentServices
    ) {
        this.state = {
            status: 'idle',
            currentTask: String(initialOptions.task),
            taskId: taskId,
            nodeId: initialOptions.nodeId,
            plan: [],
            history: [],
            totalTokens: { prompt: 0, completion: 0 },
            config: initialOptions,
        };

        this.stateMachine = new StateMachine(`AgentTaskExecutor-${taskId}`, 'idle', [
            { from: ['idle', 'completed', 'failed', 'error'], to: 'running' },
            { from: ['idle', 'completed', 'failed', 'error'], to: 'planning' },
            { from: ['planning'], to: 'waiting_for_approval' },
            { from: ['waiting_for_approval'], to: 'running' },
            { from: ['running', 'planning', 'waiting_for_approval'], to: 'paused' },
            { from: ['paused'], to: 'running' },
            { from: ['running', 'planning'], to: 'completed' },
            { from: ['running', 'planning', 'waiting_for_approval'], to: 'failed' },
            // Allow reset to idle from anywhere
            {
                from: [
                    'planning',
                    'waiting_for_approval',
                    'running',
                    'paused',
                    'failed',
                    'completed',
                    'error',
                ],
                to: 'idle',
            },
        ]);

        // AGT-TST: Initialize test runner
        this.testRunner = services.testRunner ?? getAgentTestRunnerService();
        this.toolInvocationManager = new ToolInvocationManager({
            taskId: this.taskId,
            getToolExecutor: () => this.toolExecutor,
            shouldStop: () => this.shouldStop,
            isBudgetLimited: () => Boolean(this.state.config?.budgetLimitUsd),
            errorRecoveryTemplates: this.errorRecoveryTemplates,
            logInfo: (message: string) => this.logInfo(message),
            logWarn: (message: string) => this.logWarn(message),
            logError: (message: string, error?: Error) => this.logError(message, error),
        });

        this.setupEventListeners();
    }

    setToolExecutor(toolExecutor: ToolExecutor) {
        this.toolExecutor = toolExecutor;
    }

    public getStatus(): WorkspaceState {
        return this.state;
    }

    private logInfo(message: string, data?: Error) {
        appLogger.info('AgentTaskExecutor', `[${this.taskId}] ${message}`, data);
    }

    private logWarn(message: string, data?: Error) {
        appLogger.warn('AgentTaskExecutor', `[${this.taskId}] ${message}`, data);
    }

    private logError(message: string, error?: Error) {
        appLogger.error('AgentTaskExecutor', `[${this.taskId}] ${message}`, error);
    }

    private emitUpdate() {
        this.services.eventBus.emit('workspace:update', {
            ...this.state,
        });
    }

    private setupEventListeners() {
        this.unsubscribeStepUpdate = this.services.eventBus.on('workspace:step-update', payload => {
            if (payload.taskId && payload.taskId !== this.taskId) { return; } // Filtering

            void (async () => {
                try {
                    this.logInfo(`Received workspace:step-update: ${JSON.stringify(payload)}`);
                    const { index, status, message } = payload;
                    if (index >= 0 && index < this.state.plan.length) {
                        this.handleStepStatusUpdate(index, status);

                        await this.services.database.uac.updateStepStatus(
                            this.state.plan[index].id,
                            status
                        );

                        if (message) {
                            this.logInfo(`Step ${index} updated to ${status}: ${message}`);
                        }
                    }
                    await this.saveState();
                    this.emitUpdate();
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    this.logWarn(`Failed to handle step update: ${message}`);
                }
            })();
        });

        this.unsubscribePlanProposed = this.services.eventBus.on('workspace:plan-proposed', payload => {
            if (payload.taskId && payload.taskId !== this.taskId) { return; }

            this.logInfo(`Received workspace:plan-proposed event with ${payload.steps.length} steps`);
            if (this.state.status !== 'planning') {
                this.logWarn(`Ignoring proposed plan while state is ${this.state.status}`);
                return;
            }
            void (async () => {
                try {
                    const { steps } = payload;
                    const normalizedSteps = steps.map(step => {
                        if (typeof step === 'string') {
                            return step;
                        }
                        if (step && typeof step === 'object') {
                            const candidate = step as Partial<WorkspaceStep> & { text?: string };
                            if (typeof candidate.text === 'string') {
                                return {
                                    id: candidate.id ?? randomUUID(),
                                    text: candidate.text,
                                    status: candidate.status ?? 'pending',
                                    type: candidate.type,
                                    dependsOn: candidate.dependsOn,
                                    priority: candidate.priority,
                                    parallelLane: candidate.parallelLane,
                                    branchId: candidate.branchId,
                                } as WorkspaceStep;
                            }
                        }
                        return String(step);
                    });
                    this.state.plan = this.normalizePlan(
                        normalizedSteps as Array<string> | Array<WorkspaceStep>
                    );
                    await this.enrichPlanWithCollaboration();

                    // AGT-TOK-02: Calculate cost estimation before plan approval
                    this.calculatePlanCostEstimate();

                    // AGT-PLN-05: Calculate confidence scores for each step
                    await this.calculateStepConfidenceScores();

                    this.logInfo(`Transitioning to waiting_for_approval with plan: ${JSON.stringify(this.state.plan)}`);
                    await this.stateMachine.transitionTo('waiting_for_approval');
                    this.state.status = 'waiting_for_approval';

                    try {
                        await this.syncTaskSteps(this.taskId, this.state.plan);
                        await this.services.database.uac.updateTaskStatus(
                            this.taskId,
                            'waiting_for_approval'
                        );
                        await this.recordPlanVersion('proposed');
                    } catch (dbError) {
                        const message = dbError instanceof Error ? dbError.message : String(dbError);
                        this.logWarn(`Failed to sync plan to DB: ${message}`);
                    }
                } catch (error) {
                    this.logError('Failed to handle proposed plan', error as Error);
                } finally {
                    this.shouldStop = true;
                    this.emitUpdate();
                }
            })();
        });

        // AGT-PLN-02: Listen for plan revision events
        this.unsubscribePlanRevised = this.services.eventBus.on('workspace:plan-revised', payload => {
            if (payload.taskId && payload.taskId !== this.taskId) { return; }

            this.logInfo(`Received plan revision: ${payload.action} - ${payload.reason}`);
            this.handlePlanRevision(payload);
        });
    }

    /**
     * AGT-PLN-02: Handle dynamic plan revision during execution
     */
    private handlePlanRevision(payload: {
        action: 'add' | 'remove' | 'modify' | 'insert';
        index?: number;
        stepText?: string;
        reason: string;
    }): void {
        const { action, index, stepText, reason } = payload;

        switch (action) {
            case 'add':
                if (stepText) {
                    this.state.plan.push({
                        id: randomUUID(),
                        text: stepText,
                        status: 'pending',
                    });
                    this.logInfo(`Added new step: "${stepText}"`);
                }
                break;

            case 'remove':
                if (index !== undefined && index >= 0 && index < this.state.plan.length) {
                    const removed = this.state.plan.splice(index, 1);
                    this.logInfo(`Removed step ${index}: "${removed[0]?.text}"`);
                }
                break;

            case 'modify':
                if (index !== undefined && index >= 0 && index < this.state.plan.length && stepText) {
                    const oldText = this.state.plan[index].text;
                    this.state.plan[index].text = stepText;
                    this.logInfo(`Modified step ${index}: "${oldText}" -> "${stepText}"`);
                }
                break;

            case 'insert':
                if (index !== undefined && index >= 0 && index <= this.state.plan.length && stepText) {
                    this.state.plan.splice(index, 0, {
                        id: randomUUID(),
                        text: stepText,
                        status: 'pending',
                    });
                    this.logInfo(`Inserted step at ${index}: "${stepText}"`);
                }
                break;
        }

        // Record the revision as a new plan version
        void this.recordPlanVersion('manual').catch(err => {
            this.logWarn(`Failed to record plan version: ${err instanceof Error ? err.message : String(err)}`);
        });

        // Sync to DB and emit update
        void this.syncTaskSteps(this.taskId, this.state.plan).catch(err => {
            this.logWarn(`Failed to sync task steps: ${err instanceof Error ? err.message : String(err)}`);
        });
        this.emitUpdate();

        this.logInfo(`Plan revision applied: ${reason}`);
    }

    /**
     * AGT-TOK-02: Calculate cost estimation for the current plan
     * Called when a plan is proposed to estimate execution cost before approval
     */
    private calculatePlanCostEstimate(): void {
        try {
            const { modelId, providerId } = this.getModelConfig();
            const costService = getCostEstimationService();

            const costBreakdown = costService.estimatePlanCost(
                this.state.plan,
                this.state.history,
                modelId,
                providerId
            );

            this.state.estimatedPlanCost = costBreakdown;

            this.logInfo(
                `Cost estimate: ${costService.formatCost(costBreakdown.totalEstimatedCost)} ` +
                `(${costBreakdown.stepBreakdown.length} steps, model: ${modelId})`
            );

            // Emit cost estimation event for UI updates
            this.services.eventBus.emit('workspace:cost-estimated', {
                taskId: this.taskId,
                estimate: costBreakdown,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logWarn(`Failed to calculate cost estimate: ${message}`);
        }
    }

    /**
     * AGT-PLN-05: Calculate confidence scores for each step in the plan
     */
    private async calculateStepConfidenceScores(): Promise<void> {
        try {
            // Get available tools for tool availability scoring
            const availableTools = this.toolExecutor
                ? (await this.toolExecutor.getToolDefinitions()).map(t => t.function.name.toLowerCase())
                : [];

            // Get historical patterns for success rate scoring
            const taskDescription = this.state.config?.task ?? '';
            const patterns = await this.services.database.uac.findSimilarPatterns(taskDescription, 10);

            for (const step of this.state.plan) {
                const confidence = this.calculateStepConfidence(step.text, availableTools, patterns);
                step.confidence = confidence;
            }

            const avgScore = this.state.plan.reduce((sum, s) => sum + (s.confidence?.score ?? 0), 0) / this.state.plan.length;
            this.logInfo(`Confidence scores calculated. Average: ${avgScore.toFixed(1)}%`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logWarn(`Failed to calculate confidence scores: ${message}`);
        }
    }

    /**
     * AGT-PLN-05: Calculate confidence score for a single step
     */
    private calculateStepConfidence(
        stepText: string,
        availableTools: string[],
        patterns: Array<{ step_pattern: string; success_count: number; failure_count: number }>
    ): { score: number; factors: { complexity: number; specificity: number; toolAvailability: number; historicalSuccess: number }; explanation?: string } {
        const text = stepText.toLowerCase();

        // Factor 1: Complexity (based on word count and action verbs)
        const wordCount = text.split(/\s+/).length;
        const complexityScore = Math.max(0, 100 - (wordCount - 5) * 5); // Optimal is 5-10 words

        // Factor 2: Specificity (does it mention specific files, functions, or actions?)
        const specificPatterns = [
            /\b(file|function|class|method|component|module|test|api)\b/i,
            /\b(create|update|modify|delete|add|remove|implement|fix)\b/i,
            /\b[a-z]+\.(ts|js|tsx|jsx|py|go|rs|java|cpp|css|html|json)\b/i,
        ];
        const specificityMatches = specificPatterns.filter(p => p.test(text)).length;
        const specificityScore = Math.min(100, specificityMatches * 35);

        // Factor 3: Tool availability (are there tools for this step?)
        const toolKeywords = ['read', 'write', 'file', 'directory', 'command', 'search', 'web', 'git', 'docker'];
        const toolMatches = toolKeywords.filter(kw => text.includes(kw)).length;
        const hasRelevantTool = availableTools.some(tool =>
            toolKeywords.some(kw => tool.includes(kw) && text.includes(kw))
        );
        const toolAvailabilityScore = hasRelevantTool ? 100 : Math.min(100, toolMatches * 25);

        // Factor 4: Historical success (based on similar patterns)
        let historicalSuccessScore = 50; // Default neutral score
        if (patterns.length > 0) {
            const matchingPatterns = patterns.filter(p =>
                p.step_pattern.toLowerCase().includes(text.substring(0, 20).toLowerCase())
            );
            if (matchingPatterns.length > 0) {
                const totalSuccess = matchingPatterns.reduce((sum, p) => sum + p.success_count, 0);
                const totalFailure = matchingPatterns.reduce((sum, p) => sum + p.failure_count, 0);
                const total = totalSuccess + totalFailure;
                if (total > 0) {
                    historicalSuccessScore = Math.round((totalSuccess / total) * 100);
                }
            }
        }

        // Calculate overall score (weighted average)
        const overallScore = Math.round(
            complexityScore * 0.2 +
            specificityScore * 0.3 +
            toolAvailabilityScore * 0.25 +
            historicalSuccessScore * 0.25
        );

        // Generate explanation for low confidence steps
        let explanation: string | undefined;
        if (overallScore < 50) {
            const issues: string[] = [];
            if (complexityScore < 50) { issues.push('too complex'); }
            if (specificityScore < 50) { issues.push('too vague'); }
            if (toolAvailabilityScore < 50) { issues.push('no clear tools available'); }
            if (historicalSuccessScore < 50) { issues.push('similar steps failed before'); }
            explanation = `Low confidence: ${issues.join(', ')}`;
        }

        return {
            score: overallScore,
            factors: {
                complexity: complexityScore,
                specificity: specificityScore,
                toolAvailability: toolAvailabilityScore,
                historicalSuccess: historicalSuccessScore,
            },
            explanation,
        };
    }

    async cleanup(): Promise<void> {
        this.unsubscribeStepUpdate?.();
        this.unsubscribePlanProposed?.();
        this.unsubscribePlanRevised?.();
        this.unsubscribeStepUpdate = undefined;
        this.unsubscribePlanProposed = undefined;
        this.unsubscribePlanRevised = undefined;
        this.abortController?.abort();
        this.abortController = null;
    }

    // --- State Management ---

    async restoreStateFromDB(): Promise<void> {
        try {
            const task = await this.services.database.uac.getTask(this.taskId);
            if (!task) {
                this.logWarn('Task not found in DB for restoration');
                return;
            }

            const steps = await this.services.database.uac.getSteps(this.taskId);
            const logs = await this.services.database.uac.getLogs(this.taskId);

            this.state = this.buildWorkspaceStateFromRecords(task, steps, logs);
            this.stateMachine.setState(this.state.status);

            this.logInfo(`Restored state with status: ${this.state.status}`);

            if (this.state.status === 'running') {
                this.logInfo('Auto-resuming execution from restored state');
                this.shouldStop = false;
                this.abortController = new AbortController();
                void this.executionLoop();
            } else if (this.state.status === 'planning') {
                if (this.state.plan.length > 0) {
                    this.logWarn('Recovered planning task with existing steps; transitioning to waiting_for_approval');
                    this.state.status = 'waiting_for_approval';
                    this.stateMachine.setState('waiting_for_approval');
                    await this.services.database.uac.updateTaskStatus(this.taskId, 'waiting_for_approval');
                } else {
                    this.logWarn('Recovered planning task without plan steps; marking task as failed');
                    this.state.status = 'failed';
                    this.stateMachine.setState('failed');
                    await this.services.database.uac.updateTaskStatus(this.taskId, 'failed');
                }
            }

            this.emitUpdate();
        } catch (error) {
            this.logError('Failed to restore state', error as Error);
        }
    }

    async rollback(checkpointId: string): Promise<RollbackCheckpointResult> {
        const checkpoint = await this.services.checkpoint.loadCheckpoint(checkpointId);
        if (!checkpoint) { throw new Error('Checkpoint not found'); }

        // Save current state as pre-rollback
        const preRollbackId = await this.services.checkpoint.saveCheckpoint(
            this.taskId,
            this.state.plan.findIndex(s => s.status === 'running'),
            this.mapToAgentTaskState(),
            'pre_rollback'
        );

        // Resume from checkpoint (update DB state to match checkpoint)
        const snapshotState = checkpoint.state;
        if (!snapshotState) { throw new Error('Checkpoint has no state'); }

        // Restore plan steps
        if (snapshotState.plan && snapshotState.plan.steps.length > 0) {
            const restoredSteps: WorkspaceStep[] = snapshotState.plan.steps.map(s => ({
                id: randomUUID(),
                text: s.description,
                status: s.status === 'in_progress' ? 'running' :
                    s.status === 'pending' ? 'pending' :
                        s.status === 'completed' ? 'completed' : 'failed',
            }));

            await this.syncTaskSteps(this.taskId, restoredSteps);
        }

        // Restore Task Status
        let taskStatus = 'idle';
        if (snapshotState.state === 'executing') { taskStatus = 'running'; }
        else if (snapshotState.state === 'planning') { taskStatus = 'planning'; }
        else { taskStatus = snapshotState.state; }

        await this.services.database.uac.updateTaskStatus(this.taskId, taskStatus);

        // Reload in-memory
        await this.restoreStateFromDB();

        return {
            success: true,
            taskId: this.taskId,
            resumedCheckpointId: checkpointId,
            preRollbackCheckpointId: preRollbackId
        };
    }

    // --- Core Actions ---

    async start(): Promise<void> {
        if (this.startRequestInFlight) { return; }

        if (!this.stateMachine.can('running')) {
            this.logWarn(`Cannot start execution from state: ${this.state.status}`);
            return;
        }

        this.startRequestInFlight = true;
        try {
            const config = this.state.config;
            if (!config) { throw new Error('Agent config not initialized'); }
            const { task, workspaceId, attachments, agentProfileId, locale } = config;
            const profile = this.services.registry.getProfile(agentProfileId ?? 'default');
            let systemPrompt = profile.systemPrompt;
            if (locale && locale !== 'en') {
                systemPrompt = systemPrompt.replace('**Language**: ALWAYS English.', `**Language**: Response in ${locale}.`);
                systemPrompt = systemPrompt.replace('Even if the user speaks another language, reply in English unless explicitly asked to translate.', '');
                systemPrompt += `\n\nIMPORTANT: You must output your responses in the user's preferred language (` + locale + `).`;
            }
            await this.ensureFeatureBranchReady();

            await this.stateMachine.transitionTo('running');
            this.shouldStop = false;
            this.abortController = new AbortController();

            await this.services.database.uac.updateTaskStatus(this.taskId, 'running');

            // Initialize history if empty
            if (this.state.history.length === 0) {
                this.state.history = [
                    {
                        id: randomUUID(),
                        role: 'system',
                        content: systemPrompt,
                        timestamp: new Date(),
                    } as Message,
                    {
                        id: randomUUID(),
                        role: 'user',
                        content: `Task: ${String(task)} \n\nWorkspace Context: ${workspaceId ?? 'None'} \nAttachments: ${attachments?.map(a => a.name).join(', ') ?? 'None'} `,
                        timestamp: new Date(),
                    } as Message,
                ];
            }

            this.state.status = 'running';
            this.emitUpdate();

            void this.executionLoop();
        } finally {
            this.startRequestInFlight = false;
        }
    }

    async generatePlan(): Promise<void> {
        if (this.planRequestInFlight) { return; }

        if (!this.stateMachine.can('planning')) {
            this.logWarn(`Cannot generate plan from state: ${this.state.status}`);
            return;
        }

        this.planRequestInFlight = true;
        try {
            const config = this.state.config;
            if (!config) { throw new Error('Agent config not initialized'); }
            const { task, workspaceId, agentProfileId, locale } = config;
            const profile = this.services.registry.getProfile(agentProfileId ?? 'default');
            let systemPrompt = profile.systemPrompt;
            if (locale && locale !== 'en') {
                systemPrompt = systemPrompt.replace('**Language**: ALWAYS English.', `**Language**: Response in ${locale}.`);
                systemPrompt = systemPrompt.replace('Even if the user speaks another language, reply in English unless explicitly asked to translate.', '');
                systemPrompt += `\n\nIMPORTANT: You must output your responses in the user's preferred language (` + locale + `).`;
            }

            await this.stateMachine.transitionTo('planning');
            this.shouldStop = false;
            this.abortController = new AbortController();

            await this.services.database.uac.updateTaskStatus(this.taskId, 'planning');

            this.state.history = [
                {
                    id: randomUUID(),
                    role: 'system',
                    content: systemPrompt,
                    timestamp: new Date(),
                } as Message,
                {
                    id: randomUUID(),
                    role: 'user',
                    content: `Task: ${String(task)}\n\nWorkspace Context: ${workspaceId ?? 'None'}\n\nINSTRUCTIONS:\n1. Analyze this task briefly\n2. Call the \`propose_plan\` tool with your implementation steps\n\nFALLBACK (if tool calling is not available):\nReturn a JSON object: { "steps": ["step 1", "step 2", ...] }`,
                    timestamp: new Date(),
                } as Message,
            ];

            this.state.status = 'planning';
            this.emitUpdate();

            void this.planningLoop();
        } finally {
            this.planRequestInFlight = false;
        }
    }

    async pause(): Promise<void> {
        this.shouldStop = true;
        this.abortController?.abort();
        this.abortController = null;

        if (this.stateMachine.can('paused')) {
            await this.stateMachine.transitionTo('paused');
        }

        this.state.status = 'paused';
        await this.services.database.uac.updateTaskStatus(this.taskId, 'paused');
        this.emitUpdate();
    }

    async stop(): Promise<void> {
        this.shouldStop = true;
        this.abortController?.abort();
        this.abortController = null;

        await this.stateMachine.transitionTo('idle');
        this.state.status = 'idle';
        await this.services.database.uac.updateTaskStatus(this.taskId, 'idle');
        this.emitUpdate();
    }

    // --- Plan Management ---

    async approvePlan(plan: WorkspaceStep[] | string[]): Promise<void> {
        if (!this.stateMachine.can('running')) {
            this.logWarn(`Cannot approve plan in state: ${this.state.status}`);
            return;
        }

        this.state.plan = this.normalizePlan(plan);
        await this.enrichPlanWithCollaboration();
        await this.ensureFeatureBranchReady();

        await this.stateMachine.transitionTo('running');
        this.state.status = 'running';
        this.shouldStop = false;

        const planText = this.state.plan.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
        const approvalMsg = {
            id: randomUUID(),
            role: 'user',
            content: `Plan approved:\n${planText}\n\nPlease proceed with execution following this plan.`,
            timestamp: new Date(),
        } as Message;
        this.pushToHistory(approvalMsg);

        const executionNodeId = await this.createExecutionNode();
        this.state.nodeId = executionNodeId;

        await this.syncTaskSteps(this.taskId, this.state.plan);
        await this.services.database.uac.updateTaskStatus(this.taskId, 'running');
        await this.services.database.uac.addLog(this.taskId, approvalMsg.role, String(approvalMsg.content));
        await this.recordPlanVersion('approved');

        this.emitUpdate();
        void this.executionLoop();
    }

    async retryStep(index: number): Promise<void> {
        if (!this.state.plan[index]) {
            throw new Error(`Invalid step index: ${index}`);
        }

        const step = this.state.plan[index];
        step.status = 'pending';
        this.logInfo(`Retrying step ${index}: ${step.text}`);

        this.pushToHistory({
            id: randomUUID(),
            role: 'user',
            content: `Please retry step ${index}: "${step.text}". Previous attempt failed or was incomplete.`,
            timestamp: new Date(),
        } as Message);

        if (this.stateMachine.can('running')) {
            await this.stateMachine.transitionTo('running');
            this.state.status = 'running';
            this.shouldStop = false;
            void this.executionLoop();
        }

        await this.saveState();
        this.emitUpdate();
    }

    // --- AGT-HIL: Human-in-the-Loop Step Methods ---

    /**
     * AGT-HIL-01: Approve a step that is awaiting user approval.
     * Resets the step to 'pending' and resumes execution.
     */
    async approveStep(stepId: string): Promise<void> {
        const step = this.state.plan.find(s => s.id === stepId);
        if (!step) {
            this.logWarn(`approveStep: step not found: ${stepId}`);
            return;
        }
        if (step.status !== 'awaiting_step_approval') {
            this.logWarn(`approveStep: step ${stepId} is not awaiting approval (status: ${step.status})`);
            return;
        }

        step.status = 'pending';
        step.requiresApproval = false;
        step.isInterventionPoint = false;
        this.logInfo(`Step approved by user: "${step.text}"`);

        await this.saveState();
        this.emitUpdate();

        if (this.stateMachine.can('running')) {
            await this.stateMachine.transitionTo('running');
            this.state.status = 'running';
            this.shouldStop = false;
            void this.executionLoop();
        }
    }

    /**
     * AGT-HIL-03: Skip a step. Marks it as 'skipped' and continues.
     */
    async skipStep(stepId: string): Promise<void> {
        const step = this.state.plan.find(s => s.id === stepId);
        if (!step) {
            this.logWarn(`skipStep: step not found: ${stepId}`);
            return;
        }
        if (step.status !== 'pending' && step.status !== 'awaiting_step_approval') {
            this.logWarn(`skipStep: step ${stepId} cannot be skipped (status: ${step.status})`);
            return;
        }

        step.status = 'skipped';
        this.logInfo(`Step skipped by user: "${step.text}"`);

        await this.saveState();
        this.emitUpdate();

        // Resume execution if paused at this step
        if (this.stateMachine.can('running')) {
            await this.stateMachine.transitionTo('running');
            this.state.status = 'running';
            this.shouldStop = false;
            void this.executionLoop();
        }
    }

    /**
     * AGT-HIL-02: Edit a pending step's text.
     */
    async editStep(stepId: string, newText: string): Promise<void> {
        const step = this.state.plan.find(s => s.id === stepId);
        if (!step) {
            this.logWarn(`editStep: step not found: ${stepId}`);
            return;
        }
        if (step.status !== 'pending' && step.status !== 'awaiting_step_approval') {
            this.logWarn(`editStep: step ${stepId} cannot be edited (status: ${step.status})`);
            return;
        }

        const oldText = step.text;
        step.text = newText;
        this.logInfo(`Step edited by user: "${oldText}" -> "${newText}"`);

        void this.recordPlanVersion('manual').catch(err => {
            this.logWarn(`Failed to record plan version: ${err instanceof Error ? err.message : String(err)}`);
        });
        void this.syncTaskSteps(this.taskId, this.state.plan).catch(err => {
            this.logWarn(`Failed to sync task steps: ${err instanceof Error ? err.message : String(err)}`);
        });
        await this.saveState();
        this.emitUpdate();
    }

    /**
     * AGT-HIL-05: Add a user comment to a step.
     */
    async addStepComment(stepId: string, commentText: string): Promise<void> {
        const step = this.state.plan.find(s => s.id === stepId);
        if (!step) {
            this.logWarn(`addStepComment: step not found: ${stepId}`);
            return;
        }

        const comment: StepComment = {
            id: randomUUID(),
            text: commentText,
            createdAt: Date.now(),
        };

        if (!step.comments) {
            step.comments = [];
        }
        step.comments.push(comment);
        this.logInfo(`Comment added to step "${step.text}": ${commentText}`);

        await this.saveState();
        this.emitUpdate();
    }

    /**
     * AGT-HIL-04: Insert a manual intervention point after a given step.
     */
    async insertInterventionPoint(afterStepId: string): Promise<void> {
        const afterIndex = this.state.plan.findIndex(s => s.id === afterStepId);
        if (afterIndex === -1) {
            this.logWarn(`insertInterventionPoint: step not found: ${afterStepId}`);
            return;
        }

        const interventionStep: WorkspaceStep = {
            id: randomUUID(),
            text: '[Manual Intervention Point]',
            status: 'pending',
            type: 'task',
            isInterventionPoint: true,
            requiresApproval: true,
        };

        this.state.plan.splice(afterIndex + 1, 0, interventionStep);
        this.logInfo(`Intervention point inserted after step "${this.state.plan[afterIndex].text}"`);

        void this.recordPlanVersion('manual').catch(err => {
            this.logWarn(`Failed to record plan version: ${err instanceof Error ? err.message : String(err)}`);
        });
        void this.syncTaskSteps(this.taskId, this.state.plan).catch(err => {
            this.logWarn(`Failed to sync task steps: ${err instanceof Error ? err.message : String(err)}`);
        });
        await this.saveState();
        this.emitUpdate();
    }


    private getModelConfig() {
        const model = this.state.config?.model ?? null;
        if (!model?.model || !model?.provider) {
            return {
                modelId: 'claude-3-5-sonnet-20241022',
                providerId: 'anthropic',
                systemMode: this.state.config?.systemMode,
            };
        }
        return {
            modelId: model.model,
            providerId: model.provider,
            systemMode: this.state.config?.systemMode,
        };
    }

    private async resolveWorkspacePath(): Promise<string | null> {
        const workspaceId = this.state.config?.workspaceId;
        if (!workspaceId) {
            return null;
        }
        if (workspaceId.includes('/') || workspaceId.includes('\\')) {
            return workspaceId;
        }
        const wsRecord = await this.services.database.getWorkspace(workspaceId);
        return wsRecord?.path ?? null;
    }

    private async getCurrentBranch(repoPath: string): Promise<string | null> {
        const result = await this.services.git.executeRaw(repoPath, 'rev-parse --abbrev-ref HEAD');
        if (!result.success) {
            return null;
        }
        const branch = result.stdout?.trim();
        return branch ? branch : null;
    }

    private async isGitRepository(repoPath: string): Promise<boolean> {
        const result = await this.services.git.executeRaw(repoPath, 'rev-parse --is-inside-work-tree');
        return result.success;
    }

    private async ensureFeatureBranchReady(): Promise<void> {
        if (this.gitContext?.enabled) {
            return;
        }

        const activeGithubAccount = await this.services.database.getActiveLinkedAccount('github');
        if (!activeGithubAccount) {
            this.logInfo('Skipping AGT-GIT automation: no active GitHub account');
            return;
        }

        const repoPath = await this.resolveWorkspacePath();
        if (!repoPath) {
            this.logInfo('Skipping AGT-GIT automation: no workspace selected');
            return;
        }
        if (!(await this.isGitRepository(repoPath))) {
            this.logWarn(`Skipping AGT-GIT automation: selected workspace is not a Git repository (${repoPath})`);
            return;
        }

        const baseBranch = await this.getCurrentBranch(repoPath);
        if (!baseBranch) {
            this.logWarn('Skipping AGT-GIT automation: failed to resolve current branch');
            return;
        }

        const taskSuffix = this.taskId.slice(0, 8);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const featureBranch = `agent/${taskSuffix}-${ts}`;
        const checkoutResult = await this.services.git.executeRaw(repoPath, `checkout -b ${featureBranch}`);
        if (!checkoutResult.success) {
            this.logWarn(`Failed to create feature branch: ${checkoutResult.error ?? 'unknown error'}`);
            return;
        }

        this.gitContext = {
            repoPath,
            baseBranch,
            featureBranch,
            autoCreated: true,
            enabled: true,
        };

        await this.addSystemLog(
            `Created feature branch \`${featureBranch}\` from \`${baseBranch}\` for task execution.`
        );
    }

    private getStepCommitMessage(stepIndex: number, stepText: string): string {
        const trimmed = stepText.trim().replace(/\s+/g, ' ').slice(0, 80);
        return `feat(agent): step ${stepIndex + 1} ${trimmed}`;
    }

    private sanitizeCommitMessage(message: string): string {
        return message.replace(/"/g, "'");
    }

    private async addSystemLog(content: string): Promise<void> {
        const msg = {
            id: randomUUID(),
            role: 'system',
            content,
            timestamp: new Date(),
        } as Message;
        this.pushToHistory(msg);
        try {
            await this.services.database.uac.addLog(this.taskId, msg.role, content);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logWarn(`Failed to persist system log: ${message}`);
        }
        this.emitUpdate();
    }

    private async getAvailableModelProviders(): Promise<string[]> {
        try {
            const linkedAccounts = await this.services.database.getLinkedAccounts();
            const activeProviders = Array.from(
                new Set(
                    linkedAccounts
                        .filter(account => account.isActive)
                        .map(account => account.provider)
                )
            );
            if (activeProviders.length > 0) {
                return activeProviders;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logWarn(`Failed to resolve linked providers for routing: ${message}`);
        }

        const configuredProvider = this.state.config?.model?.provider;
        if (configuredProvider) {
            return [configuredProvider];
        }
        return ['openai', 'anthropic'];
    }

    private async enrichPlanWithCollaboration(): Promise<void> {
        if (this.state.plan.length === 0) {
            return;
        }

        try {
            // MARCH1-COUNCIL-001: Use CouncilService to prepare the plan with quota-aware routing
            this.state.plan = await this.services.council.prepareCouncilPlan(this.taskId, this.state.plan);

            // Record that this plan was prepared via Council flow
            this.logInfo(`Council plan prepared with ${this.state.plan.length} steps`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logWarn(`Failed to apply collaborative routing via CouncilService: ${message}`);
            // Fallback to basic collaboration analysis if council service fails
            const analyzed = this.services.collaboration.analyzeSteps(this.state.plan);
            const providers = await this.getAvailableModelProviders();
            this.state.plan = analyzed.map(step => {
                if (step.modelConfig) {
                    return step;
                }
                const modelConfig = this.services.collaboration.getModelForStep(step, providers);
                return {
                    ...step,
                    modelConfig,
                };
            });
        }
    }

    private async autoCommitStep(stepIndex: number): Promise<void> {
        if (!this.gitContext?.enabled) {
            return;
        }
        const step = this.state.plan[stepIndex];
        if (!step) {
            return;
        }
        const { repoPath } = this.gitContext;
        const statusResult = await this.services.git.executeRaw(repoPath, 'status --porcelain');
        if (!statusResult.success) {
            this.logWarn(`Failed to read git status for auto-commit: ${statusResult.error ?? 'unknown error'}`);
            return;
        }
        const hasChanges = Boolean(statusResult.stdout?.trim());
        if (!hasChanges) {
            return;
        }

        const diffPreview = await this.services.git.executeRaw(repoPath, 'diff --stat');
        const previewText = diffPreview.success
            ? (diffPreview.stdout?.trim() || 'No diff summary available.')
            : 'Unable to produce diff preview.';
        await this.addSystemLog(`Diff preview before auto-commit (step ${stepIndex + 1}):\n${previewText}`);

        const addResult = await this.services.git.add(repoPath, '.');
        if (!addResult.success) {
            this.logWarn(`Auto-commit skipped: git add failed (${addResult.error ?? 'unknown error'})`);
            return;
        }

        const commitMessage = this.sanitizeCommitMessage(this.getStepCommitMessage(stepIndex, step.text));
        const commitResult = await this.services.git.commit(repoPath, commitMessage);
        if (!commitResult.success) {
            this.logWarn(`Auto-commit failed: ${commitResult.error ?? 'unknown error'}`);
            return;
        }

        const hashResult = await this.services.git.executeRaw(repoPath, 'rev-parse --short HEAD');
        const shortHash = hashResult.success ? hashResult.stdout?.trim() : '';
        await this.addSystemLog(
            `Auto-committed step ${stepIndex + 1}${shortHash ? ` as ${shortHash}` : ''}: ${commitMessage}`
        );
    }

    private async cleanupFeatureBranch(): Promise<void> {
        if (!this.gitContext?.enabled || !this.gitContext.autoCreated) {
            return;
        }
        const { repoPath, baseBranch, featureBranch } = this.gitContext;
        const currentBranch = await this.getCurrentBranch(repoPath);
        if (currentBranch === featureBranch) {
            const checkoutBase = await this.services.git.checkout(repoPath, baseBranch);
            if (!checkoutBase.success) {
                this.logWarn(`Failed to checkout base branch during cleanup: ${checkoutBase.error ?? 'unknown error'}`);
                return;
            }
        }

        const deleteResult = await this.services.git.executeRaw(repoPath, `branch -d ${featureBranch}`);
        if (!deleteResult.success) {
            this.logWarn(
                `Feature branch cleanup skipped for ${featureBranch}: ${deleteResult.error ?? 'branch is not fully merged'}`
            );
            return;
        }

        await this.addSystemLog(`Cleaned up feature branch \`${featureBranch}\` and returned to \`${baseBranch}\`.`);
        this.gitContext = null;
    }

    private normalizeGithubRemote(remoteUrl: string): string | null {
        const trimmed = remoteUrl.trim();
        if (trimmed.startsWith('git@github.com:')) {
            return `https://github.com/${trimmed.replace('git@github.com:', '').replace(/\.git$/, '')}`;
        }
        if (trimmed.startsWith('https://github.com/')) {
            return trimmed.replace(/\.git$/, '');
        }
        return null;
    }

    async createPullRequest(): Promise<{ success: boolean; url?: string; error?: string }> {
        const activeGithubAccount = await this.services.database.getActiveLinkedAccount('github');
        if (!activeGithubAccount) {
            return { success: false, error: 'No active GitHub account linked.' };
        }

        const repoPath = this.gitContext?.repoPath ?? (await this.resolveWorkspacePath());
        if (!repoPath) {
            return { success: false, error: 'No workspace selected.' };
        }
        if (!(await this.isGitRepository(repoPath))) {
            return { success: false, error: 'Selected workspace is not a Git repository.' };
        }

        const baseBranch = this.gitContext?.baseBranch ?? (await this.getCurrentBranch(repoPath));
        const featureBranch = this.gitContext?.featureBranch ?? (await this.getCurrentBranch(repoPath));
        if (!baseBranch || !featureBranch) {
            return { success: false, error: 'Unable to resolve branches for PR URL.' };
        }

        const remoteResult = await this.services.git.executeRaw(repoPath, 'remote get-url origin');
        if (!remoteResult.success || !remoteResult.stdout?.trim()) {
            return { success: false, error: 'Unable to resolve Git remote origin URL.' };
        }
        const githubRepoUrl = this.normalizeGithubRemote(remoteResult.stdout);
        if (!githubRepoUrl) {
            return { success: false, error: 'Origin remote is not a GitHub repository.' };
        }

        const compareUrl = `${githubRepoUrl}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(featureBranch)}?expand=1`;
        await this.addSystemLog(`Create PR URL generated: ${compareUrl}`);
        return { success: true, url: compareUrl };
    }

    private async executionLoop() {
        this.logInfo('Starting execution loop');

        while (!this.shouldStop) {
            try {
                if (!this.toolExecutor) { throw new Error('ToolExecutor not initialized'); }

                // AGT-HIL-01 / AGT-HIL-04: Pause before steps requiring approval or intervention
                const nextPendingStep = this.state.plan.find(s => s.status === 'pending');
                if (nextPendingStep && (nextPendingStep.requiresApproval || nextPendingStep.isInterventionPoint)) {
                    nextPendingStep.status = 'awaiting_step_approval';
                    this.logInfo(`Step "${nextPendingStep.text}" requires user approval before execution`);
                    this.emitUpdate();
                    await this.saveState();
                    break;
                }


                const toolDefs = await this.toolExecutor.getToolDefinitions();
                const planContext = `Current Plan Checklist:\n${this.state.plan
                    .map((step, index) => {
                        const statusMarker =
                            step.status === 'completed'
                                ? 'x'
                                : step.status === 'running'
                                    ? '/'
                                    : ' ';
                        const dependencies = step.dependsOn?.length
                            ? ` deps=${step.dependsOn.join(',')}`
                            : '';
                        const lane = ` lane=${(step.parallelLane ?? 0) + 1}`;
                        const priority = ` priority=${step.priority ?? 'normal'}`;
                        const type = ` type=${step.type ?? 'task'}`;
                        return `${index}. [${statusMarker}] ${step.text}${type}${priority}${lane}${dependencies}`;
                    })
                    .join('\n')}\n\nUse \`update_plan_step\` to update your progress. Always verify your work before completing a step.`;

                const currentHistory = [
                    ...this.state.history,
                    {
                        id: randomUUID(),
                        role: 'system',
                        content: planContext,
                        timestamp: new Date(),
                    } as Message,
                ];

                const { modelId } = this.getModelConfig();
                const optimizedHistory = await this.optimizeContext(currentHistory, modelId);

                const msg = this.getExecutionMode() === 'parallel'
                    ? await this.executeParallelStreamingStep(toolDefs, optimizedHistory)
                    : await this.executeStreamingStep(toolDefs, optimizedHistory);
                this.emitUpdate();

                if ((!msg.toolCalls || msg.toolCalls.length === 0) && !msg.content) {
                    break;
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                this.logError('Execution loop error', error as Error);
                this.state.lastError = `Execution failed: ${errorMsg}`;
                await this.stateMachine.transitionTo('failed');
                this.state.status = 'failed';
                // AGT-PLN-03: Record failed plan pattern for learning
                await this.recordPlanOutcome('failure');
                this.emitUpdate();
                break;
            }
        }
    }

    private async planningLoop() {
        try {
            if (!this.toolExecutor) { throw new Error('ToolExecutor not initialized'); }

            const PLANNING_TOOLS = ['read_file', 'list_directory', 'file_exists', 'get_file_info', 'search_web', 'fetch_webpage', 'fetch_json', 'get_system_info', 'propose_plan', 'recall', 'remember', 'forget'];
            this.logInfo('Starting planning loop');

            while (!this.shouldStop && this.state.status === 'planning') {
                const allTools = await this.toolExecutor.getToolDefinitions();
                const toolDefs = allTools.filter(t => PLANNING_TOOLS.includes(t.function.name));
                const { modelId, providerId } = this.getModelConfig();

                const optimizedHistory = await this.optimizeContext(this.state.history.slice(0, -1), modelId);

                const shouldBreak = await this.executePlanningStep(toolDefs, modelId, providerId, optimizedHistory);
                if (shouldBreak) {
                    this.logInfo('Planning loop breaking...');
                    break;
                }
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logError('Planning failed', error as Error);
            this.state.lastError = `Planning failed: ${errorMsg}`;
            await this.stateMachine.transitionTo('failed');
            this.state.status = 'failed';
            // AGT-PLN-03: Record failed plan pattern for learning
            await this.recordPlanOutcome('failure');
            this.emitUpdate();
        }
    }

    private async executeStreamingStep(toolDefs: ToolDefinition[], currentHistory: Message[]) {
        const { modelId, providerId } = this.getModelConfig();
        const msg = this.createAssistantMessage();
        this.pushToHistory(msg);

        await this.processMessageStream(
            msg,
            this.services.llm.chatStream(currentHistory, modelId, toolDefs, providerId, {
                signal: this.abortController?.signal,
            })
        );

        await this.finalizeStep(msg);
        return msg;
    }

    private getExecutionMode(): 'sequential' | 'parallel' {
        return this.state.config?.executionMode === 'parallel' ? 'parallel' : 'sequential';
    }

    private async getParallelModelConfigs(): Promise<ProviderModelConfig[]> {
        const current = this.getModelConfig();
        const configs: ProviderModelConfig[] = [{ providerId: current.providerId, modelId: current.modelId }];
        const providers = await this.getAvailableModelProviders();
        const providerDefaults: Record<string, string> = {
            anthropic: 'claude-3-5-sonnet-20241022',
            openai: 'gpt-4o',
            groq: 'llama-3.1-70b-versatile',
            opencode: 'gpt-4o',
            nvidia: 'meta/llama-3.1-70b-instruct',
        };

        for (const providerId of providers) {
            if (configs.some(config => config.providerId === providerId)) {
                continue;
            }
            configs.push({
                providerId,
                modelId: providerDefaults[providerId] ?? current.modelId,
            });
            if (configs.length >= 3) {
                break;
            }
        }

        return configs;
    }

    private async executeParallelStreamingStep(
        toolDefs: ToolDefinition[],
        currentHistory: Message[]
    ): Promise<Message & { reasoning?: string }> {
        const msg = this.createAssistantMessage();
        this.pushToHistory(msg);

        const modelConfigs = await this.getParallelModelConfigs();
        if (modelConfigs.length < 2) {
            const baseConfig = modelConfigs[0] ?? this.getModelConfig();
            await this.processMessageStream(
                msg,
                this.services.llm.chatStream(currentHistory, baseConfig.modelId, toolDefs, baseConfig.providerId, {
                    signal: this.abortController?.signal,
                })
            );
            await this.finalizeStep(msg);
            return msg;
        }

        const results = await Promise.allSettled(
            modelConfigs.map(async config => {
                const response = await this.services.llm.chat(
                    currentHistory,
                    config.modelId,
                    toolDefs,
                    config.providerId
                );
                return { config, response };
            })
        );

        const successful: Array<{ config: ProviderModelConfig; response: { content: string; tool_calls?: ToolCall[]; reasoning_content?: string } }> = [];
        for (const entry of results) {
            if (entry.status !== 'fulfilled') {
                continue;
            }
            const candidate = {
                config: entry.value.config,
                response: {
                    content: entry.value.response.content,
                    tool_calls: entry.value.response.tool_calls,
                    reasoning_content: entry.value.response.reasoning_content,
                },
            };
            if (
                candidate.response.content.trim().length > 0 ||
                (candidate.response.tool_calls?.length ?? 0) > 0
            ) {
                successful.push(candidate);
            }
        }

        if (successful.length === 0) {
            const baseConfig = modelConfigs[0];
            await this.processMessageStream(
                msg,
                this.services.llm.chatStream(currentHistory, baseConfig.modelId, toolDefs, baseConfig.providerId, {
                    signal: this.abortController?.signal,
                })
            );
            await this.finalizeStep(msg);
            return msg;
        }

        for (const candidate of successful) {
            if (candidate.response.tool_calls && candidate.response.tool_calls.length > 0) {
                this.mergeToolCalls(msg, candidate.response.tool_calls);
            }
        }

        if (successful.length === 1) {
            msg.content = successful[0].response.content;
            msg.reasoning = successful[0].response.reasoning_content;
        } else {
            const consensus = await this.services.collaboration.buildConsensus(
                successful.map(candidate => ({
                    model: `${candidate.config.providerId}:${candidate.config.modelId}`,
                    output: candidate.response.content,
                }))
            );
            msg.content = consensus.mergedOutput ?? successful[0].response.content;
            msg.reasoning = `Parallel execution consensus (${consensus.resolutionMethod})`;
        }

        this.emitUpdate();
        await this.finalizeStep(msg);
        return msg;
    }

    private async executePlanningStep(toolDefs: ToolDefinition[], modelId: string, providerId: string, history?: Message[]): Promise<boolean> {
        const { systemMode } = this.getModelConfig();
        const msg = this.createAssistantMessage();
        this.pushToHistory(msg);

        await this.processMessageStream(
            msg,
            this.services.llm.chatStream(
                history ?? this.state.history.slice(0, -1),
                modelId,
                toolDefs,
                providerId,
                { systemMode, signal: this.abortController?.signal }
            )
        );

        return this.handlePlanningResponse(msg);
    }

    /**
     * AGT-11: Optimize context window by truncating or summarizing history
     */
    private async optimizeContext(messages: Message[], model: string): Promise<Message[]> {
        try {
            const contextService = getContextWindowService();
            const reservedTokens = 4000; // Reserved for completion

            if (!contextService.needsTruncation(messages, model, reservedTokens)) {
                return messages;
            }

            this.logInfo(`Context window optimization triggered for model ${model}`);

            const result = contextService.truncateMessages(messages, model, {
                reservedTokens,
                keepSystemMessages: true,
                keepRecentMessages: 10,
                strategy: 'recent-first',
            });

            this.logInfo(`Truncated ${result.removedCount} messages. Utilization: ${result.info.utilizationPercent.toFixed(1)}%`);

            const optimizedMessages = result.truncated;

            // AGT-11: Summarize removed messages if they are significant
            if (result.removedCount > 5) {
                const removedMessages = messages.filter(m => !result.truncated.some(tm => tm.id === m.id));
                const summary = await this.summarizeRemovedMessages(removedMessages);

                // Insert summary after first system message
                const systemMsgIndex = optimizedMessages.findIndex(m => m.role === 'system');
                if (systemMsgIndex !== -1) {
                    optimizedMessages.splice(systemMsgIndex + 1, 0, {
                        id: randomUUID(),
                        role: 'system',
                        content: summary,
                        timestamp: new Date()
                    } as Message);
                } else {
                    optimizedMessages.unshift({
                        id: randomUUID(),
                        role: 'system',
                        content: summary,
                        timestamp: new Date()
                    } as Message);
                }

                await this.addSystemLog(`Optimized context by truncating ${result.removedCount} older messages and adding a summary.`);
            }

            return optimizedMessages;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logWarn(`Context optimization failed: ${message}`);
            return messages;
        }
    }

    /**
     * AGT-11: Summarize removed messages to maintain context
     */
    private async summarizeRemovedMessages(removedMessages: Message[]): Promise<string> {
        try {
            const content = removedMessages
                .filter(m => m.role !== 'system')
                .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : '[Object content]'}`)
                .join('\n')
                .slice(0, 10000); // Limit input to summary LLM

            if (!content) { return 'History truncated.'; }

            const prompt = `You are a context management assistant. Summarize the following previous interaction between an AI agent and the system/user. Focus on:
1. What the user asked for.
2. What key information was discovered.
3. What files were modified or created.
4. Current state of the plan.

Keep the summary concise (max 200 words).

Interaction to summarize:
${content}`;

            const { modelId, providerId } = this.getModelConfig();
            const response = await this.services.llm.chat([
                { id: randomUUID(), role: 'system', content: 'You summarize technical agent logs.', timestamp: new Date() },
                { id: randomUUID(), role: 'user', content: prompt, timestamp: new Date() }
            ], modelId, undefined, providerId);

            return `[RECAP OF TRUNCATED HISTORY]:\n${response.content}`;
        } catch (error) {
            this.logWarn(`Summarization failed: ${(error as Error).message}`);
            return `[History truncated: ${removedMessages.length} messages removed]`;
        }
    }

    // --- Message Helpers ---

    private createAssistantMessage(): Message & { reasoning?: string } {
        return {
            id: randomUUID(),
            role: 'assistant',
            content: '',
            reasoning: '',
            timestamp: new Date(),
        } as Message & { reasoning?: string };
    }

    private pushToHistory(message: Message) {
        this.state.history.push(message);
        if (this.state.history.length > AgentTaskExecutor.MAX_HISTORY_SIZE) {
            this.state.history = this.state.history.slice(-AgentTaskExecutor.MAX_HISTORY_SIZE);
        }
    }

    private async processMessageStream(
        msg: Message & { reasoning?: string },
        stream: AsyncGenerator<{
            content?: string;
            reasoning?: string;
            tool_calls?: ToolCall[];
            usage?: { prompt_tokens: number; completion_tokens: number };
        }>
    ) {
        for await (const chunk of stream) {
            if (chunk.content) { msg.content += chunk.content; }
            if (chunk.reasoning) {
                msg.reasoning ??= '';
                msg.reasoning += chunk.reasoning;
            }
            if (chunk.tool_calls) { this.mergeToolCalls(msg, chunk.tool_calls); }
            if (chunk.usage) {
                this.currentStepTokens.prompt += chunk.usage.prompt_tokens;
                this.currentStepTokens.completion += chunk.usage.completion_tokens;
                this.state.totalTokens = this.state.totalTokens ?? { prompt: 0, completion: 0 };
                this.state.totalTokens.prompt += chunk.usage.prompt_tokens;
                this.state.totalTokens.completion += chunk.usage.completion_tokens;

                // AGT-TOK-04: Check budget limits
                if (this.checkBudgetExceeded()) {
                    this.logWarn('Budget limit exceeded, stopping execution');
                    this.shouldStop = true;
                    this.state.lastError = 'Budget limit exceeded';
                    break;
                }
            }
            this.emitUpdate();
        }
    }

    /**
     * AGT-TOK-04: Check if current cost exceeds budget limit
     */
    private checkBudgetExceeded(): boolean {
        const budgetLimit = this.state.config?.budgetLimitUsd;
        if (!budgetLimit || budgetLimit <= 0) {
            return false;
        }

        const { modelId } = this.getModelConfig();
        const costService = getCostEstimationService();
        const totalTokens = this.state.totalTokens ?? { prompt: 0, completion: 0 };

        const currentCost = costService.calculateCost(
            totalTokens.prompt,
            totalTokens.completion,
            modelId
        );

        if (currentCost.costUsd >= budgetLimit) {
            // Emit budget exceeded event for UI notification
            this.services.eventBus.emit('workspace:budget-exceeded', {
                taskId: this.taskId,
                budgetLimitUsd: budgetLimit,
                currentCostUsd: currentCost.costUsd,
            });
            return true;
        }

        return false;
    }

    private mergeToolCalls(msg: Message, newCalls: ToolCall[]) {
        msg.toolCalls ??= [];
        for (const tc of newCalls) {
            const existing = msg.toolCalls.find(e => {
                const tcId = tc.id;
                const tcIdx = tc.index;
                const eId = e.id;
                const eIdx = e.index;
                return (
                    (tcId && eId && tcId === eId) ||
                    (tcIdx !== undefined && eIdx !== undefined && tcIdx === eIdx)
                );
            });

            if (existing) {
                existing.function.arguments += tc.function.arguments;
            } else {
                msg.toolCalls.push(tc);
            }
        }
    }

    private async finalizeStep(msg: Message & { reasoning?: string }) {
        try {
            const logContent = this.getLogContent(msg.content);
            await this.services.database.uac.addLog(this.taskId, msg.role, logContent);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logWarn(`Failed to add execution log to DB: ${message}`);
        }

        if (msg.toolCalls && msg.toolCalls.length > 0) {
            try {
                await this.executeToolCalls(msg.toolCalls);
            } catch (error) {
                this.logError('Failed to execute tool calls', error as Error);
            }
        }

        if (typeof msg.content === 'string' && this.checkTaskCompletion(msg.content)) {
            try {
                await this.completeTask();
            } catch (error) {
                this.logError('Failed to complete task', error as Error);
            }
        }
    }

    private async executeToolCalls(toolCalls: ToolCall[]) {
        const invocationResults = await this.toolInvocationManager.executeToolCalls(toolCalls);
        for (const { toolCallId, result } of invocationResults) {
            const msg = {
                id: randomUUID(),
                role: 'tool',
                content: JSON.stringify(result),
                toolCallId,
                timestamp: new Date(),
            } as Message;
            this.pushToHistory(msg);
            await this.services.database.uac.addLog(
                this.taskId,
                msg.role,
                String(msg.content),
                undefined,
                toolCallId
            );
        }
    }

    private getLogContent(content: string | Array<{ type: string; text?: string }>): string {
        if (typeof content === 'string') { return content; }
        return content.filter(c => c.type === 'text').map(c => c.text ?? '').join(' ');
    }

    private checkTaskCompletion(content: string): boolean {
        return content.toLowerCase().includes('task completed') || content.toLowerCase().includes('görev tamamlandı');
    }

    private async completeTask() {
        this.logInfo('Task completed by agent');
        this.state.plan.forEach(s => { if (s.status !== 'completed') { s.status = 'completed'; } });

        this.shouldStop = true;
        await this.stateMachine.transitionTo('completed');
        this.state.status = 'completed';

        await this.services.database.uac.updateTaskStatus(this.taskId, 'completed');
        await this.cleanupFeatureBranch();

        // AGT-PLN-03: Record successful plan pattern for learning
        await this.recordPlanOutcome('success');
    }

    /**
     * AGT-PLN-03: Record plan outcome for learning from past plans
     */
    private async recordPlanOutcome(outcome: 'success' | 'failure' | 'partial'): Promise<void> {
        try {
            const taskDescription = this.state.config?.task ?? '';
            // Extract keywords from task description (simple approach)
            const taskKeywords = taskDescription
                .toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 3)
                .slice(0, 10)
                .join(' ');

            // Create a pattern from the step texts
            const stepPattern = this.state.plan
                .map(s => s.text.substring(0, 50)) // Truncate long step texts
                .join(' | ');

            if (taskKeywords && stepPattern) {
                await this.services.database.uac.savePlanPattern(taskKeywords, stepPattern, outcome);
                this.logInfo(`Recorded plan pattern (${outcome}): ${taskKeywords.substring(0, 50)}...`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logWarn(`Failed to record plan pattern: ${message}`);
        }
    }

    /**
     * AGT-PLN-03: Get learning context from past successful plans
     */
    async getPlanLearningContext(): Promise<string> {
        try {
            const taskDescription = this.state.config?.task ?? '';
            const similarPatterns = await this.services.database.uac.findSimilarPatterns(taskDescription, 3);

            if (similarPatterns.length === 0) {
                return '';
            }

            const successfulPatterns = similarPatterns.filter(p => p.success_count > p.failure_count);
            const failedPatterns = similarPatterns.filter(p => p.failure_count > p.success_count);

            let context = '\n\n## Learning from Past Plans\n';

            if (successfulPatterns.length > 0) {
                context += '\n### Successful Approaches:\n';
                for (const pattern of successfulPatterns) {
                    context += `- Pattern (${pattern.success_count} successes): ${pattern.step_pattern.substring(0, 100)}...\n`;
                }
            }

            if (failedPatterns.length > 0) {
                context += '\n### Approaches to Avoid:\n';
                for (const pattern of failedPatterns) {
                    context += `- Pattern (${pattern.failure_count} failures): ${pattern.step_pattern.substring(0, 100)}...\n`;
                }
            }

            return context;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logWarn(`Failed to get plan learning context: ${message}`);
            return '';
        }
    }

    private async handlePlanningResponse(msg: Message & { reasoning?: string }): Promise<boolean> {
        await this.logPlanningToDB(msg);
        if (msg.toolCalls?.length) {
            await this.executeToolCalls(msg.toolCalls);
            if (this.shouldStop) {
                return true;
            }
            return false;
        }

        const msgContent = this.getLogContent(msg.content);
        if (msg.reasoning?.length) { return false; }

        return this.finalizePlanningStep(msg, msgContent);
    }

    private async logPlanningToDB(msg: Message & { reasoning?: string }) {
        try {
            const logContent = this.getLogContent(msg.content);
            await this.services.database.uac.addLog(
                this.taskId,
                msg.role,
                logContent,
                undefined,
                msg.toolCalls?.map(tc => tc.id).join(',')
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logWarn(`Failed to add planning log to DB: ${message}`);
        }
    }

    private async finalizePlanningStep(msg: Message & { reasoning?: string }, msgContent: string): Promise<boolean> {
        if (msgContent.length > 0 && (!msg.toolCalls || msg.toolCalls.length === 0)) {
            // Auto-propose text plan logic could go here, for now just force propose_plan usage
            if (await this.autoProposeTextPlan(msgContent)) {
                return true;
            }

            this.logInfo('Model output text but no tool calls. Injecting directive to use propose_plan.');
            this.pushToHistory({
                id: randomUUID(),
                role: 'user',
                content: 'You provided a text response. Please strictly use the `propose_plan` tool to submit the plan. Do not just write it in the chat.',
                timestamp: new Date(),
            } as Message);
            this.emitUpdate();
            return false;
        }
        return !msg.toolCalls?.length && !msg.content && !msg.reasoning;
    }

    // --- Plan Parsing Helpers ---

    private async autoProposeTextPlan(content: string): Promise<boolean> {
        const jsonSteps = this.planCompiler.parseJsonPlan(content);
        if (jsonSteps && jsonSteps.length > 0) {
            this.services.eventBus.emit('workspace:plan-proposed', { steps: jsonSteps, taskId: this.taskId });
            this.shouldStop = true;
            return true;
        }

        // Simple text fallback
        const cleanContent = content.trim();
        if (cleanContent.length >= 20 && cleanContent.length <= 2000 && !cleanContent.includes('```')) {
            // Basic list check
            if (content.split('\n').filter(l => l.match(/^\d+\./)).length > 0) {
                // It looks like a list?
                // For now, let's just delegate to the event bus if confident
            }
        }
        return false;
    }

    // --- Node & Step Management ---

    private handleStepStatusUpdate(
        index: number,
        status: WorkspaceStepStatus
    ): void {
        if (status === 'running') {
            if (!this.canRunStep(index)) {
                this.logWarn(
                    `Step ${index} is blocked by unresolved dependencies: ${this.getPendingDependencyIds(index).join(', ')}`
                );
                return;
            }
            this.startStep(index);
            return;
        }
        if (status === 'completed' || status === 'failed') {
            this.completeStep(index, status);
            if (status === 'completed') {
                this.activateReadyDependentSteps();
            }
            return;
        }
        this.state.plan[index].status = status;
    }

    private getPendingDependencyIds(index: number): string[] {
        return this.taskStateMachine.getPendingDependencyIds(this.state.plan, index);
    }

    private canRunStep(index: number): boolean {
        return this.taskStateMachine.canRunStep(this.state.plan, index);
    }

    private activateReadyDependentSteps(): void {
        this.taskStateMachine.activateReadyDependentSteps(this.state.plan);
    }

    private normalizePlan(plan: WorkspaceStep[] | string[]): WorkspaceStep[] {
        return this.planCompiler.normalizePlan(plan);
    }

    private async createExecutionNode(): Promise<string> {
        try {
            const planningTask = await this.services.database.uac.getTask(this.taskId);
            if (!planningTask?.node_id) {
                return planningTask?.node_id ?? randomUUID();
            }

            const planningNodeId = planningTask.node_id;
            const planningNode = await this.services.database.uac.getCanvasNodeById(planningNodeId);
            if (!planningNode) { return planningNodeId; }

            const planningNodeData = JSON.parse(planningNode.data);
            const executionNodeId = randomUUID();
            const executionNodeData = {
                ...planningNodeData,
                taskId: this.taskId,
                label: `Execution: ${planningTask.description.substring(0, 30)}...`,
                status: 'running',
                type: 'execution',
            };

            await this.services.database.uac.saveCanvasNodes([
                {
                    id: executionNodeId,
                    type: 'task',
                    position: {
                        x: planningNode.position_x + 300,
                        y: planningNode.position_y,
                    },
                    data: executionNodeData,
                },
            ]);

            await this.services.database.uac.saveCanvasEdges([
                {
                    id: randomUUID(),
                    source: planningNodeId,
                    target: executionNodeId,
                    sourceHandle: undefined,
                    targetHandle: undefined,
                },
            ]);

            await this.services.database.uac.updateTaskNodeId(this.taskId, executionNodeId);
            return executionNodeId;
        } catch {
            return randomUUID();
        }
    }

    private async syncTaskSteps(taskId: string, steps: WorkspaceStep[]): Promise<void> {
        const existingSteps = await this.services.database.uac.getSteps(taskId);

        if (existingSteps.length === 0) {
            await this.services.database.uac.createSteps(taskId, steps);
            return;
        }

        const sameDefinition =
            existingSteps.length === steps.length &&
            existingSteps.every((existing, index) => {
                const current = steps[index];
                return existing.id === current.id && existing.text === current.text;
            });

        if (!sameDefinition) {
            await this.services.database.uac.deleteStepsByTask(taskId);
            await this.services.database.uac.createSteps(taskId, steps);
            return;
        }

        for (let i = 0; i < steps.length; i++) {
            const current = steps[i];
            const existing = existingSteps[i];
            if (existing.status !== current.status) {
                await this.services.database.uac.updateStepStatus(current.id, current.status);
            }
        }
    }

    private async recordPlanVersion(reason: PlanVersionItem['reason']): Promise<PlanVersionItem | null> {
        if (this.state.plan.length === 0) { return null; }
        return await this.services.checkpoint.createPlanVersion(this.taskId, this.state.plan, reason);
    }

    private buildWorkspaceStateFromRecords(
        activeTask: UacTaskRecord,
        steps: UacStepRecord[],
        logs: UacLogRecord[]
    ): WorkspaceState {
        const metadata = activeTask.metadata
            ? safeJsonParse<Record<string, unknown>>(activeTask.metadata, {})
            : {};

        const agentProfileId = metadata['agentProfileId'];
        const profileId = typeof agentProfileId === 'string' ? agentProfileId : 'default';
        const workspaceId = typeof activeTask[WORKSPACE_COMPAT_PATH_COLUMN] === 'string'
            ? activeTask[WORKSPACE_COMPAT_PATH_COLUMN]
            : undefined;

        return {
            status: activeTask.status as WorkspaceState['status'],
            currentTask: activeTask.description,
            taskId: activeTask.id,
            nodeId: activeTask.node_id ?? undefined,
            plan: steps.map(step => ({
                id: step.id,
                text: step.text,
                status: step.status as WorkspaceStep['status'],
            })),
            history: logs.map(log => ({
                id: log.id,
                role: log.role as Message['role'],
                content: log.content,
                timestamp: new Date(log.created_at),
                toolCalls: log.tool_call_id ? [] : undefined,
            })),
            config: {
                task: activeTask.description,
                workspaceId,
                agentProfileId: profileId,
                model: metadata['model'] as { provider: string; model: string } | undefined,
                systemMode: metadata['systemMode'] as 'fast' | 'thinking' | 'architect' | undefined,
            },
        };
    }

    private startStep(stepIndex: number): void {
        this.taskStateMachine.startStep(this.state.plan, stepIndex);
        this.currentStepTokens = { prompt: 0, completion: 0 };
    }

    private completeStep(stepIndex: number, status: 'completed' | 'failed' = 'completed'): void {
        if (stepIndex < 0 || stepIndex >= this.state.plan.length) { return; }
        const step = this.state.plan[stepIndex];
        step.status = status;
        const completedAt = Date.now();
        step.timing = {
            ...step.timing,
            completedAt,
            durationMs: step.timing?.startedAt ? completedAt - step.timing.startedAt : undefined,
        };
        step.tokens = { ...this.currentStepTokens };

        // AGT-PLN-01: Auto-retry failed steps with alternative approach
        if (status === 'failed') {
            const retryCount = this.stepRetryCount.get(step.id) ?? 0;
            if (retryCount < AgentTaskExecutor.MAX_AUTO_RETRIES) {
                this.stepRetryCount.set(step.id, retryCount + 1);
                this.logInfo(`Auto-retrying step ${stepIndex} (attempt ${retryCount + 1}/${AgentTaskExecutor.MAX_AUTO_RETRIES})`);
                void this.autoRetryStepWithAlternative(stepIndex, retryCount + 1).catch(err => {
                    this.logWarn(`Auto-retry failed for step ${stepIndex}: ${err instanceof Error ? err.message : String(err)}`);
                });
                return; // Don't save checkpoint yet, we're retrying
            }
            this.logWarn(`Step ${stepIndex} exhausted all retry attempts (${AgentTaskExecutor.MAX_AUTO_RETRIES})`);
        }

        // Auto-save checkpoint
        void (async () => {
            try {
                const taskState = this.mapToAgentTaskState();
                await this.services.checkpoint.saveCheckpoint(
                    this.taskId,
                    stepIndex,
                    taskState,
                    'auto_step_completion'
                );
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.logWarn(`Failed to auto-save checkpoint: ${message}`);
            }
        })();

        if (status === 'completed') {
            // AGT-TST-01: Run tests after step completion if configured
            void this.runTestsAfterStep(stepIndex).catch(err => {
                this.logWarn(`Failed to run tests after step ${stepIndex}: ${err instanceof Error ? err.message : String(err)}`);
            });
            void this.autoCommitStep(stepIndex).catch(err => {
                this.logWarn(`Failed to auto-commit step ${stepIndex}: ${err instanceof Error ? err.message : String(err)}`);
            });
        }
    }

    // ===== AGT-TST: Test Integration Methods =====

    /**
     * AGT-TST-01: Run tests after a step completes
     */
    private async runTestsAfterStep(stepIndex: number): Promise<void> {
        const step = this.state.plan[stepIndex];
        if (!step) {
            return;
        }

        // Check if tests should run for this step
        const stepTestConfig = step.testConfig;
        if (!stepTestConfig?.enabled || !stepTestConfig.runAfterStep) {
            return;
        }

        // Get workspace path from git context or working directory
        const workspacePath = this.gitContext?.repoPath ?? process.cwd();
        if (!workspacePath) {
            this.logWarn('Cannot run tests: no workspace path available');
            return;
        }

        this.logInfo(`Running tests after step ${stepIndex}...`);

        try {
            const result = await this.testRunner.runTestsForStep(
                workspacePath,
                stepTestConfig,
                this.testConfig ?? undefined
            );

            // AGT-TST-02: Store test result in step
            step.testResult = result;
            this.emitUpdate();

            // AGT-TST-04: Track coverage
            if (result.coverage && this.testConfig?.coverageEnabled) {
                this.testRunner.trackPlanCoverage(this.taskId, result.coverage);
            }

            // AGT-TST-03: Fail step if tests fail
            if (this.testRunner.shouldFailStep(stepTestConfig, result)) {
                this.logWarn(`Tests failed for step ${stepIndex}: ${result.failed}/${result.totalTests} failed`);
                step.status = 'failed';
                this.emitUpdate();
            } else {
                this.logInfo(`Tests passed for step ${stepIndex}: ${result.passed}/${result.totalTests} passed`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logError(`Test execution failed: ${message}`);
        }
    }

    /**
     * AGT-TST-01: Set plan-level test configuration
     */
    setTestConfig(config: TestRunConfig): void {
        this.testConfig = config;
        this.logInfo(`Test configuration set: ${config.framework} with coverage=${config.coverageEnabled}`);
    }

    /**
     * AGT-TST-04: Get coverage summary for the plan
     */
    getPlanCoverage(): TestRunResult['coverage'] | null {
        return this.testRunner.getPlanCoverage(this.taskId);
    }

    /**
     * AGT-PLN-01: Auto-retry a failed step with an alternative approach
     * Injects a prompt asking the LLM to try a different strategy
     */
    private async autoRetryStepWithAlternative(stepIndex: number, attemptNumber: number): Promise<void> {
        const step = this.state.plan[stepIndex];
        step.status = 'pending';

        // Craft a retry prompt that encourages an alternative approach
        const retryPrompt = attemptNumber === 1
            ? `Step "${step.text}" failed. Please try an alternative approach to accomplish this step. ` +
            `Consider: different tools, simpler implementation, or breaking it into smaller sub-steps.`
            : `Step "${step.text}" failed again (attempt ${attemptNumber}). Please try a completely different strategy. ` +
            `If the original approach is not working, consider: ` +
            `1) Using different tools or APIs ` +
            `2) Simplifying the requirements ` +
            `3) Working around the issue ` +
            `4) Asking for clarification if the step is unclear`;

        this.pushToHistory({
            id: randomUUID(),
            role: 'user',
            content: retryPrompt,
            timestamp: new Date(),
        } as Message);

        this.emitUpdate();
        // The execution loop will pick up the pending step and continue
    }

    private mapToAgentTaskState(): AgentTaskState {
        const baseState = createInitialAgentState(this.taskId, this.state.config?.workspaceId ?? '');

        // Map Status
        switch (this.state.status) {
            case 'waiting_for_approval': baseState.state = 'planning'; break;
            case 'running': baseState.state = 'executing'; break;
            case 'idle': baseState.state = 'idle'; break;
            case 'completed': baseState.state = 'completed'; break;
            case 'failed': baseState.state = 'failed'; break;
            case 'paused': baseState.state = 'paused'; break;
            default: baseState.state = 'idle';
        }

        baseState.description = this.state.config?.task ?? '';

        const runningIndex = this.state.plan.findIndex(s => s.status === 'running');
        baseState.currentStep = runningIndex !== -1 ? runningIndex : this.state.plan.length;
        if (baseState.state === 'planning') { baseState.currentStep = 0; }

        if (this.state.plan.length > 0) {
            baseState.plan = {
                steps: this.state.plan.map((s, i) => ({
                    index: i,
                    description: s.text,
                    type: this.mapTaskTypeToCheckpointStepType(s.taskType),
                    status: s.status === 'running' ? 'in_progress' : (s.status === 'pending' ? 'pending' : (s.status === 'completed' ? 'completed' : 'failed')),
                    toolsUsed: [],
                })),
                requiredTools: [],
                dependencies: this.state.plan.flatMap(step => step.dependsOn ?? []),
            };
            baseState.totalSteps = this.state.plan.length;
        }

        baseState.messageHistory = this.state.history;
        return baseState;
    }

    private mapTaskTypeToCheckpointStepType(taskType?: WorkspaceStep['taskType']):
        'analysis' | 'code_generation' | 'refactoring' | 'testing' | 'documentation' | 'deployment' {
        switch (taskType) {
            case 'research':
            case 'planning':
            case 'code_review':
            case 'general':
                return 'analysis';
            case 'debugging':
                return 'code_generation';
            case 'code_generation':
            case 'refactoring':
            case 'testing':
            case 'documentation':
                return taskType;
            default:
                return 'code_generation';
        }
    }

    private async saveState() {
        try {
            const stepIndex = this.state.plan.findIndex(s => s.status === 'running');
            const indexToSave = stepIndex >= 0 ? stepIndex : this.state.plan.length;
            const taskState = this.mapToAgentTaskState();
            await this.services.checkpoint.saveCheckpoint(
                this.taskId,
                indexToSave,
                taskState,
                'auto_state_sync'
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logWarn(`Failed to save checkpoint: ${message}`);
        }
    }

    async saveManualSnapshot(): Promise<string> {
        const stepIndex = this.state.plan.findIndex(s => s.status === 'running');
        const indexToSave = stepIndex >= 0 ? stepIndex : this.state.plan.length;
        const taskState = this.mapToAgentTaskState();
        return await this.services.checkpoint.saveCheckpoint(
            this.taskId,
            indexToSave,
            taskState,
            'manual_snapshot'
        );
    }
}
