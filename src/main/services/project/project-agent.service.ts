import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

import { BaseService } from '@main/services/base.service';
import { DataService } from '@main/services/data/data.service';
import { LLMService } from '@main/services/llm/llm.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { ToolExecutor } from '@main/tools/tool-executor';
import { Message, ToolCall } from '@shared/types/chat';
import { ProjectState } from '@shared/types/project-agent';
import { getErrorMessage } from '@shared/utils/error.util';
import { safeJsonParse } from '@shared/utils/sanitize.util';

import { PROJECT_AGENT_SYSTEM_PROMPT } from './project-agent.prompts';

const SYSTEM_PROMPT = PROJECT_AGENT_SYSTEM_PROMPT;

export class ProjectAgentService extends BaseService {
    private state: ProjectState = {
        status: 'idle',
        currentTask: '',
        plan: [],
        history: []
    };
    private statePath: string;
    private shouldStop: boolean = false;

    private toolExecutor?: ToolExecutor;

    constructor(
        private dataService: DataService,
        private llmService: LLMService,
        private eventBus: EventBusService
    ) {
        super('ProjectAgentService');
        this.statePath = path.join(this.dataService.getPath('data'), 'project-state.json');
    }

    setToolExecutor(toolExecutor: ToolExecutor) {
        this.toolExecutor = toolExecutor;
    }

    override async initialize(): Promise<void> {
        await this.loadState();
        this.logInfo('ProjectAgentService initialized');
    }

    async getStatus(): Promise<ProjectState> {
        return this.state;
    }

    async start(task: string): Promise<void> {
        if (this.state.status === 'running') {
            throw new Error('Agent is already running');
        }

        this.shouldStop = false;
        this.state = {
            status: 'running',
            currentTask: task,
            plan: [],
            history: [
                { id: randomUUID(), role: 'system', content: SYSTEM_PROMPT, timestamp: new Date() } as Message,
                { id: randomUUID(), role: 'user', content: `Task: ${task}`, timestamp: new Date() } as Message
            ]
        };
        await this.saveState();
        this.emitUpdate();

        // Start loop in background
        void this.executionLoop();
    }

    async stop(): Promise<void> {
        this.shouldStop = true;
        this.state.status = 'idle'; // Will be finalized in loop
        await this.saveState();
        this.emitUpdate();
    }

    // eslint-disable-next-line complexity
    private async executionLoop() {
        this.logInfo('Starting execution loop');

        while (!this.shouldStop) {
            try {
                if (this.shouldStop) { break; }

                if (!this.toolExecutor) {
                    throw new Error('ToolExecutor not initialized');
                }

                const toolDefs = await this.toolExecutor.getToolDefinitions();

                // 2. LLM Call
                const response = await this.llmService.chat(
                    this.state.history,
                    'gpt-4o', // Make configurable later
                    toolDefs,
                    'openai'
                );

                const content = response.content || '';
                const toolCalls = response.tool_calls || [];

                // 3. Update History
                this.state.history.push({
                    id: randomUUID(),
                    role: 'assistant',
                    content,
                    toolCalls: toolCalls,
                    timestamp: new Date()
                } as Message);

                // 4. Handle Tool Calls
                const taskCompleted = await this.processStep(toolCalls, content);

                if (taskCompleted) {
                    this.logInfo('Task completed by agent');
                    this.shouldStop = true;
                    this.state.status = 'idle';
                }

                // 5. Persist & Notify
                await this.saveState();
                this.emitUpdate();

            } catch (error) {
                // Resilience: Handle 429/Quota errors by waiting and retrying
                if (getErrorMessage(error).includes('429') || getErrorMessage(error).toLowerCase().includes('quota')) {
                    this.logWarn('Quota/429 exceeded. Pausing for 30 seconds before retry...');
                    this.state.lastError = 'Quota exceeded. Pausing...';
                    this.emitUpdate();
                    await new Promise(resolve => setTimeout(resolve, 30000));
                    // Loop continues (retries)
                    continue;
                }

                this.logError('Execution loop error', error);
                this.state.status = 'error';
                this.state.lastError = getErrorMessage(error);
                this.shouldStop = true;
                await this.saveState();
                this.emitUpdate();
                break;
            }
        }

        if (this.state.status !== 'error') {
            this.state.status = 'idle';
        }
        await this.saveState();
        this.emitUpdate();
        this.logInfo('Execution loop ended');
    }

    private async processStep(toolCalls: ToolCall[], content: string): Promise<boolean> {
        let taskCompleted = false;
        if (toolCalls.length > 0) {
            await this.handleToolCalls(toolCalls);
        } else if (content.includes('TASK COMPLETED')) {
            taskCompleted = true;
        }
        return taskCompleted;
    }

    private async handleToolCalls(toolCalls: ToolCall[]) {
        if (!this.toolExecutor) { return; }

        for (const call of toolCalls) {
            if (this.shouldStop) { break; }

            this.logInfo(`Executing tool: ${call.function.name}`);

            // Execute tool
            let result: string;
            try {
                const args = safeJsonParse(call.function.arguments, {});
                const toolResult = await this.toolExecutor.execute(
                    call.function.name,
                    args
                );
                result = JSON.stringify(toolResult);
            } catch (e) {
                result = `Error: ${getErrorMessage(e)}`;
            }

            // Add tool result to history
            this.state.history.push({
                id: randomUUID(),
                role: 'tool',
                toolCallId: call.id,
                content: result,
                timestamp: new Date()
            } as Message);
        }
    }

    private async loadState() {
        try {
            const data = await fs.readFile(this.statePath, 'utf-8');
            this.state = JSON.parse(data);
        } catch {
            // Ignore error, start fresh
        }
    }

    private async saveState() {
        try {
            await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2));
        } catch (e) {
            this.logError('Failed to save state', e);
        }
    }

    private emitUpdate() {
        this.eventBus.emit('project:update', this.state);
    }
}
