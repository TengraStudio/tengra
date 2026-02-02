import { randomUUID } from 'crypto';

import { BaseService } from '@main/services/base.service';
import { AgentRegistryService } from '@main/services/project/agent/agent-registry.service';
import { DatabaseService } from '@main/services/data/database.service';
import { LLMService } from '@main/services/llm/llm.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { ToolDefinition } from '@main/tools/tool-definitions';
import { ToolExecutor } from '@main/tools/tool-executor';
import { StateMachine } from '@main/utils/state-machine.util';
import { Message, ToolCall } from '@shared/types/chat';
import { AgentStartOptions, ProjectState, ProjectStep } from '@shared/types/project-agent';
import { safeJsonParse } from '@shared/utils/sanitize.util';



export class ProjectAgentService extends BaseService {
    private state: ProjectState = {
        status: 'idle',
        currentTask: '',
        plan: [],
        history: []
    };
    private shouldStop: boolean = false;
    private toolExecutor?: ToolExecutor;

    private stateMachine: StateMachine<ProjectState['status'], string>;
    private currentTaskId: string | null = null;

    constructor(
        private databaseService: DatabaseService,
        private llmService: LLMService,
        public eventBus: EventBusService,
        private agentRegistryService: AgentRegistryService
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
                        const step = this.state.plan[index];
                        step.status = status;
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
                            await this.databaseService.uac.createSteps(this.currentTaskId, this.state.plan);
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

    async getStatus(): Promise<ProjectState> {
        return this.state;
    }

    async start(options: AgentStartOptions): Promise<void> {
        if (!this.stateMachine.can('running')) {
            throw new Error(`Cannot start agent from current state: ${this.state.status} `);
        }

        const { task, projectId, attachments, agentProfileId } = options;
        const profile = this.agentRegistryService.getProfile(agentProfileId);
        const systemPrompt = profile.systemPrompt;

        await this.stateMachine.transitionTo('running');
        this.shouldStop = false;

        // create task in DB
        this.currentTaskId = await this.databaseService.uac.createTask(
            projectId ?? 'unknown',
            String(task),
            'running'
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
    }

    async generatePlan(options: AgentStartOptions): Promise<void> {
        if (!this.stateMachine.can('planning')) {
            throw new Error(`Cannot start planning from current state: ${this.state.status} `);
        }

        const { task, projectId, agentProfileId } = options;
        const profile = this.agentRegistryService.getProfile(agentProfileId);
        const systemPrompt = profile.systemPrompt;

        await this.stateMachine.transitionTo('planning');
        this.shouldStop = false;

        // create task in DB
        this.currentTaskId = await this.databaseService.uac.createTask(
            projectId ?? 'unknown',
            String(task),
            'planning'
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
                    content: `Task: ${String(task)} \n\nProject Context: ${projectId ?? 'None'} \n\nLütfen bu görevi analiz edin ve bir uygulama planı hazırlayın. \n\nÖNEMLİ: Planı ASLA chat'e yazmayın. Doğrudan 'propose_plan' tool'unu çağırmanız gerekiyor. Planı chat'e yazmak yasaktır.`,
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
    }

    async approvePlan(plan: ProjectStep[] | string[]): Promise<void> {
        if (!this.stateMachine.can('running')) {
            throw new Error(`Cannot approve plan in current state: ${this.state.status}`);
        }

        if (plan.length > 0 && typeof plan[0] === 'string') {
            this.state.plan = (plan as string[]).map(text => ({
                id: randomUUID(),
                text,
                status: 'pending'
            }));
        } else {
            this.state.plan = plan as ProjectStep[];
        }

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
        this.state.history.push(approvalMsg);

        if (this.currentTaskId) {
            // Update DB
            await this.databaseService.uac.createSteps(this.currentTaskId, this.state.plan);
            await this.databaseService.uac.updateTaskStatus(this.currentTaskId, 'running');
            await this.databaseService.uac.addLog(this.currentTaskId, approvalMsg.role, String(approvalMsg.content));
        }

        this.emitUpdate();

        void this.executionLoop();
    }

    async stop(): Promise<void> {
        this.shouldStop = true;
        await this.stateMachine.transitionTo('idle');
        this.state.status = 'idle';
        if (this.currentTaskId) {
            await this.databaseService.uac.updateTaskStatus(this.currentTaskId, 'idle'); // or aborted
        }
        this.emitUpdate();
    }

    async retryStep(index: number): Promise<void> {
        if (!this.state.plan[index]) {
            throw new Error(`Invalid step index: ${index}`);
        }

        const step = this.state.plan[index];
        step.status = 'pending';
        this.logInfo(`Retrying step ${index}: ${step.text}`);

        this.state.history.push({
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
        return {
            modelId: this.state.config?.model?.model ?? 'gpt-4o',
            providerId: this.state.config?.model?.provider ?? 'openai',
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
            this.state.history.push(msg);

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

    private async autoProposeTextPlan(content: string): Promise<boolean> {
        const lines = content.split('\n');
        const steps = lines
            .map(l => l.trim())
            .filter(l => /^\d+\.\s+/.test(l) || /^-\s+/.test(l))
            .map(l => l.replace(/^\d+\.\s+|-\s+/, '').trim());

        if (steps.length >= 2) {
            this.logInfo(`Detected text-based plan with ${steps.length} steps. Auto-proposing.`);
            this.eventBus.emit('project:plan-proposed', { steps });
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
        this.state.history.push(msg);

        await this.processMessageStream(msg, this.llmService.chatStream(
            this.state.history.slice(0, -1),
            modelId,
            toolDefs,
            providerId,
            { systemMode }
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
            this.state.history.push({
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
            this.logError('Planning failed', error as Error);
            await this.stateMachine.transitionTo('failed');
            this.state.status = 'failed';
            this.emitUpdate();
        }
    }

    private async processMessageStream(
        msg: Message & { reasoning?: string },
        stream: AsyncGenerator<{ content?: string; reasoning?: string; tool_calls?: ToolCall[] }>
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

        this.state.history.push(msg);

        await this.processMessageStream(msg, this.llmService.chatStream(
            currentHistory,
            modelId,
            toolDefs,
            providerId
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
                this.logError('Execution loop error', error as Error);
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

    private async saveState() {
        // No-op - using DB now
    }

    private async loadState() {
        // TODO: Load active task from DB if exists?
    }

    private emitUpdate() {
        this.eventBus.emit('project:update', this.state);
    }
}
