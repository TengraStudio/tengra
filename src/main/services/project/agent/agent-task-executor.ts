import { randomUUID } from 'crypto';

import { appLogger } from '@main/logging/logger';
import { DatabaseService } from '@main/services/data/database.service';
import type {
    UacLogRecord,
    UacStepRecord,
    UacTaskRecord,
} from '@main/services/data/repositories/uac.repository';
import { getCostEstimationService } from '@main/services/llm/cost-estimation.service';
import { LLMService } from '@main/services/llm/llm.service';
import { AgentCheckpointService } from '@main/services/project/agent/agent-checkpoint.service';
import { AgentRegistryService } from '@main/services/project/agent/agent-registry.service';
import { createInitialAgentState } from '@main/services/project/agent/agent-state-machine';
import { EventBusService } from '@main/services/system/event-bus.service';
import { ToolExecutor } from '@main/tools/tool-executor';
import { StateMachine } from '@main/utils/state-machine.util';
import { AgentTaskState } from '@shared/types/agent-state';
import { Message, ToolCall, ToolDefinition } from '@shared/types/chat';
import {
    AgentStartOptions,
    PlanVersionItem,
    ProjectState,
    ProjectStep,
    RollbackCheckpointResult,
} from '@shared/types/project-agent';
import { safeJsonParse } from '@shared/utils/sanitize.util';

export interface AgentServices {
    database: DatabaseService;
    llm: LLMService;
    eventBus: EventBusService;
    registry: AgentRegistryService;
    checkpoint: AgentCheckpointService;
}

export class AgentTaskExecutor {
    private static readonly MAX_HISTORY_SIZE = 100;
    /** AGT-PLN-01: Maximum auto-retry attempts per step */
    private static readonly MAX_AUTO_RETRIES = 2;

    public state: ProjectState;
    private stateMachine: StateMachine<ProjectState['status'], string>;
    private abortController: AbortController | null = null;
    private toolExecutor?: ToolExecutor;
    private currentStepTokens = { prompt: 0, completion: 0 };
    private shouldStop: boolean = false;

    // Status flags
    private startRequestInFlight = false;
    private planRequestInFlight = false;

    /** AGT-PLN-01: Track retry counts per step */
    private stepRetryCount = new Map<string, number>();

    // Event listeners
    private unsubscribeStepUpdate?: () => void;
    private unsubscribePlanProposed?: () => void;

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

