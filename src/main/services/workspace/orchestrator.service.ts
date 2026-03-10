import { BaseService } from '@main/services/base.service';
import { DatabaseService } from '@main/services/data/database.service';
import { LLMService } from '@main/services/llm/llm.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { AgentRegistryService } from '@main/services/workspace/automation-workflow/agent-registry.service';
import { OrchestratorState, WorkspaceStep } from '@shared/types/automation-workflow';
import { Message } from '@shared/types/chat';
import { v4 as uuidv4 } from 'uuid';

/**
 * MultiAgentOrchestratorService
 * 
 * Coordinations multiple specialized agents (Planner, Worker, Reviewer)
 * to perform complex tasks.
 */
export class MultiAgentOrchestratorService extends BaseService {
    private state: OrchestratorState = {
        status: 'idle',
        currentTask: '',
        plan: [],
        history: [],
        assignments: {}
    };

    constructor(
        _db: DatabaseService, // Removing private to fix unused warning
        private llm: LLMService,
        public eventBus: EventBusService,
        private registry: AgentRegistryService
    ) {
        super('MultiAgentOrchestratorService');
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing Multi-Agent Orchestrator...');
    }

    /** Resets orchestration state and clears history. */
    async cleanup(): Promise<void> {
        this.state = {
            status: 'idle',
            currentTask: '',
            plan: [],
            history: [],
            assignments: {}
        };
        this.logInfo('Multi-Agent Orchestrator cleaned up');
    }

    /**
     * Start a multi-agent orchestration workflow (Planning Phase)
     */
    async orchestrate(task: string, _workspaceId?: string): Promise<void> {
        this.state = {
            status: 'planning',
            currentTask: task,
            plan: [],
            history: [],
            assignments: {}
        };
        this.emitUpdate();

        try {
            await this.runPlanningPhase();
        } catch (error) {
            this.state.status = 'failed';
            this.state.lastError = (error as Error).message;
            this.logError('Orchestration planning failed', error as Error);
            this.emitUpdate();
        }
    }

    async stop(): Promise<void> {
        this.logInfo('Stopping orchestration...');
        this.state.status = 'idle';
        this.emitUpdate();
    }

    private async runPlanningPhase(): Promise<void> {
        this.logInfo('Starting planning phase...');
        const planner = this.registry.getProfile('architect');
        this.state.activeAgentId = planner.id;
        this.state.status = 'planning';
        this.emitUpdate();

        const prompt = `
            You are the ${planner.role} (${planner.name}).
            Persona: ${planner.persona}
            System Prompt: ${planner.systemPrompt}

            User Task: ${this.state.currentTask}

            Your goal is to break down this task into a multi-agent plan.
            Assign each step to an appropriate agent profile. Available profiles:
            - architect: System design, planning, and review.
            - default: Full-stack implementation and problem-solving.

            Return a JSON object with:
            {
                "plan": [
                    { "id": "1", "text": "Step description", "status": "pending" }
                ],
                "assignments": {
                    "1": "profile_id"
                }
            }
        `;

        const messages: Message[] = [{
            id: uuidv4(),
            role: 'system',
            content: prompt,
            timestamp: new Date()
        }];

        try {
            const response = await this.llm.chat(messages, 'gpt-4o', undefined, 'openai', { temperature: 0.2 });
            const result = JSON.parse(response.content);

            if (result && Array.isArray(result.plan) && typeof result.assignments === 'object') {
                this.state.plan = (result.plan as WorkspaceStep[]).map((s) => ({ ...s, status: 'pending' }));
                this.state.assignments = result.assignments;
                this.state.status = 'waiting_for_approval';
            } else {
                throw new Error('Invalid plan format from LLM');
            }
        } catch (error) {
            this.logError('Planning phase failed', error as Error);
            throw error;
        } finally {
            this.emitUpdate();
        }
    }

    private async runExecutionPhase(): Promise<void> {
        this.logInfo('Starting execution phase...');
        this.state.status = 'running';

        for (const step of this.state.plan) {
            step.status = 'running';
            const profileId = this.state.assignments[step.id] || 'default';
            const agent = this.registry.getProfile(profileId);
            this.state.activeAgentId = agent.id;
            this.emitUpdate();

            this.logInfo(`Executing step: ${step.text} using agent: ${agent.name}`);

            const workerPrompt = `
                You are the ${agent.role} (${agent.name}).
                Persona: ${agent.persona}
                System Prompt: ${agent.systemPrompt}

                Task Context: ${this.state.currentTask}
                Current Step: ${step.text}

                Execute this step and provide the results.
            `;

            const messages: Message[] = [
                ...this.state.history,
                {
                    id: uuidv4(),
                    role: 'system',
                    content: workerPrompt,
                    timestamp: new Date()
                }
            ];

            try {
                const response = await this.llm.chat(messages, 'gpt-4o', undefined, 'openai', { temperature: 0.7 });
                this.state.history.push({
                    id: uuidv4(),
                    role: 'assistant',
                    content: response.content,
                    timestamp: new Date(),
                    model: agent.id
                });
                step.status = 'completed';
            } catch (error) {
                this.logError(`Step execution failed: ${step.text}`, error as Error);
                step.status = 'failed';
                throw error;
            }

            this.emitUpdate();
        }
    }

    async approvePlan(plan?: WorkspaceStep[]): Promise<void> {
        if (this.state.status !== 'waiting_for_approval') {
            return;
        }

        if (plan) {
            this.state.plan = plan;
        }

        this.state.status = 'running';
        this.emitUpdate();

        try {
            await this.runExecutionPhase();
            this.state.status = 'completed';
        } catch (error) {
            this.state.status = 'failed';
            this.state.lastError = (error as Error).message;
            this.logError('Execution phase failed', error as Error);
        } finally {
            this.emitUpdate();
        }
    }

    private emitUpdate(): void {
        this.eventBus.emit('orchestrator:update', this.state);
    }

    getState(): OrchestratorState {
        return this.state;
    }
}

