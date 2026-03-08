import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    app: { getPath: () => '/tmp' }
}));

vi.mock('@main/logging/logger', () => ({
    appLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

vi.mock('uuid', () => ({
    v4: () => 'mock-uuid'
}));

import { DatabaseService } from '@main/services/data/database.service';
import { LLMService } from '@main/services/llm/llm.service';
import { EventBusService } from '@main/services/system/event-bus.service';
import { AgentRegistryService } from '@main/services/workspace/agent/agent-registry.service';
import { MultiAgentOrchestratorService } from '@main/services/workspace/orchestrator.service';

interface MockEventBus {
    emit: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
}

interface MockLLM {
    chat: ReturnType<typeof vi.fn>;
}

interface MockRegistry {
    getProfile: ReturnType<typeof vi.fn>;
}

describe('MultiAgentOrchestratorService', () => {
    let service: MultiAgentOrchestratorService;
    let mockDB: Record<string, unknown>;
    let mockLLM: MockLLM;
    let mockEventBus: MockEventBus;
    let mockRegistry: MockRegistry;

    beforeEach(() => {
        vi.clearAllMocks();
        mockDB = {};
        mockLLM = { chat: vi.fn() };
        mockEventBus = { emit: vi.fn(), on: vi.fn() };
        mockRegistry = {
            getProfile: vi.fn().mockReturnValue({
                id: 'architect',
                name: 'Architect',
                role: 'architect',
                persona: 'system architect',
                systemPrompt: 'Plan tasks'
            })
        };

        service = new MultiAgentOrchestratorService(
            mockDB as unknown as DatabaseService,
            mockLLM as unknown as LLMService,
            mockEventBus as unknown as EventBusService,
            mockRegistry as unknown as AgentRegistryService
        );
    });

    describe('initialize', () => {
        it('should initialize without errors', async () => {
            await expect(service.initialize()).resolves.toBeUndefined();
        });
    });

    describe('cleanup', () => {
        it('should reset state to idle', async () => {
            await service.cleanup();
            const state = service.getState();
            expect(state.status).toBe('idle');
            expect(state.plan).toEqual([]);
            expect(state.history).toEqual([]);
        });
    });

    describe('getState', () => {
        it('should return idle state initially', () => {
            const state = service.getState();
            expect(state.status).toBe('idle');
            expect(state.currentTask).toBe('');
        });
    });

    describe('stop', () => {
        it('should set status to idle', async () => {
            await service.stop();
            expect(service.getState().status).toBe('idle');
            expect(mockEventBus.emit).toHaveBeenCalledWith(
                'orchestrator:update',
                expect.objectContaining({ status: 'idle' })
            );
        });
    });

    describe('orchestrate', () => {
        it('should transition to planning and call LLM', async () => {
            mockLLM.chat.mockResolvedValue({
                content: JSON.stringify({
                    plan: [{ id: '1', text: 'Step 1', status: 'pending' }],
                    assignments: { '1': 'architect' }
                })
            });

            await service.orchestrate('Build a widget');
            const state = service.getState();
            expect(state.status).toBe('waiting_for_approval');
            expect(state.plan).toHaveLength(1);
            expect(mockRegistry.getProfile).toHaveBeenCalledWith('architect');
        });

        it('should set failed status when LLM returns invalid plan', async () => {
            mockLLM.chat.mockResolvedValue({
                content: JSON.stringify({ invalid: true })
            });

            await service.orchestrate('Bad task');
            expect(service.getState().status).toBe('failed');
            expect(service.getState().lastError).toBeDefined();
        });

        it('should set failed status when LLM throws', async () => {
            mockLLM.chat.mockRejectedValue(new Error('API error'));

            await service.orchestrate('Failing task');
            expect(service.getState().status).toBe('failed');
            expect(service.getState().lastError).toContain('API error');
        });
    });

    describe('approvePlan', () => {
        it('should do nothing if not waiting for approval', async () => {
            await service.approvePlan();
            // state should remain idle, no error
            expect(service.getState().status).toBe('idle');
        });

        it('should execute plan after approval', async () => {
            // Setup: orchestrate to get to waiting_for_approval
            mockLLM.chat.mockResolvedValueOnce({
                content: JSON.stringify({
                    plan: [{ id: '1', text: 'Step 1', status: 'pending' }],
                    assignments: { '1': 'default' }
                })
            });
            await service.orchestrate('task');
            expect(service.getState().status).toBe('waiting_for_approval');

            // Approve and execute
            mockLLM.chat.mockResolvedValueOnce({ content: 'Step completed' });
            await service.approvePlan();
            expect(service.getState().status).toBe('completed');
        });

        it('should set failed status if execution throws', async () => {
            mockLLM.chat.mockResolvedValueOnce({
                content: JSON.stringify({
                    plan: [{ id: '1', text: 'Step 1', status: 'pending' }],
                    assignments: { '1': 'default' }
                })
            });
            await service.orchestrate('task');

            mockLLM.chat.mockRejectedValueOnce(new Error('exec fail'));
            await service.approvePlan();
            expect(service.getState().status).toBe('failed');
        });
    });
});