        this.setupEventListeners();
    }

    setToolExecutor(toolExecutor: ToolExecutor) {
        this.toolExecutor = toolExecutor;
    }

    public getStatus(): ProjectState {
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
        this.services.eventBus.emit('project:update', {
            ...this.state,
        });
    }

    private setupEventListeners() {
        this.unsubscribeStepUpdate = this.services.eventBus.on('project:step-update', payload => {
            if (payload.taskId && payload.taskId !== this.taskId) { return; } // Filtering

            void (async () => {
                try {
                    this.logInfo(`Received project:step-update: ${JSON.stringify(payload)}`);
                    const { index, status, message } = payload;
                    if (index >= 0 && index < this.state.plan.length) {
                        if (status === 'running') {
                            this.startStep(index);
                        } else if (status === 'completed' || status === 'failed') {
                            this.completeStep(index, status);
                        } else {
                            this.state.plan[index].status = status;
                        }

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

        this.unsubscribePlanProposed = this.services.eventBus.on('project:plan-proposed', payload => {
            if (payload.taskId && payload.taskId !== this.taskId) { return; }

            this.logInfo(`Received project:plan-proposed event with ${payload.steps.length} steps`);
            if (this.state.status !== 'planning') {
                this.logWarn(`Ignoring proposed plan while state is ${this.state.status}`);
                return;
            }
            void (async () => {
                try {
                    const { steps } = payload;
                    this.state.plan = steps.map(text => ({
                        id: randomUUID(),
                        text: String(text),
                        status: 'pending',
                    }));

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
        this.services.eventBus.on('project:plan-revised', payload => {
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
        void this.recordPlanVersion('manual');

        // Sync to DB and emit update
        void this.syncTaskSteps(this.taskId, this.state.plan);
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
            this.services.eventBus.emit('project:cost-estimated', {
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
        this.unsubscribeStepUpdate = undefined;
        this.unsubscribePlanProposed = undefined;
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

            this.state = this.buildProjectStateFromRecords(task, steps, logs);
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
            const restoredSteps: ProjectStep[] = snapshotState.plan.steps.map(s => ({
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
            const { task, projectId, attachments, agentProfileId } = config;
            const profile = this.services.registry.getProfile(agentProfileId ?? 'default');
            const systemPrompt = profile.systemPrompt;

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
                        content: `Task: ${String(task)} \n\nProject Context: ${projectId ?? 'None'} \nAttachments: ${attachments?.map(a => a.name).join(', ') ?? 'None'} `,
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
            const { task, projectId, agentProfileId } = config;
            const profile = this.services.registry.getProfile(agentProfileId ?? 'default');
            const systemPrompt = profile.systemPrompt;

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
                    content: `Task: ${String(task)}\n\nProject Context: ${projectId ?? 'None'}\n\nINSTRUCTIONS:\n1. Analyze this task briefly\n2. Call the \`propose_plan\` tool with your implementation steps\n\nFALLBACK (if tool calling is not available):\nReturn a JSON object: { "steps": ["step 1", "step 2", ...] }`,
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

    async approvePlan(plan: ProjectStep[] | string[]): Promise<void> {
        if (!this.stateMachine.can('running')) {
            this.logWarn(`Cannot approve plan in state: ${this.state.status}`);
            return;
        }

        this.state.plan = this.normalizePlan(plan);

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

    // --- Private Execution Logic ---

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

    private async executionLoop() {
        this.logInfo('Starting execution loop');

        while (!this.shouldStop) {
            try {
                if (!this.toolExecutor) { throw new Error('ToolExecutor not initialized'); }

                // Update step progress logic?

                const toolDefs = await this.toolExecutor.getToolDefinitions();
                const planContext = `Current Plan Checklist:\n${this.state.plan.map((s, i) => `${i}. [${s.status === 'completed' ? 'x' : s.status === 'running' ? '/' : ' '}] ${s.text}`).join('\n')}\n\nUse \`update_plan_step\` to update your progress. Always verify your work before completing a step.`;

                const currentHistory = [
                    ...this.state.history,
                    {
                        id: randomUUID(),
                        role: 'system',
                        content: planContext,
                        timestamp: new Date(),
                    } as Message,
                ];

                const msg = await this.executeStreamingStep(toolDefs, currentHistory);
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

                const shouldBreak = await this.executePlanningStep(toolDefs, modelId, providerId);
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

    private async executePlanningStep(toolDefs: ToolDefinition[], modelId: string, providerId: string): Promise<boolean> {
        const { systemMode } = this.getModelConfig();
        const msg = this.createAssistantMessage();
        this.pushToHistory(msg);

        await this.processMessageStream(
            msg,
            this.services.llm.chatStream(
                this.state.history.slice(0, -1),
                modelId,
                toolDefs,
                providerId,
                { systemMode, signal: this.abortController?.signal }
            )
        );

        return this.handlePlanningResponse(msg);
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
            this.services.eventBus.emit('project:budget-exceeded', {
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
        if (!this.toolExecutor) { return; }

        for (const toolCall of toolCalls) {
            // Pass this.taskId in context so events are correctly tagged
            const result = await this.toolExecutor.execute(
                toolCall.function.name,
                safeJsonParse(toolCall.function.arguments, {}),
                { taskId: this.taskId }
            );
            const msg = {
                id: randomUUID(),
                role: 'tool',
                content: JSON.stringify(result),
                toolCallId: toolCall.id,
                timestamp: new Date(),
            } as Message;
            this.pushToHistory(msg);

            await this.services.database.uac.addLog(
                this.taskId,
                msg.role,
                String(msg.content),
                undefined,
                toolCall.id
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
        const jsonSteps = this.tryParseJsonPlan(content);
        if (jsonSteps && jsonSteps.length > 0) {
            this.services.eventBus.emit('project:plan-proposed', { steps: jsonSteps, taskId: this.taskId });
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

    private tryParseJsonPlan(content: string): string[] | null {
        const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonContent = jsonBlockMatch ? jsonBlockMatch[1].trim() : content.trim();

        const jsonPatterns = [
            /\{[\s\S]*"steps"\s*:\s*\[[\s\S]*\][\s\S]*\}/,
            /\{[\s\S]*"plan"\s*:\s*\[[\s\S]*\][\s\S]*\}/,
            /\[[\s\S]*\]/,
        ];

        for (const pattern of jsonPatterns) {
            const match = jsonContent.match(pattern) ?? content.match(pattern);
            if (!match) { continue; }

            try {
                const parsed = JSON.parse(match[0]) as unknown;
                return this.extractStepsFromParsed(parsed);
            } catch {
                // ignore
            }
        }
        return null;
    }

    private extractStepsFromParsed(parsed: unknown): string[] | null {
        if (Array.isArray(parsed)) { return this.arrayToSteps(parsed); }
        if (typeof parsed !== 'object' || parsed === null) { return null; }

        const obj = parsed as Record<string, unknown>;
        const stepsArray = obj['steps'] ?? obj['plan'];
        if (Array.isArray(stepsArray)) { return this.arrayToSteps(stepsArray); }
        return null;
    }

    private arrayToSteps(arr: unknown[]): string[] | null {
        if (arr.length === 0) { return null; }
        const steps = arr.map(s => {
            if (typeof s === 'string') { return s; }
            if (typeof s === 'object' && s !== null && 'text' in s) { return String((s as { text: string }).text); }
            return String(s);
        }).filter(s => s.length > 0);
        return steps.length > 0 ? steps : null;
    }

    // --- Node & Step Management ---

    private normalizePlan(plan: ProjectStep[] | string[]): ProjectStep[] {
        if (plan.length === 0) { return []; }
        if (typeof plan[0] === 'string') {
            return (plan as string[]).map(text => ({
                id: randomUUID(),
                text,
                status: 'pending',
            }));
        }
        return (plan as ProjectStep[]).map(step => ({
            id: step.id,
            text: step.text,
            status: step.status,
        }));
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

    private async syncTaskSteps(taskId: string, steps: ProjectStep[]): Promise<void> {
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

    private buildProjectStateFromRecords(
        activeTask: UacTaskRecord,
        steps: UacStepRecord[],
        logs: UacLogRecord[]
    ): ProjectState {
        const metadata = activeTask.metadata
            ? safeJsonParse<Record<string, unknown>>(activeTask.metadata, {})
            : {};

        const agentProfileId = metadata['agentProfileId'];
        const profileId = typeof agentProfileId === 'string' ? agentProfileId : 'default';

        return {
            status: activeTask.status as ProjectState['status'],
            currentTask: activeTask.description,
            taskId: activeTask.id,
            nodeId: activeTask.node_id ?? undefined,
            plan: steps.map(step => ({
                id: step.id,
                text: step.text,
                status: step.status as ProjectStep['status'],
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
                projectId: activeTask.project_path,
                agentProfileId: profileId,
                model: metadata['model'] as { provider: string; model: string } | undefined,
                systemMode: metadata['systemMode'] as 'fast' | 'thinking' | 'architect' | undefined,
            },
        };
    }

    private startStep(stepIndex: number): void {
        if (stepIndex < 0 || stepIndex >= this.state.plan.length) { return; }
        const step = this.state.plan[stepIndex];
        step.status = 'running';
        step.timing = { startedAt: Date.now() };
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
                void this.autoRetryStepWithAlternative(stepIndex, retryCount + 1);
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
        const baseState = createInitialAgentState(this.taskId, this.state.config?.projectId ?? '');

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
                    type: 'code_generation',
                    status: s.status === 'running' ? 'in_progress' : (s.status === 'pending' ? 'pending' : (s.status === 'completed' ? 'completed' : 'failed')),
                    toolsUsed: [],
                })),
                requiredTools: [],
                dependencies: [],
            };
            baseState.totalSteps = this.state.plan.length;
        }

        baseState.messageHistory = this.state.history;
        return baseState;
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
}
