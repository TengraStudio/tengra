import { randomUUID } from 'crypto';

import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { LLMService } from '@main/services/llm/llm.service';
import { AgentRegistryService } from '@main/services/project/agent/agent-registry.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { ToolExecutor } from '@main/tools/tool-executor';
import { StateMachine } from '@main/utils/state-machine.util';
import { AgentTaskState } from '@shared/types/agent-state';
import { Message, ToolCall, ToolDefinition } from '@shared/types/chat';
import { AgentStartOptions, ProjectState, ProjectStep } from '@shared/types/project-agent';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { AgentTaskState, ExecutionPlan, PlanStep, ProviderConfig, AgentContext } from '@shared/types/agent-state';

import { AgentPersistenceService } from './agent/agent-persistence.service';
import { createInitialAgentState } from './agent/agent-state-machine';



export class ProjectAgentService extends BaseService {
    private static readonly MAX_HISTORY_SIZE = 100;
    private state: ProjectState = {
        status: 'idle',
        currentTask: '',
        plan: [],
        history: [],
        totalTokens: { prompt: 0, completion: 0 }
    };
    private shouldStop: boolean = false;
    private toolExecutor?: ToolExecutor;

    /** Track tokens for current step */
    private currentStepTokens = { prompt: 0, completion: 0 };

    private stateMachine: StateMachine<ProjectState['status'], string>;
    private currentTaskId: string | null = null;
    private abortController: AbortController | null = null;
    private startRequestInFlight = false;
    private planRequestInFlight = false;

    constructor(
        private databaseService: DatabaseService,
        private llmService: LLMService,
        public eventBus: EventBusService,
        private agentRegistryService: AgentRegistryService,
        private agentPersistenceService: AgentPersistenceService
    ) {
        super('ProjectAgentService');

        this.stateMachine = new StateMachine('ProjectAgent', 'idle', [
            { from: ['idle', 'completed', 'failed', 'error'], to: 'running' },
            { from: ['idle', 'completed', 'failed', 'error'], to: 'planning' },
            { from: ['planning'], to: 'waiting_for_approval' },
            { from: ['waiting_for_approval'], to: 'running' },
            { from: ['running', 'planning', 'waiting_for_approval'], to: 'paused' },
            { from: ['paused'], to: 'running' },
            { from: ['running', 'planning'], to: 'completed' },
            { from: ['running', 'planning', 'waiting_for_approval'], to: 'failed' },
            // Allow reset to idle from anywhere
            { from: ['planning', 'waiting_for_approval', 'running', 'paused', 'failed', 'completed', 'error'], to: 'idle' }
        ]);
    }

    setToolExecutor(toolExecutor: ToolExecutor) {
        this.toolExecutor = toolExecutor;
    }

    override async initialize(): Promise<void> {
        await this.loadState();
        this.logInfo('ProjectAgentService initialized');

        // Listen for tool-triggered step updates
        this.eventBus.on('project:step-update', (payload) => {
            void (async () => {
                try {
                    this.logInfo(`Received project:step-update: ${JSON.stringify(payload)}`);
                    const { index, status, message } = payload;
                    if (index >= 0 && index < this.state.plan.length) {
                        // Use helper methods for proper token/timing tracking
                        if (status === 'running') {
                            this.startStep(index);
                        } else if (status === 'completed' || status === 'failed') {
                            this.completeStep(index, status);
                        } else {
                            this.state.plan[index].status = status;
                            // For non-completion updates, we might still want to checkpoint if meaningful
                        }

                        if (this.currentTaskId) {
                            await this.databaseService.uac.updateStepStatus(this.state.plan[index].id, status);
                        }
                        if (message) {
                            this.logInfo(`Step ${index} updated to ${status}: ${message}`);
                        }
                    }
                    await this.saveState();
                    this.emitUpdate();
                } catch (error) {
                    this.logWarn(`Failed to handle step update: ${error instanceof Error ? error.message : String(error)}`);
                }
            })();
        });

        // Listen for plan proposals
        this.eventBus.on('project:plan-proposed', (payload) => {
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
                        status: 'pending'
                    }));

                    this.logInfo(`Transitioning to waiting_for_approval with plan: ${JSON.stringify(this.state.plan)}`);
                    await this.stateMachine.transitionTo('waiting_for_approval');
                    this.state.status = 'waiting_for_approval';

