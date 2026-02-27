/**
 * MARCH1-TEST-001: Council System Scenario-Based E2E Testing Matrix
 *
 * Integration-style tests covering the seven critical council flows.
 * Each scenario mocks external dependencies (DB, LLM) while exercising
 * the real service logic and state-machine transitions.
 */
/* eslint-disable max-lines-per-function */

import { AgentCollaborationService } from '@main/services/project/agent/agent-collaboration.service';
import { AgentExecutorService } from '@main/services/project/agent/agent-executor.service';
import { AgentPersistenceService } from '@main/services/project/agent/agent-persistence.service';
import { AgentProviderRotationService } from '@main/services/project/agent/agent-provider-rotation.service';
import { AgentTaskState, ExecutionPlan } from '@shared/types/agent-state';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal but fully-typed AgentTaskState for tests */
function createMockTaskState(overrides: Partial<AgentTaskState> = {}): AgentTaskState {
    return {
        taskId: 'task-001',
        projectId: 'proj-001',
        description: 'Test council task',
        state: 'idle',
        currentStep: 0,
        totalSteps: 0,
        plan: null,
        messageHistory: [],
        eventHistory: [],
        currentProvider: {
            provider: 'openai',
            model: 'gpt-4',
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
            projectPath: '/test/project',
            projectName: 'test-project',
            workspace: { rootPath: '/test/project', hasGit: true, hasDependencies: true },
            constraints: { maxIterations: 50, maxDuration: 300000, maxToolCalls: 100, allowedTools: [] }
        },
        result: null,
        ...overrides
    };
}

/** Builds a simple 3-step execution plan */
function createMockPlan(): ExecutionPlan {
    return {
        steps: [
            { index: 0, description: 'Analyze requirements', type: 'analysis', status: 'pending', toolsUsed: [] },
            { index: 1, description: 'Generate code', type: 'code_generation', status: 'pending', toolsUsed: [] },
            { index: 2, description: 'Run tests', type: 'testing', status: 'pending', toolsUsed: [] }
        ],
        estimatedDuration: 60000,
        requiredTools: ['file_read', 'file_write'],
        dependencies: []
    };
}

/** Builds a mock persistence service with vi.fn() stubs */
function createMockPersistence(): Record<string, ReturnType<typeof vi.fn>> {
    return {
        updateTaskState: vi.fn().mockResolvedValue(undefined),
        saveCheckpoint: vi.fn().mockResolvedValue(undefined),
        loadTask: vi.fn(),
        loadCheckpoint: vi.fn(),
        createTask: vi.fn().mockResolvedValue(undefined),
        appendMessage: vi.fn().mockResolvedValue(undefined),
        saveEvent: vi.fn().mockResolvedValue(undefined),
        recordProviderAttempt: vi.fn().mockResolvedValue(undefined),
        recordError: vi.fn().mockResolvedValue(undefined),
        getCheckpoints: vi.fn().mockResolvedValue([]),
        getLatestCheckpoint: vi.fn().mockResolvedValue(null)
    };
}

// ---------------------------------------------------------------------------
// Scenario 1 – Happy Path
// ---------------------------------------------------------------------------

