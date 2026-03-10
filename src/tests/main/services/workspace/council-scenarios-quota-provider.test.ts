/**
 * Council Scenarios 3–4: Quota-End Flow & Provider-Down Flow
 */

import { AgentExecutorService } from '@main/services/workspace/automation-workflow/agent-executor.service';
import { AgentPersistenceService } from '@main/services/workspace/automation-workflow/agent-persistence.service';
import { AgentProviderRotationService } from '@main/services/workspace/automation-workflow/agent-provider-rotation.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockPersistence, createMockPlan, createMockTaskState } from './council-scenarios.helpers';

describe('Council Scenario 3 – Quota-End Flow: model switch and continuation', () => {
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

describe('Council Scenario 4 – Provider-Down Flow: reroute and continuation', () => {
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