                    if (this.currentTaskId) {
                        try {
                            await this.syncTaskSteps(this.currentTaskId, this.state.plan);
                            await this.databaseService.uac.updateTaskStatus(this.currentTaskId, 'waiting_for_approval');
                        } catch (dbError) {
                            this.logWarn(`Failed to sync plan to DB: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
                        }
                    }
                } catch (error) {
                    this.logError('Failed to handle proposed plan', error as Error);
                } finally {
                    this.shouldStop = true;
                    this.emitUpdate();
                }
            })();
        });
    }

    async getTaskHistory(projectId: string): Promise<import('@shared/types/project-agent').AgentTaskHistoryItem[]> {
        try {
            const tasks = await this.databaseService.uac.getTasks(projectId);
            const history: import('@shared/types/project-agent').AgentTaskHistoryItem[] = [];

            for (const task of tasks) {
                let latestCheckpointId: string | undefined;
                let provider = 'unknown';
                let model = 'unknown';

                try {
                    if (task.metadata) {
                        const metadata = JSON.parse(task.metadata);
                        if (metadata.model) {
                            provider = metadata.model.provider || 'unknown';
                            model = metadata.model.model || 'unknown';
                        }
                    }
                } catch {
                    // Ignore parse errors
                }

                // Only check for checkpoints if the task is not running
                if (!['running', 'planning', 'waiting_for_approval'].includes(task.status)) {
                    const checkpoint = await this.agentPersistenceService.getLatestCheckpoint(task.id);
                    if (checkpoint) {
                        // We need the checkpoint ID, but getLatestCheckpoint returns AgentTaskState which doesn't have the checkpoint ID directly
                        // We need to fetch checkpoints list to get the ID
                        const checkpoints = await this.agentPersistenceService.getCheckpoints(task.id);
                        if (checkpoints.length > 0) {
                            latestCheckpointId = checkpoints[checkpoints.length - 1].id;
                        }
                    }
                }

                history.push({
                    id: task.id,
                    description: task.description,
                    provider,
                    model,
                    status: task.status as import('@shared/types/project-agent').AgentTaskHistoryItem['status'],
                    createdAt: task.created_at,
                    updatedAt: task.updated_at,
                    latestCheckpointId
                });
            }

            return history;
        } catch (error) {
            this.logError('Failed to get task history', error as Error);
            return [];
        }
    }

    async getStatus(): Promise<ProjectState> {
        return this.state;
    }

    async start(options: AgentStartOptions): Promise<void> {
        if (this.startRequestInFlight) {
            this.logWarn('Ignoring duplicate start request while a start operation is in-flight');
            return;
        }

        if (
            this.state.status === 'running' &&
            this.state.currentTask === String(options.task) &&
            this.state.nodeId === options.nodeId
        ) {
            this.logWarn('Ignoring duplicate start request for the same running task');
            return;
        }

        // If a different node is requesting start while we have a stuck task from another node,
        // reset the old task and allow the new one to proceed
        if (!this.stateMachine.can('running') && options.nodeId && this.state.nodeId !== options.nodeId) {
            this.logWarn(`Clearing stale task from node ${this.state.nodeId} to allow new start from node ${options.nodeId}`);
            await this.resetState();
        }

        if (!this.stateMachine.can('running')) {
            this.logWarn(`Ignoring start request from current state: ${this.state.status}`);
            return;
        }

        this.startRequestInFlight = true;
        try {
            const { task, projectId, attachments, agentProfileId } = options;
            const profile = this.agentRegistryService.getProfile(agentProfileId);
            const systemPrompt = profile.systemPrompt;

            await this.stateMachine.transitionTo('running');
            this.shouldStop = false;
            this.abortController = new AbortController();

            // create task in DB with nodeId and model config for resumption
            const taskMetadata = {
                model: options.model,
                agentProfileId: agentProfileId,
                systemMode: options.systemMode
            };
            this.currentTaskId = await this.databaseService.uac.createTask(
                projectId ?? 'unknown',
                String(task),
                'running',
                options.nodeId,
                taskMetadata
            );

            this.state = {
                status: 'running',
                currentTask: String(task),
                nodeId: options.nodeId,
                plan: [],
                history: [
                    { id: randomUUID(), role: 'system', content: systemPrompt, timestamp: new Date() } as Message,
                    {
                        id: randomUUID(),
                        role: 'user',
                        content: `Task: ${String(task)} \n\nProject Context: ${projectId ?? 'None'} \nAttachments: ${attachments?.map(a => a.name).join(', ') ?? 'None'} `,
                        timestamp: new Date()
                    } as Message
                ],
                config: options
            };
            // Log initial messages
            // for (const msg of this.state.history) {
            //     await this.databaseService.uac.addLog(this.currentTaskId, msg.role, msg.content);
            // }

            this.emitUpdate();

            // Start loop in background
            void this.executionLoop();
        } finally {
            this.startRequestInFlight = false;
        }
    }

    async generatePlan(options: AgentStartOptions): Promise<void> {
        if (this.planRequestInFlight) {
            this.logWarn('Ignoring duplicate generatePlan request while initialization is in-flight');
            return;
        }

        if (
            this.state.status === 'planning' &&
            this.state.currentTask === String(options.task) &&
            this.state.nodeId === options.nodeId
        ) {
            this.logWarn('Ignoring duplicate generatePlan request while planning is already in progress');
            return;
        }

        if (this.state.status === 'planning') {
            this.logWarn('Ignoring generatePlan request because another planning session is already active');
            return;
        }

        // If we can't transition to planning, check if we should reset stale state
        if (!this.stateMachine.can('planning')) {
            // Case 1: Different node requesting - clear old task
            if (options.nodeId && this.state.nodeId !== options.nodeId) {
                this.logWarn(`Clearing stale task from node ${this.state.nodeId} to allow new planning from node ${options.nodeId}`);
                await this.resetState();
            }
            // Case 2: Same node requesting new plan while in waiting_for_approval (user wants to regenerate)
            else if (this.state.status === 'waiting_for_approval' && this.state.nodeId === options.nodeId) {
                this.logInfo(`Same node requesting new plan while waiting_for_approval - resetting to allow regeneration`);
                await this.resetState();
            }
        }

        if (!this.stateMachine.can('planning')) {
            this.logWarn(`Ignoring generatePlan request from current state: ${this.state.status}`);
            return;
        }

        this.planRequestInFlight = true;
        try {
            const { task, projectId, agentProfileId } = options;
            const profile = this.agentRegistryService.getProfile(agentProfileId);
            const systemPrompt = profile.systemPrompt;

            await this.stateMachine.transitionTo('planning');
            this.shouldStop = false;
            this.abortController = new AbortController();

            // create task in DB with nodeId and model config for resumption
            const taskMetadata = {
                model: options.model,
                agentProfileId: agentProfileId,
                systemMode: options.systemMode
            };
            this.currentTaskId = await this.databaseService.uac.createTask(
                projectId ?? 'unknown',
                String(task),
                'planning',
                options.nodeId,
                taskMetadata
            );

            this.state = {
                status: 'planning',
                currentTask: String(task),
                nodeId: options.nodeId,
                plan: [],
                history: [
                    { id: randomUUID(), role: 'system', content: systemPrompt, timestamp: new Date() } as Message,
                    {
                        id: randomUUID(),
                        role: 'user',
                        content: `Task: ${String(task)}

Project Context: ${projectId ?? 'None'}

INSTRUCTIONS:
1. Analyze this task briefly
2. Call the \`propose_plan\` tool with your implementation steps

FALLBACK (if tool calling is not available):
Return a JSON object: { "steps": ["step 1", "step 2", ...] }`,
                        timestamp: new Date()
                    } as Message
                ],
                config: options
            };

            // Log initial messages
            // for (const msg of this.state.history) {
            //     await this.databaseService.uac.addLog(this.currentTaskId, msg.role, msg.content);
            // }

            this.emitUpdate();

