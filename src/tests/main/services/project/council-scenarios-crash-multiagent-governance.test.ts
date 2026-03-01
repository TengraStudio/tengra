/**
 * Council Scenarios 5–7: Crash Flow, Multi-Agent Help Flow & Governance Flow
 */

import { AgentCollaborationService } from '@main/services/project/agent/agent-collaboration.service';
import { AgentExecutorService } from '@main/services/project/agent/agent-executor.service';
import { AgentPersistenceService } from '@main/services/project/agent/agent-persistence.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockPersistence, createMockPlan, createMockTaskState } from './council-scenarios.helpers';

describe('Council Scenario 5 – Crash Flow: checkpoint → crash → resume', () => {
    let executor: AgentExecutorService;
    let mockPersistence: ReturnType<typeof createMockPersistence>;

    beforeEach(() => {
        mockPersistence = createMockPersistence();
        executor = new AgentExecutorService(mockPersistence as unknown as AgentPersistenceService);
    });

    it('should save checkpoint on step change', async () => {
        const state = createMockTaskState({
            state: 'executing',
            startedAt: new Date(),
            plan: createMockPlan(),
            totalSteps: 3,
            currentStep: 0
        });

        const next = await executor.dispatch(state, {
            type: 'EXECUTE_STEP',
            payload: { stepIndex: 1 }
        });

        expect(next.currentStep).toBe(1);
        expect(mockPersistence.saveCheckpoint).toHaveBeenCalledWith(
            'task-001',
            1,
            expect.objectContaining({ currentStep: 1 })
        );
    });

    it('should resume from checkpoint after simulated crash', async () => {
        const crashedState = createMockTaskState({
            state: 'executing',
            startedAt: new Date(),
            currentStep: 2,
            totalSteps: 3,
            plan: createMockPlan()
        });

        mockPersistence.loadCheckpoint.mockResolvedValue(crashedState);

        const resumed = await executor.resumeFromCheckpoint('cp-crash-001');

        expect(resumed.currentStep).toBe(2);
        expect(resumed.state).toBe('executing');
        expect(mockPersistence.updateTaskState).toHaveBeenCalledWith('task-001', crashedState);
    });

    it('should continue execution after resuming from checkpoint', async () => {
        const checkpointState = createMockTaskState({
            state: 'executing',
            startedAt: new Date(),
            currentStep: 1,
            totalSteps: 3,
            plan: createMockPlan()
        });

        mockPersistence.loadCheckpoint.mockResolvedValue(checkpointState);

        // Resume
        let state = await executor.resumeFromCheckpoint('cp-001');
        expect(state.currentStep).toBe(1);

        // Continue with step 2
        state = await executor.dispatch(state, {
            type: 'EXECUTE_STEP',
            payload: { stepIndex: 2 }
        });
        expect(state.currentStep).toBe(2);

        // Complete
        state = await executor.dispatch(state, {
            type: 'TASK_COMPLETE',
            payload: { summary: 'Completed after crash recovery', artifacts: [] }
        });
        expect(state.state).toBe('completed');
    });

    it('should throw when checkpoint not found', async () => {
        mockPersistence.loadCheckpoint.mockResolvedValue(null);

        await expect(
            executor.resumeFromCheckpoint('cp-nonexistent')
        ).rejects.toThrow('Checkpoint cp-nonexistent not found');
    });
});

describe('Council Scenario 6 – Multi-Agent Help Flow: helper joins, merge accepted', () => {
    let collaboration: AgentCollaborationService;

    beforeEach(() => {
        const mockLlm = { chat: vi.fn() };
        collaboration = new AgentCollaborationService({ llm: mockLlm } as never);
    });

    it('should register worker availability', () => {
        const record = collaboration.registerWorkerAvailability({
            taskId: 'task-001',
            agentId: 'helper-agent-1',
            status: 'available',
            skills: ['code_generation', 'testing'],
            contextReadiness: 0.8
        });

        expect(record.agentId).toBe('helper-agent-1');
        expect(record.status).toBe('available');
    });

    it('should score helper candidates based on skill match', () => {
        collaboration.registerWorkerAvailability({
            taskId: 'task-001',
            agentId: 'helper-1',
            status: 'available',
            skills: ['code_generation', 'testing'],
            contextReadiness: 0.9
        });

        collaboration.registerWorkerAvailability({
            taskId: 'task-001',
            agentId: 'helper-2',
            status: 'available',
            skills: ['documentation'],
            contextReadiness: 0.5
        });

        const scores = collaboration.scoreHelperCandidates({
            taskId: 'task-001',
            stageId: 'stage-1',
            requiredSkills: ['code_generation']
        });

        expect(scores.length).toBeGreaterThanOrEqual(1);
        const best = scores[0];
        expect(best.agentId).toBe('helper-1');
        expect(best.score).toBeGreaterThan(0);
    });

    it('should generate handoff package for helper', () => {
        const handoff = collaboration.generateHelperHandoffPackage({
            taskId: 'task-001',
            stageId: 'stage-1',
            ownerAgentId: 'main-agent',
            helperAgentId: 'helper-1',
            stageGoal: 'Build authentication module',
            acceptanceCriteria: ['Tests pass', 'No lint errors'],
            constraints: ['Max 200 lines']
        });

        expect(handoff.ownerAgentId).toBe('main-agent');
        expect(handoff.helperAgentId).toBe('helper-1');
        expect(handoff.acceptanceCriteria).toContain('Tests pass');
    });

    it('should accept helper output via merge gate', () => {
        const decision = collaboration.evaluateHelperMergeGate({
            acceptanceCriteria: ['tests pass', 'no lint errors'],
            constraints: ['max 200 lines'],
            helperOutput: 'All tests pass and no lint errors found. Code is 150 lines.'
        });

        expect(decision.accepted).toBe(true);
        expect(decision.verdict).toBe('ACCEPT');
    });

    it('should reject helper output that fails merge gate', () => {
        const decision = collaboration.evaluateHelperMergeGate({
            acceptanceCriteria: ['tests pass', 'coverage above 80%'],
            constraints: [],
            helperOutput: 'Build succeeded but some tests are skipped.'
        });

        expect(decision.accepted).toBe(false);
        expect(decision.verdict).toBe('REVISE');
        expect(decision.requiredFixes.length).toBeGreaterThan(0);
    });
});

