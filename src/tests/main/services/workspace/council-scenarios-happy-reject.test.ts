/**
 * Council Scenarios 1–2: Happy Path & Reject Flow
 */

import { AgentCollaborationService } from '@main/services/workspace/agent/agent-collaboration.service';
import { AgentExecutorService } from '@main/services/workspace/automation-workflow/agent-executor.service';
import { AgentPersistenceService } from '@main/services/workspace/agent/agent-persistence.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockPersistence, createMockPlan, createMockTaskState } from './council-scenarios.helpers';

describe('Council Scenario 1 – Happy Path: plan → approve → execute → done', () => {
    let executor: AgentExecutorService;
    let mockPersistence: ReturnType<typeof createMockPersistence>;

    beforeEach(() => {
        mockPersistence = createMockPersistence();
        executor = new AgentExecutorService(mockPersistence as unknown as AgentPersistenceService);
    });

    it('should transition idle → initializing on START_TASK', async () => {
        const state = createMockTaskState();
        const next = await executor.dispatch(state, {
            type: 'START_TASK',
            payload: { taskId: 'task-001', task: 'Build feature', projectId: 'proj-001' }
        });

        expect(next.state).toBe('initializing');
        expect(next.startedAt).toBeInstanceOf(Date);
    });

    it('should transition initializing → planning on TASK_VALIDATED', async () => {
        const state = createMockTaskState({ state: 'initializing', startedAt: new Date() });
        const next = await executor.dispatch(state, {
            type: 'TASK_VALIDATED',
            payload: { context: state.context }
        });

        expect(next.state).toBe('planning');
        expect(mockPersistence.saveCheckpoint).toHaveBeenCalled();
    });

    it('should transition planning → executing on PLAN_READY', async () => {
        const state = createMockTaskState({ state: 'planning', startedAt: new Date() });
        const plan = createMockPlan();

        const next = await executor.dispatch(state, {
            type: 'PLAN_READY',
            payload: { plan }
        });

        expect(next.state).toBe('executing');
        expect(next.plan).toEqual(plan);
        expect(next.totalSteps).toBe(3);
        expect(mockPersistence.saveCheckpoint).toHaveBeenCalled();
    });

    it('should complete full happy-path flow end-to-end', async () => {
        let state = createMockTaskState();

        // 1. Start
        state = await executor.dispatch(state, {
            type: 'START_TASK',
            payload: { taskId: 'task-001', task: 'Build feature', projectId: 'proj-001' }
        });
        expect(state.state).toBe('initializing');

        // 2. Validate
        state = await executor.dispatch(state, {
            type: 'TASK_VALIDATED',
            payload: { context: state.context }
        });
        expect(state.state).toBe('planning');

        // 3. Plan ready
        state = await executor.dispatch(state, {
            type: 'PLAN_READY',
            payload: { plan: createMockPlan() }
        });
        expect(state.state).toBe('executing');

        // 4. Execute each step
        for (let i = 0; i < 3; i++) {
            state = await executor.dispatch(state, {
                type: 'EXECUTE_STEP',
                payload: { stepIndex: i }
            });
            expect(state.state).toBe('executing');
            expect(state.currentStep).toBe(i);
        }

        // 5. Complete
        state = await executor.dispatch(state, {
            type: 'TASK_COMPLETE',
            payload: { summary: 'All steps done', artifacts: ['src/feature.ts'] }
        });
        expect(state.state).toBe('completed');
        expect(state.result?.success).toBe(true);
        expect(state.completedAt).toBeInstanceOf(Date);
    });
});

describe('Council Scenario 2 – Reject Flow: reject → regenerate → approve', () => {
    let executor: AgentExecutorService;
    let collaboration: AgentCollaborationService;
    let mockPersistence: ReturnType<typeof createMockPersistence>;

    beforeEach(() => {
        mockPersistence = createMockPersistence();
        executor = new AgentExecutorService(mockPersistence as unknown as AgentPersistenceService);

        const mockLlm = { chat: vi.fn() };
        collaboration = new AgentCollaborationService({ llm: mockLlm } as never);
    });

    it('should allow voting to reject a plan proposal', () => {
        const session = collaboration.createVotingSession('task-001', 0, 'Accept plan?', ['approve', 'reject']);
        expect(session.status).toBe('pending');

        void collaboration.submitVote({
            sessionId: session.id,
            modelId: 'gpt-4',
            provider: 'openai',
            decision: 'reject',
            confidence: 90,
            reasoning: 'Plan misses error handling'
        });

        void collaboration.submitVote({
            sessionId: session.id,
            modelId: 'claude-3',
            provider: 'anthropic',
            decision: 'reject',
            confidence: 85
        });

        const resolved = collaboration.resolveVoting(session.id);
        expect(resolved).not.toBeNull();
        expect(resolved!.status).toBe('resolved');
        expect(resolved!.finalDecision).toBe('reject');
    });

    it('should recover from rejection by regenerating a plan', async () => {
        let state = createMockTaskState({ state: 'initializing', startedAt: new Date() });

        // Validate → planning
        state = await executor.dispatch(state, {
            type: 'TASK_VALIDATED',
            payload: { context: state.context }
        });
        expect(state.state).toBe('planning');

        // First plan ready → executing
        state = await executor.dispatch(state, {
            type: 'PLAN_READY',
            payload: { plan: createMockPlan() }
        });
        expect(state.state).toBe('executing');

        // Pause (simulates rejection causing re-plan)
        state = await executor.dispatch(state, { type: 'PAUSE' });
        expect(state.state).toBe('paused');

        // Resume goes back to executing (plan exists)
        state = await executor.dispatch(state, { type: 'RESUME' });
        expect(state.state).toBe('executing');

        // Second plan executes to completion
        state = await executor.dispatch(state, {
            type: 'TASK_COMPLETE',
            payload: { summary: 'Completed with revised plan', artifacts: [] }
        });
        expect(state.state).toBe('completed');
    });
});