            void this.planningLoop();
        } finally {
            this.planRequestInFlight = false;
        }
    }

    async approvePlan(plan: ProjectStep[] | string[]): Promise<void> {
        if (!this.stateMachine.can('running')) {
            if (this.state.status === 'running') {
                this.logWarn('Ignoring duplicate approvePlan request while execution is already running');
            } else {
                this.logWarn(`Ignoring approvePlan request in current state: ${this.state.status}`);
            }
            return;
        }

        this.state.plan = this.normalizePlan(plan);

        await this.stateMachine.transitionTo('running');
        this.state.status = 'running';
        this.shouldStop = false;

        // Add plan to history so agent knows what to do
        const planText = this.state.plan.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
        const approvalMsg = {
            id: randomUUID(),
            role: 'user',
            content: `Plan approved:\n${planText}\n\nPlease proceed with execution following this plan.`,
            timestamp: new Date()
        } as Message;
        this.pushToHistory(approvalMsg);

        if (this.currentTaskId) {
            // Update DB
            await this.syncTaskSteps(this.currentTaskId, this.state.plan);
            await this.databaseService.uac.updateTaskStatus(this.currentTaskId, 'running');
            await this.databaseService.uac.addLog(this.currentTaskId, approvalMsg.role, String(approvalMsg.content));
        }

        this.emitUpdate();

        void this.executionLoop();
    }

    async stop(): Promise<void> {
        this.shouldStop = true;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        await this.stateMachine.transitionTo('idle');
        this.state.status = 'idle';
        if (this.currentTaskId) {
            await this.databaseService.uac.updateTaskStatus(this.currentTaskId, 'idle'); // or aborted
        }
        this.emitUpdate();
    }

    /**
     * Force reset state to idle, clearing any stuck tasks
     * Use this when the agent is stuck in an invalid state
     */
    async resetState(): Promise<void> {
        this.logInfo('Force resetting agent state to idle');
        this.shouldStop = true;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }

        // Reset current task in DB if exists
        if (this.currentTaskId) {
            await this.databaseService.uac.updateTaskStatus(this.currentTaskId, 'idle');
            this.currentTaskId = null;
        }

        // Force state machine to idle
        this.stateMachine.setState('idle');

        // Reset state completely
        this.state = {
            status: 'idle',
            currentTask: '',
            plan: [],
            history: [],
            totalTokens: { prompt: 0, completion: 0 }
        };

        this.emitUpdate();
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
            timestamp: new Date()
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

    private getModelConfig() {
        const model = this.state.config?.model;

        // If no model configured, log warning and use a safe fallback
        if (!model?.model || !model?.provider) {
            this.logWarn(`No model configured in task state. Config: ${JSON.stringify(this.state.config)}`);
            // Use claude-3-5-sonnet as safe fallback (widely available)
            return {
                modelId: 'claude-3-5-sonnet-20241022',
                providerId: 'anthropic',
                systemMode: this.state.config?.systemMode
            };
        }

        return {
            modelId: model.model,
            providerId: model.provider,
            systemMode: this.state.config?.systemMode
        };
    }

    private async executeToolCalls(toolCalls: ToolCall[]) {
        if (!this.toolExecutor) {
            return;
        }

        for (const toolCall of toolCalls) {
            const result = await this.toolExecutor.execute(toolCall.function.name, safeJsonParse(toolCall.function.arguments, {}));
            const msg = {
                id: randomUUID(),
                role: 'tool',
                content: JSON.stringify(result),
                toolCallId: toolCall.id,
                timestamp: new Date()
            } as Message;
            this.pushToHistory(msg);

            if (this.currentTaskId) {
                await this.databaseService.uac.addLog(
                    this.currentTaskId,
                    msg.role,
                    String(msg.content),
                    undefined,
                    toolCall.id
                );
            }
        }
    }

    private createAssistantMessage(): Message & { reasoning?: string } {
        return {
            id: randomUUID(),
            role: 'assistant',
            content: '',
            reasoning: '',
            timestamp: new Date()
        } as Message & { reasoning?: string };
    }

    private async logPlanningToDB(msg: Message & { reasoning?: string }) {
        if (!this.currentTaskId) {
            return;
        }
        try {
            const logContent = this.getLogContent(msg.content);
            await this.databaseService.uac.addLog(
                this.currentTaskId,
                msg.role,
                logContent,
                undefined,
                msg.toolCalls?.map(tc => tc.id).join(',')
            );
        } catch (error) {
            this.logWarn(`Failed to add planning log to DB: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handlePlanningToolCalls(toolCalls: ToolCall[]) {
        this.logInfo(`Planning step generated ${toolCalls.length} tool calls: ${JSON.stringify(toolCalls)}`);
        await this.executeToolCalls(toolCalls);
        if (this.shouldStop) {
            this.logInfo('Planning step stopped execution (likely due to propose_plan)');
            return true;
        }
        return false;
    }

    /**
     * Convert a step item to string (handles string, object with text, or other)
     */
    private stepToString(step: unknown): string {
        if (typeof step === 'string') {
            return step;
        }
        if (typeof step === 'object' && step !== null && 'text' in step) {
            return String((step as { text: string }).text);
        }
        return String(step);
    }

    /**
     * Convert array of unknown items to string steps
     */
    private arrayToSteps(arr: unknown[]): string[] | null {
        if (arr.length === 0) {
            return null;
        }
        const steps = arr.map(s => this.stepToString(s)).filter(s => s.length > 0);
        return steps.length > 0 ? steps : null;
    }

    /**
     * Extract steps array from parsed JSON (object or array)
     */
    private extractStepsFromParsed(parsed: unknown): string[] | null {
        // Handle direct array [...]
        if (Array.isArray(parsed)) {
            return this.arrayToSteps(parsed);
        }

        // Handle { "steps": [...] } or { "plan": [...] }
        if (typeof parsed !== 'object' || parsed === null) {
            return null;
        }

        const obj = parsed as Record<string, unknown>;
        const stepsArray = obj['steps'] ?? obj['plan'];

        if (!Array.isArray(stepsArray)) {
            return null;
        }

        return this.arrayToSteps(stepsArray);
    }

    /**
     * Try to extract a plan from JSON format in content
     * Supports: { "steps": [...] }, { "plan": [...] }, or just [...]
     */
    private tryParseJsonPlan(content: string): string[] | null {
        // Try to extract JSON from markdown code blocks first
        const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonContent = jsonBlockMatch ? jsonBlockMatch[1].trim() : content.trim();

        // Patterns to find JSON object/array anywhere in the content
        const jsonPatterns = [
            /\{[\s\S]*"steps"\s*:\s*\[[\s\S]*\][\s\S]*\}/,  // { "steps": [...] }
            /\{[\s\S]*"plan"\s*:\s*\[[\s\S]*\][\s\S]*\}/,   // { "plan": [...] }
            /\[[\s\S]*\]/                                     // [...]
        ];

        for (const pattern of jsonPatterns) {
            const match = jsonContent.match(pattern) ?? content.match(pattern);
            if (!match) {
                continue;
            }

            try {
                const parsed = JSON.parse(match[0]) as unknown;
                const steps = this.extractStepsFromParsed(parsed);
                if (steps) {
                    this.logInfo(`Parsed JSON plan with ${steps.length} steps`);
                    return steps;
                }
            } catch {
                // JSON parse failed, continue to next pattern
            }
        }

        return null;
    }

    private async autoProposeTextPlan(content: string): Promise<boolean> {
        // First, try to parse as JSON (highest priority for structured data)
        const jsonSteps = this.tryParseJsonPlan(content);
        if (jsonSteps && jsonSteps.length > 0) {
            this.logInfo(`Detected JSON-based plan with ${jsonSteps.length} steps. Auto-proposing.`);
            this.eventBus.emit('project:plan-proposed', { steps: jsonSteps });
            this.shouldStop = true;
            return true;
        }

        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // Pattern matchers for various list formats
        const listPatterns = [
            /^\d+\.\s+/,           // 1. Step
            /^-\s+/,               // - Step
            /^\*\s+/,              // * Step
            /^•\s*/,               // • Step
            /^✓\s*/,               // ✓ Step
            /^Step\s*\d*[:.]\s*/i, // Step 1: or Step:
            /^Adım\s*\d*[:.]\s*/i  // Adım 1: or Adım:
        ];

        const cleanPattern = /^\d+\.\s+|^-\s+|^\*\s+|^•\s*|^✓\s*|^Step\s*\d*[:.]\s*|^Adım\s*\d*[:.]\s*/i;

        const steps = lines
            .filter(l => listPatterns.some(p => p.test(l)))
            .map(l => l.replace(cleanPattern, '').trim())
            .filter(l => l.length > 0);

        this.logDebug(`autoProposeTextPlan: ${lines.length} lines, ${steps.length} pattern-matched steps`);

        // Accept if we found at least 1 structured step
        if (steps.length >= 1) {
            this.logInfo(`Detected text-based plan with ${steps.length} steps. Auto-proposing.`);
            this.eventBus.emit('project:plan-proposed', { steps });
            this.shouldStop = true;
            return true;
        }

        // Fallback: If content has meaningful text but no patterns, wrap as single step
        const cleanContent = content.trim();
        if (cleanContent.length >= 20 && cleanContent.length <= 2000) {
            this.logInfo('No structured plan detected, wrapping content as single step.');
            this.eventBus.emit('project:plan-proposed', { steps: [cleanContent] });
            this.shouldStop = true;
            return true;
        }

        return false;
    }

    private async executePlanningStep(
        toolDefs: ToolDefinition[],
        modelId: string,
        providerId: string
    ): Promise<boolean> {
        const { systemMode } = this.getModelConfig();
        const msg = this.createAssistantMessage();
        this.pushToHistory(msg);

        await this.processMessageStream(msg, this.llmService.chatStream(
            this.state.history.slice(0, -1),
            modelId,
            toolDefs,
            providerId,
            { systemMode, signal: this.abortController?.signal }
        ));

        return this.handlePlanningResponse(msg);
    }

    private async handlePlanningResponse(msg: Message & { reasoning?: string }): Promise<boolean> {
        await this.logPlanningToDB(msg);

        if (msg.toolCalls?.length) {
            if (await this.handlePlanningToolCalls(msg.toolCalls)) {
                return true;
            }
        }

        const msgContent = this.getLogContent(msg.content);
        this.logInfo(`Planning step finished. Content len: ${msgContent.length}, Reasoning len: ${msg.reasoning?.length ?? 0}, ToolCalls: ${msg.toolCalls?.length ?? 0}`);

        if (msg.reasoning?.length) {
            this.logInfo('Reasoning detected, continuing loop...');
            return false;
        }

        return this.finalizePlanningStep(msg, msgContent);
    }

    private async finalizePlanningStep(msg: Message & { reasoning?: string }, msgContent: string): Promise<boolean> {
        if (msgContent.length > 0 && (!msg.toolCalls || msg.toolCalls.length === 0)) {
            if (await this.autoProposeTextPlan(msgContent)) {
                return true;
            }

            this.logInfo('Model output text but no tool calls. Injecting directive to use propose_plan.');
            this.pushToHistory({
                id: randomUUID(),
                role: 'user',
                content: "You provided a text response. Please strictly use the `propose_plan` tool to submit the plan. Do not just write it in the chat.",
                timestamp: new Date()
            } as Message);
            this.emitUpdate();
            return false;
        }

        return !msg.toolCalls?.length && !msg.content && !msg.reasoning;
    }


    private async planningLoop() {
        try {
            if (!this.toolExecutor) {
                throw new Error('ToolExecutor not initialized');
            }

            // Safe tools for planning - Read Only + Propose
            const PLANNING_TOOLS = [
                'read_file', 'list_directory', 'file_exists', 'get_file_info',
                'search_web', 'fetch_webpage', 'fetch_json', 'get_system_info',
                'propose_plan', 'recall', 'remember', 'forget'
            ];

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

            // Store error message for UI display
            this.state.lastError = `Planning failed: ${errorMsg}`;

            await this.stateMachine.transitionTo('failed');
            this.state.status = 'failed';
            this.emitUpdate();
        }
    }

    private async processMessageStream(
        msg: Message & { reasoning?: string },
        stream: AsyncGenerator<{ content?: string; reasoning?: string; tool_calls?: ToolCall[]; usage?: { prompt_tokens: number; completion_tokens: number } }>
    ) {
        for await (const chunk of stream) {
            if (chunk.content) {
                msg.content += chunk.content;
            }
            if (chunk.reasoning) {
                msg.reasoning ??= '';
                msg.reasoning += chunk.reasoning;
            }
            if (chunk.tool_calls) {
                this.mergeToolCalls(msg, chunk.tool_calls);
            }
            // Track token usage from stream
            if (chunk.usage) {
                this.currentStepTokens.prompt += chunk.usage.prompt_tokens;
                this.currentStepTokens.completion += chunk.usage.completion_tokens;
                // Update total tokens
                this.state.totalTokens = this.state.totalTokens ?? { prompt: 0, completion: 0 };
                this.state.totalTokens.prompt += chunk.usage.prompt_tokens;
                this.state.totalTokens.completion += chunk.usage.completion_tokens;
            }
            this.emitUpdate();
        }
    }

    private mergeToolCalls(msg: Message, newCalls: ToolCall[]) {
        msg.toolCalls ??= [];
        for (const tc of newCalls) {
            const existing = msg.toolCalls.find(e => {
                const tcId = tc.id;
                const tcIdx = tc.index;
                const eId = e.id;
                const eIdx = e.index;
                return (tcId && eId && tcId === eId) ||
                    (tcIdx !== undefined && eIdx !== undefined && tcIdx === eIdx);
            });

            if (existing) {
                existing.function.arguments += tc.function.arguments;
            } else {
                msg.toolCalls.push(tc);
            }
        }
    }

    private getLogContent(content: string | Array<{ type: string; text?: string }>): string {
        if (typeof content === 'string') {
            return content;
        }
        return content
            .filter(c => c.type === 'text')
            .map(c => c.text ?? '')
            .join(' ');
    }

    private checkTaskCompletion(content: string): boolean {
        return content.toLowerCase().includes('task completed') ||
            content.toLowerCase().includes('görev tamamlandı');
    }

    private async completeTask() {
        this.logInfo('Task completed by agent');
        this.state.plan.forEach(s => {
            if (s.status !== 'completed') {
                s.status = 'completed';
            }
        });

        this.shouldStop = true;
        await this.stateMachine.transitionTo('completed');
        this.state.status = 'completed';

        if (this.currentTaskId) {
            await this.databaseService.uac.updateTaskStatus(this.currentTaskId, 'completed');
        }
    }

    private async executeStreamingStep(toolDefs: ToolDefinition[], currentHistory: Message[]) {
        const { modelId, providerId } = this.getModelConfig();
        const msg = this.createAssistantMessage();

        this.pushToHistory(msg);

        await this.processMessageStream(msg, this.llmService.chatStream(
            currentHistory,
            modelId,
            toolDefs,
            providerId,
            { signal: this.abortController?.signal }
        ));

        await this.finalizeStep(msg);
        return msg;
    }

    private async finalizeStep(msg: Message & { reasoning?: string }) {
        if (this.currentTaskId) {
            try {
                const logContent = this.getLogContent(msg.content);
                await this.databaseService.uac.addLog(this.currentTaskId, msg.role, logContent);
            } catch (error) {
                this.logWarn(`Failed to add execution log to DB: ${error instanceof Error ? error.message : String(error)}`);
            }
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

    private async executionLoop() {
        this.logInfo('Starting execution loop');

        while (!this.shouldStop) {
            try {
                if (!this.toolExecutor) {
                    throw new Error('ToolExecutor not initialized');
                }

                this.updateStepProgress();

                const toolDefs = await this.toolExecutor.getToolDefinitions();
                const planContext = `Current Plan Checklist:\n${this.state.plan.map((s, i) => `${i}. [${s.status === 'completed' ? 'x' : s.status === 'running' ? '/' : ' '}] ${s.text}`).join('\n')}\n\nUse \`update_plan_step\` to update your progress. Always verify your work before completing a step.`;

                const currentHistory = [
                    ...this.state.history,
                    { id: randomUUID(), role: 'system', content: planContext, timestamp: new Date() } as Message
                ];

                const msg = await this.executeStreamingStep(toolDefs, currentHistory);

                this.emitUpdate();

                if ((!msg.toolCalls || msg.toolCalls.length === 0) && !msg.content) {
                    break;
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                this.logError('Execution loop error', error as Error);

                // Store error message for UI display
                this.state.lastError = `Execution failed: ${errorMsg}`;

                await this.stateMachine.transitionTo('failed');
                this.state.status = 'failed';
                this.emitUpdate();
                break;
            }
        }
    }

    private updateStepProgress() {
        // Fallback progress logic based on message count if agent forgets to use update_plan_step
    }

    /**
     * Mark a step as started and reset token counter
     */
    private startStep(stepIndex: number): void {
        const step = this.state.plan[stepIndex];
        if (!step) {
            return;
        }
        step.status = 'running';
        step.timing = {
            startedAt: Date.now()
        };
        // Reset step token counter
        this.currentStepTokens = { prompt: 0, completion: 0 };
    }

    /**
     * Mark a step as completed and record tokens/timing
     */
    private completeStep(stepIndex: number, status: 'completed' | 'failed' = 'completed'): void {
        const step = this.state.plan[stepIndex];
        if (!step) {
            return;
        }
        step.status = status;
        // Record timing
        const completedAt = Date.now();
        step.timing = {
            ...step.timing,
            completedAt,
            durationMs: step.timing?.startedAt ? completedAt - step.timing.startedAt : undefined
        };
        // Record accumulated tokens
        step.tokens = { ...this.currentStepTokens };
        this.logInfo(`Step ${stepIndex} ${status}: ${this.currentStepTokens.prompt} prompt + ${this.currentStepTokens.completion} completion tokens`);

        // Auto-save checkpoint
        void (async () => {
            try {
                if (this.currentTaskId) {
                    const taskState = this.mapToAgentTaskState();
                    await this.agentPersistenceService.saveCheckpoint(this.currentTaskId, stepIndex, taskState);
                }
            } catch (error) {
                this.logWarn(`Failed to auto-save checkpoint: ${error}`);
            }
        })();
    }

    private mapToAgentTaskState(): AgentTaskState {
        if (!this.currentTaskId) {
            throw new Error('No current task ID');
        }

        const baseState = createInitialAgentState(this.currentTaskId, this.state.config?.projectId || '');

        // Map ProjectState to AgentTaskState
        baseState.state = this.mapProjectStatusToAgentState(this.state.status);

        baseState.description = this.state.config?.task || '';
        baseState.currentStep = this.state.plan.findIndex(s => s.status === 'running') !== -1
            ? this.state.plan.findIndex(s => s.status === 'running')
            : this.state.plan.length; // or last completed

        // If we are planning, step is 0
        if (baseState.state === 'planning') {
            baseState.currentStep = 0;
        }

        // Map plan
        if (this.state.plan.length > 0) {
            baseState.plan = {
                steps: this.state.plan.map((s, i) => ({
                    index: i,
                    description: s.text,
                    type: 'code_generation', // default
                    status: this.mapProjectStepStatusToPlanStepStatus(s.status),
                    toolsUsed: [],
                })),
                requiredTools: [],
                dependencies: []
            };
            baseState.totalSteps = this.state.plan.length;
        }

        // Map history (recent)
        baseState.messageHistory = this.state.history;

        return baseState;
    }

    private mapProjectStatusToAgentState(status: ProjectState['status']): AgentTaskState['state'] {
        switch (status) {
            case 'waiting_for_approval': return 'planning'; // closest match
            case 'running': return 'executing';
            case 'idle': return 'idle';
            case 'completed': return 'completed';
            case 'failed': return 'failed';
            case 'paused': return 'paused';
            default: return 'idle';
        }
    }

    private mapProjectStepStatusToPlanStepStatus(status: ProjectStep['status']): 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' {
        switch (status) {
            case 'running': return 'in_progress';
            case 'pending': return 'pending';
            case 'completed': return 'completed';
            case 'failed': return 'failed';
            default: return 'pending';
        }
    }

    private normalizePlan(plan: ProjectStep[] | string[]): ProjectStep[] {
        if (plan.length === 0) {
            return [];
        }

        if (typeof plan[0] === 'string') {
            return (plan as string[]).map(text => ({
                id: randomUUID(),
                text,
                status: 'pending'
            }));
        }

        return (plan as ProjectStep[]).map(step => ({
            id: step.id,
            text: step.text,
            status: step.status
        }));
    }

    private async syncTaskSteps(taskId: string, steps: ProjectStep[]): Promise<void> {
        const existingSteps = await this.databaseService.uac.getSteps(taskId);

        if (existingSteps.length === 0) {
            await this.databaseService.uac.createSteps(taskId, steps);
            return;
        }

        const sameDefinition = existingSteps.length === steps.length &&
            existingSteps.every((existing, index) => {
                const current = steps[index];
                return existing.id === current.id && existing.text === current.text;
            });

        if (!sameDefinition) {
            await this.databaseService.uac.deleteStepsByTask(taskId);
            await this.databaseService.uac.createSteps(taskId, steps);
            return;
        }

        for (let i = 0; i < steps.length; i++) {
            const current = steps[i];
            const existing = existingSteps[i];
            if (existing.status !== current.status) {
                await this.databaseService.uac.updateStepStatus(current.id, current.status);
            }
        }
    }


    private mapFromAgentTaskState(taskState: AgentTaskState): ProjectState {
        // Map Plan
        const plan: ProjectStep[] = taskState.plan?.steps.map(s => ({
            id: randomUUID(), // Generate new IDs as they are not preserved in AgentTaskState
            text: s.description,
            status: s.status === 'in_progress' ? 'running' : (s.status === 'skipped' ? 'pending' : s.status) as ProjectStep['status']
        })) ?? [];

        // Map Status
        let status: ProjectState['status'] = 'idle';
        if (taskState.state === 'executing') {
            status = 'running';
        } else if (taskState.state === 'planning') {
            status = 'planning';
        } else if (taskState.state === 'completed') {
            status = 'completed';
        } else if (taskState.state === 'failed') {
            status = 'failed';
        } else if (taskState.state === 'paused') {
            status = 'paused';
        } else {
            status = 'idle';
        }

        return {
            status,
            currentTask: taskState.description,
            plan,
            history: taskState.messageHistory,
            totalTokens: { prompt: 0, completion: 0 }, // Metrics might be lost or need mapping
            config: {
                task: taskState.description,
                projectId: taskState.projectId,
                agentProfileId: 'default', // Defaulting as it's not in AgentTaskState
                model: undefined, // Defaulting
            }
        };
    }

    async resumeFromCheckpoint(checkpointId: string): Promise<void> {
        this.logInfo(`Resuming from checkpoint ${checkpointId}`);
        const checkpoint = await this.agentPersistenceService.loadCheckpoint(checkpointId);

        if (!checkpoint) {
            throw new Error(`Checkpoint ${checkpointId} not found`);
        }

        this.currentTaskId = checkpoint.taskId;
        const newState = this.mapFromAgentTaskState(checkpoint);

        // Restore config if possible from current state or DB (best effort)
        if (this.state.config && this.state.config.projectId === newState.config!.projectId) {
            newState.config = { ...this.state.config, ...newState.config };
        }

        this.state = newState;

        // Sync with UAC Database
        if (this.currentTaskId) {
            await this.databaseService.uac.updateTaskStatus(this.currentTaskId, this.state.status);
            // Re-create steps to ensure IDs match
            await this.databaseService.uac.deleteStepsByTask(this.currentTaskId);
            await this.databaseService.uac.createSteps(this.currentTaskId, this.state.plan);
            // Note: Logs are not fully synced back to UAC logs table to avoid duplication/complexity, 
            // but in-memory history is restored.
        }

        // Restart State Machine and Execution
        this.stateMachine.setState(this.state.status);

        if (this.state.status === 'running') {
            this.shouldStop = false;
            this.abortController = new AbortController();
            void this.executionLoop();
        } else if (this.state.status === 'planning') {
            this.shouldStop = false;
            this.abortController = new AbortController();
            void this.planningLoop();
        }

        this.emitUpdate();
    }

    private async recoverInterruptedPlanningTask(taskId: string): Promise<void> {
        if (this.state.plan.length > 0) {
            this.logWarn('Recovered planning task with existing steps; transitioning to waiting_for_approval');
            this.state.status = 'waiting_for_approval';
            this.state.lastError = 'Planning was interrupted. Review the proposed plan and continue.';
            this.stateMachine.setState('waiting_for_approval');
            await this.databaseService.uac.updateTaskStatus(taskId, 'waiting_for_approval');
            return;
        }

        this.logWarn('Recovered planning task without plan steps; marking task as failed');
        this.state.status = 'failed';
        this.state.lastError = 'Planning was interrupted unexpectedly. Please generate a new plan.';
        this.stateMachine.setState('failed');
        await this.databaseService.uac.updateTaskStatus(taskId, 'failed');
    }

    private async saveState() {
        if (!this.currentTaskId) {
            return;
        }
        try {
            const stepIndex = this.state.plan.findIndex(s => s.status === 'running');
            const indexToSave = stepIndex >= 0 ? stepIndex : this.state.plan.length;
            const taskState = this.mapToAgentTaskState();
            await this.agentPersistenceService.saveCheckpoint(this.currentTaskId, indexToSave, taskState);
        } catch (error) {
            this.logWarn(`Failed to save checkpoint: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async resumeFromCheckpoint(checkpointId: string): Promise<void> {
        this.logInfo(`Resuming from checkpoint ${checkpointId}`);
        const checkpointState = await this.agentPersistenceService.loadCheckpoint(checkpointId);

        if (!checkpointState) {
            throw new Error(`Checkpoint ${checkpointId} not found`);
        }

        this.currentTaskId = checkpointState.taskId;

        // Map AgentTaskState -> ProjectState
        this.restoreStateFromCheckpoint(checkpointState);
    }

    private mapToAgentTaskState(): AgentTaskState {
        const { currentTask, plan, history, config, metrics, status } = this.state;
        const now = new Date();

        // Map plan steps
        const executionPlan: ExecutionPlan = {
            steps: plan.map((p, i) => ({
                index: i,
                description: p.text,
                type: 'code_generation', // Default
                status: p.status === 'pending' ? 'pending' :
                    p.status === 'running' ? 'in_progress' :
                        p.status === 'completed' ? 'completed' :
                            p.status === 'failed' ? 'failed' : 'skipped',
                toolsUsed: []
            })),
            requiredTools: [],
            dependencies: []
        };

        const providerConfig: ProviderConfig = {
            provider: config?.model?.provider ?? 'openai',
            model: config?.model?.model ?? 'gpt-4',
            accountIndex: 0,
            status: 'active'
        };

        const context: AgentContext = {
            projectPath: config?.projectId ?? '',
            projectName: '',
            workspace: { rootPath: config?.projectId ?? '', hasGit: false, hasDependencies: false },
            constraints: { maxIterations: 50, maxDuration: 3600000, maxToolCalls: 100, allowedTools: [] }
        };

        return {
            taskId: this.currentTaskId ?? randomUUID(),
            projectId: config?.projectId ?? 'unknown',
            description: currentTask,
            state: status === 'waiting_for_approval' ? 'planning' : // Map waiting to planning or closest equivalent
                status === 'error' ? 'failed' :
                    status as AgentTaskState['state'],
            currentStep: plan.findIndex(s => s.status === 'running'),
            totalSteps: plan.length,
            plan: executionPlan,
            context,
            messageHistory: history,
            eventHistory: [],
            currentProvider: providerConfig,
            providerHistory: [],
            errors: [],
            recoveryAttempts: 0,
            createdAt: now, // Should be preserved from original creation
            updatedAt: now,
            startedAt: this.state.timing?.startedAt ? new Date(this.state.timing.startedAt) : null,
            completedAt: this.state.timing?.completedAt ? new Date(this.state.timing.completedAt) : null,
            metrics: {
                duration: 0,
                llmCalls: 0,
                toolCalls: 0,
                tokensUsed: this.state.totalTokens?.completion ?? 0 + (this.state.totalTokens?.prompt ?? 0),
                providersUsed: [],
                errorCount: 0,
                recoveryCount: 0
            },
            result: null
        };
    }

    private restoreStateFromCheckpoint(checkpoint: AgentTaskState) {
        // Map AgentTaskState -> ProjectState
        const plan: ProjectStep[] = checkpoint.plan?.steps.map(s => ({
            id: randomUUID(), // ID might be lost if not in AgentTaskState explicit plan
            text: s.description,
            status: s.status === 'in_progress' ? 'running' :
                s.status === 'skipped' ? 'pending' :
                    s.status as ProjectStep['status']
        })) ?? [];

        // Restore config from context/provider
        const config: AgentStartOptions = {
            task: checkpoint.description,
            projectId: checkpoint.projectId,
            model: {
                provider: checkpoint.currentProvider.provider,
                model: checkpoint.currentProvider.model
            },
            // Try to recover other options if stored in metadata/context
            agentProfileId: 'default' // Defaulting as specific ID might be lost
        };

        this.state = {
            status: checkpoint.state === 'executing' ? 'running' :
                checkpoint.state as ProjectState['status'],
            currentTask: checkpoint.description,
            plan,
            history: checkpoint.messageHistory,
            config,
            totalTokens: {
                prompt: 0,
                completion: checkpoint.metrics.tokensUsed
            }
        };

        // Sync with UAC Database
        if (this.currentTaskId) {
            void this.databaseService.uac.updateTaskStatus(this.currentTaskId, this.state.status);
        }

        // Restart State Machine and Execution
        this.stateMachine.setState(this.state.status);

        if (this.state.status === 'running') {
            this.shouldStop = false;
            this.abortController = new AbortController();
            void this.executionLoop();
        }

        this.emitUpdate();
    }

    /**
     * Load any active task from DB on app restart to enable resumption
     */
    private async loadState(): Promise<void> {
        try {
            // Check if there's any active task across all projects
            const activeTask = await this.databaseService.uac.getAnyActiveTask();

            if (!activeTask) {
                this.logDebug('No active task found to resume');
                return;
            }

            this.logInfo(`Found active task to resume: ${activeTask.id} (${activeTask.status})`);

            // Load task details
            const steps = await this.databaseService.uac.getSteps(activeTask.id);
            const logs = await this.databaseService.uac.getLogs(activeTask.id);

            // CRITICAL: If task is in waiting_for_approval but has no plan steps,
            // it's a stale/corrupted state - reset to idle instead of blocking new operations
            if (activeTask.status === 'waiting_for_approval' && steps.length === 0) {
                this.logWarn(`Task ${activeTask.id} is in waiting_for_approval but has no plan. Resetting to idle.`);
                await this.databaseService.uac.updateTaskStatus(activeTask.id, 'idle');
                // Don't restore this task - let user start fresh
                return;
            }

            // Similarly, if task is in planning state without steps, mark as failed
            if (activeTask.status === 'planning' && steps.length === 0) {
                this.logWarn(`Task ${activeTask.id} is in planning state but interrupted without plan. Marking as failed.`);
                await this.databaseService.uac.updateTaskStatus(activeTask.id, 'failed');
                return;
            }

            this.currentTaskId = activeTask.id;

            // Parse metadata to restore model config
            const metadata = activeTask.metadata ? safeJsonParse<Record<string, unknown>>(activeTask.metadata, {}) : {};

            // Reconstruct state from DB including nodeId for UI binding
            this.state = {
                status: activeTask.status as ProjectState['status'],
                currentTask: activeTask.description,
                nodeId: activeTask.node_id ?? undefined,
                plan: steps.map(s => ({
                    id: s.id,
                    text: s.text,
                    status: s.status as ProjectStep['status']
                })),
                history: logs.map(l => ({
                    id: l.id,
                    role: l.role as Message['role'],
                    content: l.content,
                    timestamp: new Date(l.created_at),
                    toolCalls: l.tool_call_id ? [] : undefined
                })),
                config: {
                    task: activeTask.description,
                    projectId: activeTask.project_path,
                    agentProfileId: (metadata['agentProfileId'] as string) ?? 'default',
                    model: metadata['model'] as { provider: string; model: string } | undefined,
                    systemMode: metadata['systemMode'] as 'fast' | 'thinking' | 'architect' | undefined
                }
            };

            this.logInfo(`Restored config: model=${JSON.stringify(this.state.config?.model)}, agentProfileId=${this.state.config?.agentProfileId}`);

            // Sync state machine to current status
            this.stateMachine.setState(this.state.status);
            this.logInfo(`Restored state with status: ${this.state.status}`);

            if (this.state.status === 'planning') {
                await this.recoverInterruptedPlanningTask(activeTask.id);
            }

            if (this.state.status === 'running') {
                this.shouldStop = false;
                this.abortController = new AbortController();
                void this.executionLoop();
            }

            this.emitUpdate();
        } catch (error) {
            this.logError('Failed to load active task state', error as Error);
        }
    }

    async resume(projectId: string): Promise<ProjectState | null> {
        const activeTask = await this.databaseService.uac.getActiveTask(projectId);
        if (!activeTask) {
            return null;
        }

        this.currentTaskId = activeTask.id;
        const steps = await this.databaseService.uac.getSteps(activeTask.id);
        const logs = await this.databaseService.uac.getLogs(activeTask.id);

        // Parse metadata to restore model config
        const metadata = activeTask.metadata ? safeJsonParse<Record<string, unknown>>(activeTask.metadata, {}) : {};

        // Reconstruct state including nodeId for UI binding
        this.state = {
            status: activeTask.status as ProjectState['status'],
            currentTask: activeTask.description,
            nodeId: activeTask.node_id ?? undefined,
            plan: steps.map(s => ({
                id: s.id,
                text: s.text,
                status: s.status as ProjectStep['status']
            })),
            history: logs.map(l => ({
                id: l.id,
                role: l.role as Message['role'],
                content: l.content, // naive reconstruction
                timestamp: new Date(l.created_at),
                toolCalls: l.tool_call_id ? [] : undefined // TODO: reconstruct tool calls properly if needed
            })),
            config: {
                task: activeTask.description,
                projectId: projectId,
                agentProfileId: (metadata['agentProfileId'] as string) ?? 'default',
                model: metadata['model'] as { provider: string; model: string } | undefined,
                systemMode: metadata['systemMode'] as 'fast' | 'thinking' | 'architect' | undefined
            }
        };

        this.logInfo(`Resumed config: model=${JSON.stringify(this.state.config?.model)}, agentProfileId=${this.state.config?.agentProfileId}`);

        // Transition state machine
        try {
            // Force transition to current state
            // accessing private property for restoration or just set status
            // The state machine library might preventing jumping.
            // But we can re-initialize it or just set it:

            // Allow arbitrary transition for hydration
            this.stateMachine.setState(this.state.status);

            if (this.state.status === 'planning') {
                await this.recoverInterruptedPlanningTask(activeTask.id);
            }

            if (this.state.status === 'running') {
                this.shouldStop = false;
                this.abortController = new AbortController();
                void this.executionLoop();
            }

            this.emitUpdate();
            return this.state;
        } catch (e) {
            this.logError('Failed to resume state', e as Error);
            return null;
        }
    }

    async getProfiles() {
        return this.agentRegistryService.getAllProfiles();
    }

    async registerProfile(profile: AgentProfile) {
        return this.agentRegistryService.registerProfile(profile);
    }

    async deleteProfile(id: string) {
        return this.agentRegistryService.deleteProfile(id);
    }

    private emitUpdate() {
        this.eventBus.emit('project:update', this.state);
    }

    private pushToHistory(message: Message) {
        this.state.history.push(message);
        if (this.state.history.length > ProjectAgentService.MAX_HISTORY_SIZE) {
            this.state.history = this.state.history.slice(-ProjectAgentService.MAX_HISTORY_SIZE);
        }
    }
}
