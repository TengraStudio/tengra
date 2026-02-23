import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentCollaborationService } from '@main/services/project/agent/agent-collaboration.service';
import { LLMService } from '@main/services/llm/llm.service';
import { ProjectStep } from '@shared/types/project-agent';

describe('AgentCollaborationService', () => {
    let service: AgentCollaborationService;
    let mockLlm: LLMService;

    beforeEach(() => {
        mockLlm = {
            chat: vi.fn(),
        } as unknown as LLMService;
        service = new AgentCollaborationService({ llm: mockLlm });
        // Enable automatic resolution for tests by default
        service.updateVotingConfiguration({ minimumVotes: 2, deadlockThreshold: 0.1 });
    });

    describe('getModelForStep', () => {
        it('identifies code_generation tasks correctly', () => {
            const step: ProjectStep = {
                id: 's1',
                text: 'Create a new function to calculate total',
                status: 'pending'
            };
            const config = service.getModelForStep(step, ['openai', 'anthropic']);
            expect(config.provider).toBe('openai');
            expect(config.model).toBe('gpt-4o');
        });

        it('identifies research tasks correctly', () => {
            const step: ProjectStep = {
                id: 's2',
                text: 'Investigate the best way to implement SSO',
                status: 'pending'
            };
            const config = service.getModelForStep(step, ['anthropic', 'google']);
            expect(config.provider).toBe('anthropic');
            expect(config.model).toBe('claude-3-5-sonnet-20241022');
        });

        it('falls back to general model for unknown task types', () => {
            const step: ProjectStep = {
                id: 's3',
                text: 'Do some magic',
                status: 'pending'
            };
            const config = service.getModelForStep(step, ['openai', 'anthropic']);
            expect(config.provider).toBe('openai');
            expect(config.model).toBe('gpt-4o');
        });
    });

    describe('Voting Sessions', () => {
        it('creates a voting session', () => {
            const session = service.createVotingSession('task-1', 1, 'Which color?', ['Red', 'Blue']);
            expect(session.id).toBeDefined();
            expect(session.question).toBe('Which color?');
            expect(session.status).toBe('pending');
        });

        it('resolves voting automatically when minimum votes reached', async () => {
            const session = service.createVotingSession('task-1', 1, 'Which color?', ['Red', 'Blue']);
            await service.submitVote({
                sessionId: session.id,
                modelId: 'm1',
                provider: 'openai',
                decision: 'Red',
                confidence: 90
            });
            await service.submitVote({
                sessionId: session.id,
                modelId: 'm2',
                provider: 'anthropic',
                decision: 'Red',
                confidence: 85
            });

            const updated = service.resolveVoting(session.id);
            expect(updated?.status).toBe('resolved');
            expect(updated?.finalDecision).toBe('Red');
        });

        it('detects deadlocks when disagreement is high', async () => {
            const session = service.createVotingSession('task-1', 1, 'Which color?', ['Red', 'Blue']);
            await service.submitVote({
                sessionId: session.id,
                modelId: 'm1',
                provider: 'openai',
                decision: 'Red',
                confidence: 90
            });
            await service.submitVote({
                sessionId: session.id,
                modelId: 'm2',
                provider: 'anthropic',
                decision: 'Blue',
                confidence: 90
            });

            const updated = service.resolveVoting(session.id);
            expect(updated?.status).toBe('deadlocked');
        });
    });

    describe('Debate Sessions', () => {
        it('detects consensus in debates', async () => {
            const session = service.createDebateSession('task-1', 1, 'Use React Query?');
            if (!session) throw new Error('Session not created');

            service.submitDebateArgument({
                sessionId: session.id,
                agentId: 'a1',
                provider: 'openai',
                side: 'pro',
                content: 'React Query handles caching perfectly.',
                confidence: 95,
                citations: []
            });

            const updated = service.submitDebateArgument({
                sessionId: session.id,
                agentId: 'a2',
                provider: 'anthropic',
                side: 'pro',
                content: 'Yes, it reduces boilerplate significantly.',
                confidence: 90,
                citations: []
            });

            expect(updated?.consensus.detected).toBe(true);
            expect(updated?.consensus.winningSide).toBe('pro');
        });
    });
});
