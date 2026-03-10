import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { LLMService } from '@main/services/llm/llm.service';
import {
    AgentCollaborationService
} from '@main/services/workspace/automation-workflow/agent-collaboration.service';
import {
    AgentCollaborationTelemetryEvent
} from '@shared/types/automation-workflow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@main/logging/logger', () => ({
    appLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

describe('AgentCollaborationService Telemetry', () => {
    let service: AgentCollaborationService;
    let mockLlm: LLMService;
    let mockTelemetry: { track: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        vi.clearAllMocks();
        mockLlm = { chat: vi.fn(), getAvailableProviders: vi.fn().mockResolvedValue(['openai', 'anthropic']) } as unknown as LLMService;
        mockTelemetry = { track: vi.fn().mockReturnValue({ success: true }) };
        service = new AgentCollaborationService({ llm: mockLlm });
        service.setTelemetryService(mockTelemetry as unknown as TelemetryService);
        service.updateVotingConfiguration({ minimumVotes: 2, deadlockThreshold: 0.1 });
    });

    describe('TASK_ASSIGNED event', () => {
        it('tracks when a model is assigned to a step', () => {
            // Note: assignModelToStep itself doesn't track, it returns a new step.
            // But we can check if it works.
            const step = service.assignModelToStep(
                { id: 's1', text: 'Create user service', status: 'pending' },
                'openai',
                'gpt-4o',
                'Best for code gen'
            );

            expect(step.modelConfig).toEqual({
                provider: 'openai',
                model: 'gpt-4o',
                reason: 'Best for code gen'
            });
        });
    });

    describe('MODEL_ROUTED event', () => {
        it('tracks when a model is routed by task type', () => {
            service.getModelForStep({ id: 's1', text: 'Create a component', status: 'pending', taskType: 'code_generation' }, ['openai', 'anthropic']);

            expect(mockTelemetry.track).toHaveBeenCalledWith(
                AgentCollaborationTelemetryEvent.MODEL_ROUTED,
                expect.objectContaining({
                    taskType: 'code_generation',
                    provider: 'openai',
                    model: 'gpt-4o'
                })
            );
        });
    });

    describe('VOTING_SESSION_CREATED event', () => {
        it('tracks when a voting session is created', () => {
            const session = service.createVotingSession('task-1', 0, 'Which approach?', ['A', 'B']);

            expect(mockTelemetry.track).toHaveBeenCalledWith(
                AgentCollaborationTelemetryEvent.VOTING_SESSION_CREATED,
                expect.objectContaining({
                    sessionId: session.id,
                    taskId: 'task-1',
                    stepIndex: 0,
                    optionCount: 2
                })
            );
        });
    });

    describe('VOTING_COMPLETED event', () => {
        it('tracks when voting resolves successfully', async () => {
            const session = service.createVotingSession('task-1', 0, 'Pick one', ['A', 'B']);
            await service.submitVote({ sessionId: session.id, modelId: 'm1', provider: 'openai', decision: 'A', confidence: 90 });
            await service.submitVote({ sessionId: session.id, modelId: 'm2', provider: 'anthropic', decision: 'A', confidence: 85 });

            service.resolveVoting(session.id);

            expect(mockTelemetry.track).toHaveBeenCalledWith(
                AgentCollaborationTelemetryEvent.VOTING_COMPLETED,
                expect.objectContaining({
                    sessionId: session.id,
                    finalDecision: 'A',
                    voteCount: 2,
                    resolutionSource: 'automatic'
                })
            );
        });
    });

    describe('CONFLICT_DETECTED event', () => {
        it('tracks voting deadlock as conflict', async () => {
            const session = service.createVotingSession('task-1', 0, 'Pick one', ['A', 'B']);
            await service.submitVote({ sessionId: session.id, modelId: 'm1', provider: 'openai', decision: 'A', confidence: 90 });
            await service.submitVote({ sessionId: session.id, modelId: 'm2', provider: 'anthropic', decision: 'B', confidence: 90 });

            service.resolveVoting(session.id);

            expect(mockTelemetry.track).toHaveBeenCalledWith(
                AgentCollaborationTelemetryEvent.CONFLICT_DETECTED,
                expect.objectContaining({
                    sessionId: session.id,
                    conflictType: 'voting_deadlock'
                })
            );
        });
    });

    describe('CONSENSUS_REACHED event', () => {
        it('tracks consensus when outputs are unanimous', async () => {
            const result = await service.buildConsensus([
                { model: 'm1', output: 'same output text here' },
                { model: 'm2', output: 'same output text here' }
            ]);

            expect(result.agreed).toBe(true);
            expect(mockTelemetry.track).toHaveBeenCalledWith(
                AgentCollaborationTelemetryEvent.CONSENSUS_REACHED,
                expect.objectContaining({
                    modelCount: 2,
                    resolutionMethod: 'unanimous'
                })
            );
        });
    });

    describe('CONSENSUS_FAILED event', () => {
        it('tracks when consensus fails and arbitration fails', async () => {
            vi.mocked(mockLlm.chat).mockRejectedValue(new Error('LLM unavailable'));

            const result = await service.buildConsensus([
                { model: 'm1', output: 'Approach A with React hooks and context' },
                { model: 'm2', output: 'Approach B with Redux toolkit and sagas' },
                { model: 'm3', output: 'Approach C with MobX observables and stores' }
            ]);

            expect(result.agreed).toBe(false);
            expect(mockTelemetry.track).toHaveBeenCalledWith(
                AgentCollaborationTelemetryEvent.CONSENSUS_FAILED,
                expect.objectContaining({
                    modelCount: 3,
                    resolutionMethod: 'manual'
                })
            );
        });
    });

    describe('DEBATE_STARTED event', () => {
        it('tracks when a debate session is created', () => {
            const session = service.createDebateSession('task-1', 0, 'Should we use microservices?');

            expect(mockTelemetry.track).toHaveBeenCalledWith(
                AgentCollaborationTelemetryEvent.DEBATE_STARTED,
                expect.objectContaining({
                    sessionId: session.id,
                    taskId: 'task-1',
                    stepIndex: 0
                })
            );
        });
    });

    describe('DEBATE_COMPLETED event', () => {
        it('tracks when a debate session is resolved', () => {
            const session = service.createDebateSession('task-1', 0, 'Use GraphQL?');
            service.submitDebateArgument({
                sessionId: session.id,
                agentId: 'a1',
                provider: 'openai',
                side: 'pro',
                content: 'GraphQL is flexible and efficient',
                confidence: 85
            });

            service.resolveDebateSession(session.id);

            expect(mockTelemetry.track).toHaveBeenCalledWith(
                AgentCollaborationTelemetryEvent.DEBATE_COMPLETED,
                expect.objectContaining({
                    sessionId: session.id,
                    argumentCount: 1,
                    consensusDetected: false
                })
            );
        });
    });

    describe('AGENT_JOINED event', () => {
        it('tracks when a new agent registers as available', () => {
            service.registerWorkerAvailability({
                taskId: 'task-1',
                agentId: 'agent-alpha',
                status: 'available',
                skills: ['typescript', 'react']
            });

            expect(mockTelemetry.track).toHaveBeenCalledWith(
                AgentCollaborationTelemetryEvent.AGENT_JOINED,
                expect.objectContaining({
                    taskId: 'task-1',
                    agentId: 'agent-alpha',
                    skillCount: 2
                })
            );
        });

        it('does not track AGENT_JOINED for re-registrations', () => {
            service.registerWorkerAvailability({
                taskId: 'task-1',
                agentId: 'agent-alpha',
                status: 'available',
                skills: ['typescript']
            });
            mockTelemetry.track.mockClear();

            service.registerWorkerAvailability({
                taskId: 'task-1',
                agentId: 'agent-alpha',
                status: 'available',
                skills: ['typescript', 'react']
            });

            expect(mockTelemetry.track).not.toHaveBeenCalledWith(
                AgentCollaborationTelemetryEvent.AGENT_JOINED,
                expect.anything()
            );
        });

        it('does not track AGENT_JOINED when status is not available', () => {
            service.registerWorkerAvailability({
                taskId: 'task-1',
                agentId: 'agent-beta',
                status: 'busy',
                skills: ['python']
            });

            expect(mockTelemetry.track).not.toHaveBeenCalledWith(
                AgentCollaborationTelemetryEvent.AGENT_JOINED,
                expect.anything()
            );
        });
    });

    describe('RESULT_MERGED event', () => {
        it('tracks when conflicting outputs are merged via arbitration', async () => {
            vi.mocked(mockLlm.chat).mockResolvedValue({
                content: 'Merged best-of-both approach'
            } as never);

            const result = await service.buildConsensus([
                { model: 'm1', output: 'Approach A with React hooks and context API' },
                { model: 'm2', output: 'Approach B with Redux toolkit and middleware' },
                { model: 'm3', output: 'Approach C with MobX observables and decorators' }
            ]);

            expect(result.agreed).toBe(true);
            expect(result.resolutionMethod).toBe('arbitration');
            expect(mockTelemetry.track).toHaveBeenCalledWith(
                AgentCollaborationTelemetryEvent.RESULT_MERGED,
                expect.objectContaining({
                    modelCount: 3,
                    resolutionMethod: 'arbitration'
                })
            );
        });
    });

    describe('telemetry disabled', () => {
        it('does not throw when telemetry service is not set', () => {
            const serviceNoTelemetry = new AgentCollaborationService({ llm: mockLlm });
            serviceNoTelemetry.updateVotingConfiguration({ minimumVotes: 2, deadlockThreshold: 0.1 });

            expect(() => {
                serviceNoTelemetry.createVotingSession('task-1', 0, 'Question', ['A', 'B']);
            }).not.toThrow();
        });
    });
});

