import { agentStateReducer } from '@main/services/project/agent/agent-state-machine';
import { AgentTaskState } from '@shared/types/agent-state';
import { describe, expect,it } from 'vitest';

describe('Agent State Machine', () => {
    const initialState: AgentTaskState = {
        taskId: 'test-task',
        projectId: 'test-project',
        description: 'test description',
        state: 'idle',
        currentStep: 0,
        totalSteps: 0,
        plan: null,
        messageHistory: [],
        eventHistory: [],
        currentProvider: {
            provider: 'openai',
            model: 'gpt-4o',
            accountIndex: 0,
            status: 'active'
        },
        providerHistory: [],
        errors: [],
        recoveryAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
        metrics: {
            duration: 0,
            llmCalls: 0,
            toolCalls: 0,
            tokensUsed: 0,
            providersUsed: [],
            errorCount: 0,
            recoveryCount: 0,
            estimatedCost: 0
        },
        context: {
            projectPath: '/test',
            projectName: 'test',
            workspace: {
                rootPath: '/test',
                hasGit: true,
                hasDependencies: true
            },
            constraints: {
                maxIterations: 10,
                maxDuration: 60000,
                maxToolCalls: 50,
                allowedTools: ['read_file', 'write_file']
            }
        },
        result: null
    };

    it('should transition from idle to initializing on START_TASK', () => {
        const newState = agentStateReducer(initialState, {
            type: 'START_TASK',
            payload: { taskId: 'test-task', task: 'test', projectId: 'test-project' }
        });
        expect(newState.state).toBe('initializing');
    });

    it('should transition from initializing to planning on TASK_VALIDATED', () => {
        const state: AgentTaskState = { ...initialState, state: 'initializing' };
        const newState = agentStateReducer(state, {
            type: 'TASK_VALIDATED',
            payload: {
                context: initialState.context
            }
        });
        expect(newState.state).toBe('planning');
    });

    it('should transition from planning to executing on PLAN_READY', () => {
        const state: AgentTaskState = { ...initialState, state: 'planning' };
        const newState = agentStateReducer(state, {
            type: 'PLAN_READY',
            payload: {
                plan: {
                    steps: [{ index: 0, description: 'step 1', type: 'analysis', status: 'pending', toolsUsed: [] }],
                    requiredTools: [],
                    dependencies: []
                }
            }
        });
        expect(newState.state).toBe('executing');
        expect(newState.plan).toBeDefined();
        expect(newState.totalSteps).toBe(1);
    });

    it('should increment llmCalls on LLM_REQUEST (executing -> waiting_llm)', () => {
        const state: AgentTaskState = { ...initialState, state: 'executing' };
        const newState = agentStateReducer(state, {
            type: 'LLM_REQUEST',
            payload: { messages: [], provider: 'openai', model: 'gpt-4o' }
        });
        expect(newState.state).toBe('waiting_llm');
        expect(newState.metrics.llmCalls).toBe(1);
    });

    it('should transition to paused on PAUSE', () => {
        const state: AgentTaskState = { ...initialState, state: 'executing' };
        const newState = agentStateReducer(state, { type: 'PAUSE' });
        expect(newState.state).toBe('paused');
    });
});