describe('Council Scenario 7 – Governance Flow: blocked model rejected, alternate chosen', () => {
    let executor: AgentExecutorService;
    let collaboration: AgentCollaborationService;
    let mockPersistence: ReturnType<typeof createMockPersistence>;

    beforeEach(() => {
        mockPersistence = createMockPersistence();
        executor = new AgentExecutorService(mockPersistence as unknown as AgentPersistenceService);

        const mockLlm = { chat: vi.fn() };
        collaboration = new AgentCollaborationService({ llm: mockLlm } as never);
    });

    it('should detect deadlock when votes are evenly split', () => {
        const session = collaboration.createVotingSession(
            'task-001', 0, 'Which model to use?', ['gpt-4', 'claude-3']
        );

        void collaboration.submitVote({
            sessionId: session.id,
            modelId: 'model-a',
            provider: 'openai',
            decision: 'gpt-4',
            confidence: 80
        });

        void collaboration.submitVote({
            sessionId: session.id,
            modelId: 'model-b',
            provider: 'anthropic',
            decision: 'claude-3',
            confidence: 80
        });

        const resolved = collaboration.resolveVoting(session.id);
        expect(resolved).not.toBeNull();
        expect(resolved!.status).toBe('deadlocked');
    });

    it('should allow manual override on deadlocked voting', () => {
        const session = collaboration.createVotingSession(
            'task-001', 0, 'Which model?', ['gpt-4', 'claude-3']
        );

        void collaboration.submitVote({
            sessionId: session.id, modelId: 'a', provider: 'openai',
            decision: 'gpt-4', confidence: 80
        });
        void collaboration.submitVote({
            sessionId: session.id, modelId: 'b', provider: 'anthropic',
            decision: 'claude-3', confidence: 80
        });

        // Resolve to see deadlock
        collaboration.resolveVoting(session.id);

        // Admin overrides
        const overridden = collaboration.overrideVotingDecision(
            session.id,
            'claude-3',
            'Claude has better context window for this task'
        );

        expect(overridden!.finalDecision).toBe('claude-3');
        expect(overridden!.resolutionSource).toBe('manual_override');
        expect(overridden!.overrideReason).toContain('context window');
    });

    it('should apply user model selection after governance decision', async () => {
        const state = createMockTaskState({ state: 'waiting_user', startedAt: new Date() });

        const next = await executor.dispatch(state, {
            type: 'USER_SELECT_MODEL',
            payload: { provider: 'anthropic', model: 'claude-3' }
        });

        expect(next.state).toBe('executing');
        expect(next.currentProvider.provider).toBe('anthropic');
        expect(next.currentProvider.model).toBe('claude-3');
    });

    it('should complete full governance override flow', async () => {
        let state = createMockTaskState({
            state: 'executing',
            startedAt: new Date(),
            plan: createMockPlan(),
            totalSteps: 3
        });

        // LLM request
        state = await executor.dispatch(state, {
            type: 'LLM_REQUEST',
            payload: { messages: [], provider: 'openai', model: 'gpt-4' }
        });
        expect(state.state).toBe('waiting_llm');

        // LLM error – resource type triggers waiting_user
        state = await executor.dispatch(state, {
            type: 'LLM_ERROR',
            payload: {
                error: { type: 'resource', message: 'Insufficient context', retryable: false },
                provider: 'openai'
            }
        });
        expect(state.state).toBe('waiting_user');

        // Governance: create voting session and override to alternate model
        const session = collaboration.createVotingSession(
            'task-001', 0, 'Select alternate model', ['claude-3', 'gemini-pro']
        );
        collaboration.overrideVotingDecision(session.id, 'claude-3', 'Better fit');

        // User selects the governance-chosen model
        state = await executor.dispatch(state, {
            type: 'USER_SELECT_MODEL',
            payload: { provider: 'anthropic', model: 'claude-3' }
        });
        expect(state.state).toBe('executing');
        expect(state.currentProvider.provider).toBe('anthropic');

        // Complete
        state = await executor.dispatch(state, {
            type: 'TASK_COMPLETE',
            payload: { summary: 'Done with alternate model', artifacts: [] }
        });
        expect(state.state).toBe('completed');
    });
});