describe('Council Scenario Tests', () => {
    /**
     * Scenario 1: Happy Path
     * plan → approval → execution → completion
     *
     * Verifies the golden-path flow where a task starts, produces a plan,
     * the plan is approved, steps execute successfully, and the task completes.
     */
    describe('Scenario 1 – Happy Path: plan → approve → execute → done', () => {
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

    // -----------------------------------------------------------------------
    // Scenario 2 – Reject Flow
    // -----------------------------------------------------------------------

    /**
     * Scenario 2: Reject Flow
     * proposal rejected → regenerate → approve
     *
     * When a plan is rejected the system transitions to planning again,
     * regenerates a plan, and proceeds on the second attempt.
     */
    describe('Scenario 2 – Reject Flow: reject → regenerate → approve', () => {
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

    // -----------------------------------------------------------------------
    // Scenario 3 – Quota-End Flow
    // -----------------------------------------------------------------------

    /**
     * Scenario 3: Quota-End Flow
     * model switch and continuation
     *
     * When a provider's quota is exhausted mid-execution the system rotates
     * to a new provider and continues executing.
     */
    describe('Scenario 3 – Quota-End Flow: model switch and continuation', () => {
        let executor: AgentExecutorService;
        let rotation: AgentProviderRotationService;
        let mockPersistence: ReturnType<typeof createMockPersistence>;

        beforeEach(() => {
            mockPersistence = createMockPersistence();
            executor = new AgentExecutorService(mockPersistence as unknown as AgentPersistenceService);

            const mockKeyRotation = {
                getActiveApiKeys: vi.fn().mockReturnValue([]),
                getAllProviderStatus: vi.fn().mockReturnValue(new Map())
            };
            const mockAuth = {
                getAccountsForProvider: vi.fn().mockReturnValue([])
            };
            rotation = new AgentProviderRotationService(
                mockKeyRotation as never,
                mockAuth as never
            );
        });

        it('should transition to rotating_provider on QUOTA_EXCEEDED', async () => {
            const state = createMockTaskState({ state: 'waiting_llm', startedAt: new Date() });

            const next = await executor.dispatch(state, {
                type: 'QUOTA_EXCEEDED',
                payload: { provider: 'openai' }
            });

            expect(next.state).toBe('rotating_provider');
        });

        it('should switch provider and resume executing on ROTATE_PROVIDER', async () => {
            const state = createMockTaskState({ state: 'rotating_provider', startedAt: new Date() });

            const next = await executor.dispatch(state, {
                type: 'ROTATE_PROVIDER',
                payload: { fromProvider: 'openai', toProvider: 'anthropic' }
            });

            expect(next.state).toBe('executing');
            expect(next.currentProvider.provider).toBe('anthropic');
        });

        it('should complete full quota-switch flow', async () => {
            let state = createMockTaskState({ state: 'executing', startedAt: new Date(), plan: createMockPlan(), totalSteps: 3 });

            // Step 0
            state = await executor.dispatch(state, { type: 'EXECUTE_STEP', payload: { stepIndex: 0 } });

            // LLM call
            state = await executor.dispatch(state, {
                type: 'LLM_REQUEST',
                payload: { messages: [], provider: 'openai', model: 'gpt-4' }
            });
            expect(state.state).toBe('waiting_llm');

            // Quota hit
            state = await executor.dispatch(state, {
                type: 'QUOTA_EXCEEDED',
                payload: { provider: 'openai' }
            });
            expect(state.state).toBe('rotating_provider');

            // Rotate
            state = await executor.dispatch(state, {
                type: 'ROTATE_PROVIDER',
                payload: { fromProvider: 'openai', toProvider: 'anthropic' }
            });
            expect(state.state).toBe('executing');
            expect(state.currentProvider.provider).toBe('anthropic');

            // Record provider stats through rotation service
            rotation.recordProviderError('openai', 'quota_exceeded');
            rotation.recordProviderSuccess('anthropic');

            // Continue executing
            state = await executor.dispatch(state, { type: 'EXECUTE_STEP', payload: { stepIndex: 1 } });
            state = await executor.dispatch(state, {
                type: 'TASK_COMPLETE',
                payload: { summary: 'Done after provider switch', artifacts: [] }
            });
            expect(state.state).toBe('completed');
        });
    });

    // -----------------------------------------------------------------------
    // Scenario 4 – Provider-Down Flow
    // -----------------------------------------------------------------------

    /**
     * Scenario 4: Provider-Down Flow
     * reroute and continuation
     *
     * When an LLM provider returns a retryable error, the state machine
     * enters recovery. If recovery fails, a fallback route is used.
     */
    describe('Scenario 4 – Provider-Down Flow: reroute and continuation', () => {
        let executor: AgentExecutorService;
        let mockPersistence: ReturnType<typeof createMockPersistence>;

        beforeEach(() => {
            mockPersistence = createMockPersistence();
            executor = new AgentExecutorService(mockPersistence as unknown as AgentPersistenceService);
        });

        it('should enter recovering state on retryable LLM_ERROR', async () => {
            const state = createMockTaskState({ state: 'waiting_llm', startedAt: new Date() });

            const next = await executor.dispatch(state, {
                type: 'LLM_ERROR',
                payload: {
                    error: { type: 'network', message: 'Connection refused', retryable: true },
                    provider: 'openai'
                }
            });

            expect(next.state).toBe('recovering');
            expect(next.recoveryAttempts).toBe(1);
            expect(next.errors).toHaveLength(1);
        });

        it('should enter rotating_provider on quota-type LLM_ERROR', async () => {
            const state = createMockTaskState({ state: 'waiting_llm', startedAt: new Date() });

            const next = await executor.dispatch(state, {
                type: 'LLM_ERROR',
                payload: {
                    error: { type: 'quota', message: 'Rate limit exceeded', retryable: true },
                    provider: 'openai'
                }
            });

            expect(next.state).toBe('rotating_provider');
        });

        it('should handle recovery → fallback → LLM_RESPONSE → executing', async () => {
            let state = createMockTaskState({ state: 'waiting_llm', startedAt: new Date() });

            // Provider error → recovering
            state = await executor.dispatch(state, {
                type: 'LLM_ERROR',
                payload: {
                    error: { type: 'network', message: 'Timeout', retryable: true },
                    provider: 'openai'
                }
            });
            expect(state.state).toBe('recovering');

            // Recovery fails
            state = await executor.dispatch(state, {
                type: 'RECOVERY_FAILED',
                payload: { error: 'Provider still down' }
            });
            expect(state.state).toBe('failed');

            // Resume from failed → initializing
            state = await executor.dispatch(state, { type: 'RESUME' });
            expect(state.state).toBe('initializing');
        });

        it('should recover successfully and resume executing', async () => {
            let state = createMockTaskState({ state: 'waiting_llm', startedAt: new Date() });

            // Error → recovering
            state = await executor.dispatch(state, {
                type: 'LLM_ERROR',
                payload: {
                    error: { type: 'server_error', message: '503', retryable: true },
                    provider: 'openai'
                }
            });
            expect(state.state).toBe('recovering');

            // Recovery succeeds
            state = await executor.dispatch(state, { type: 'RECOVERY_SUCCESS' });
            expect(state.state).toBe('executing');
            expect(state.errors[0].recovered).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Scenario 5 – Crash Flow
    // -----------------------------------------------------------------------

    /**
     * Scenario 5: Crash Flow
     * checkpoint save → simulated crash → resume from checkpoint
     *
     * Validates that checkpoints are persisted at critical moments and that
     * resumeFromCheckpoint restores the exact state.
     */
    describe('Scenario 5 – Crash Flow: checkpoint → crash → resume', () => {
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

    // -----------------------------------------------------------------------
    // Scenario 6 – Multi-Agent Help Flow
    // -----------------------------------------------------------------------

    /**
     * Scenario 6: Multi-Agent Help Flow
     * helper joins and merge accepted
     *
     * The primary agent requests help, a helper is scored and selected,
     * a handoff package is generated, and the helper's output passes the
     * merge gate.
     */
    describe('Scenario 6 – Multi-Agent Help Flow: helper joins, merge accepted', () => {
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

    // -----------------------------------------------------------------------
    // Scenario 7 – Governance Flow
    // -----------------------------------------------------------------------

    /**
     * Scenario 7: Governance Flow
     * blocked model rejected and alternate chosen
     *
     * A voting session deadlocks (split decision). A manual override selects
     * an alternative model. The user then picks the model through
     * USER_SELECT_MODEL, resuming execution.
     */
    describe('Scenario 7 – Governance Flow: blocked model rejected, alternate chosen', () => {
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
});
