import { randomUUID } from 'crypto';

import { appLogger } from '@main/logging/logger';
import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { BaseService } from '@main/services/base.service';
import { LLMService } from '@main/services/llm/llm.service';
import { VotingSessionSchema } from '@shared/schemas/agent-collaboration.schema';
import {
    AGENT_COLLABORATION_PERFORMANCE_BUDGETS,
    AgentCollaborationTelemetryEvent,
    VotingAnalytics,
    VotingConfiguration,
    VotingSession,
    VotingTemplate,
} from '@shared/types/workspace-agent';

export interface VotingDependencies {
    llm: LLMService;
    telemetry?: TelemetryService;
    // We pass a function to get stats instead of the whole service to avoid circular deps
    getAgentStats: (agentId: string) => { votesParticipated: number; totalConfidence: number; confidenceSamples: number };
}

const DEFAULT_VOTING_CONFIGURATION: VotingConfiguration = {
    minimumVotes: 2,
    deadlockThreshold: 0.1,
    autoResolve: true,
    autoResolveTimeoutMs: 30_000,
};

const DEFAULT_VOTING_TEMPLATES: VotingTemplate[] = [
    {
        id: 'plan-approval',
        name: 'Plan Approval',
        description: 'Do you approve the proposed execution plan?',
        questionTemplate: 'Do you approve the proposed execution plan?',
        options: ['approve', 'reject', 'revise'],
        isBuiltIn: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
    },
    {
        id: 'conflict-resolution',
        name: 'Conflict Resolution',
        description: 'Which implementation approach is better for this conflict?',
        questionTemplate: 'Which implementation approach is better for this conflict?',
        options: ['Option A', 'Option B'],
        isBuiltIn: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
    }
];

/**
 * AgentVotingService
 * Extracted from AgentCollaborationService to handle all voting logic.
 * AI-SYS-14 refactor.
 */
export class AgentVotingService extends BaseService {
    private sessions: Map<string, VotingSession> = new Map();
    private configuration: VotingConfiguration = { ...DEFAULT_VOTING_CONFIGURATION };
    private templates: VotingTemplate[] = [...DEFAULT_VOTING_TEMPLATES];

    constructor(private deps: VotingDependencies) {
        super('AgentVotingService');
    }

    /**
     * Set the telemetry service dependency
     */
    setTelemetryService(telemetry: TelemetryService): void {
        this.deps.telemetry = telemetry;
    }

    async initialize(): Promise<void> {
        this.logInfo('Initializing Agent Voting Service...');
    }

    /**
     * Create a voting session for a critical decision
     */
    createSession(
        taskId: string,
        stepIndex: number,
        question: string,
        options: string[]
    ): VotingSession {
        const startMs = Date.now();
        if (!taskId) { throw new Error('taskId is required'); }
        if (options.length < 2) { throw new Error('At least 2 options required'); }

        const session: VotingSession = {
            id: randomUUID(),
            taskId,
            stepIndex,
            question,
            options,
            votes: [],
            status: 'pending',
            createdAt: Date.now(),
        };

        try {
            VotingSessionSchema.parse(session);
            this.sessions.set(session.id, session);
            appLogger.info(this.name, `Created voting session: ${session.id} - "${question}"`);

            this.track(AgentCollaborationTelemetryEvent.VOTING_SESSION_CREATED, {
                sessionId: session.id,
                taskId,
                stepIndex,
                optionCount: options.length
            });

            this.warnIfOverBudget('createSession', startMs, AGENT_COLLABORATION_PERFORMANCE_BUDGETS.CREATE_VOTING_SESSION_MS);
            return session;
        } catch (error) {
            appLogger.error(this.name, 'Failed to create valid voting session', error as Error);
            throw new Error('VOTING_SESSION_INVALID');
        }
    }

    /**
     * Submit a vote from a model
     */
    async submitVote(options: {
        sessionId: string;
        modelId: string;
        provider: string;
        decision: string;
        confidence: number;
        reasoning?: string;
    }): Promise<VotingSession | null> {
        const { sessionId, modelId, provider, decision, confidence, reasoning } = options;
        const session = this.sessions.get(sessionId);
        if (!session) {
            appLogger.warn(this.name, `Voting session not found: ${sessionId}`);
            throw new Error(`Voting session ${sessionId} not found`);
        }

        const vote = {
            modelId,
            provider,
            decision,
            confidence,
            reasoning,
            timestamp: Date.now(),
        };

        // Check if this model already voted
        const existingVoteIndex = session.votes.findIndex(v => v.modelId === modelId);
        if (existingVoteIndex >= 0) {
            session.votes[existingVoteIndex] = vote;
        } else {
            session.votes.push(vote);
        }

        session.status = 'voting';

        // Update stats via callback
        const stats = this.deps.getAgentStats(modelId);
        stats.votesParticipated++;
        stats.totalConfidence += confidence;
        stats.confidenceSamples++;

        appLogger.info(
            this.name,
            `Vote submitted: ${modelId} voted "${decision}" (confidence: ${confidence}%)`
        );

        return session;
    }

    /**
     * Request votes from multiple models
     */
    async requestVotes(
        sessionId: string,
        models: Array<{ provider: string; model: string }>
    ): Promise<VotingSession | null> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        const prompt = `You are participating in a voting decision. Please analyze the following question and vote for one of the options.

Question: ${session.question}

Options:
${session.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

Respond with a JSON object:
{
    "decision": "<your chosen option>",
    "confidence": <0-100>,
    "reasoning": "<brief explanation>"
}`;

        const votePromises = models.map(async ({ provider, model }) => {
            try {
                const response = await this.deps.llm.chat(
                    [{ id: randomUUID(), role: 'user', content: prompt, timestamp: new Date() }],
                    model,
                    [],
                    provider
                );

                // Parse JSON response
                const content = typeof response.content === 'string' ? response.content : '';
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]) as {
                        decision: string;
                        confidence: number;
                        reasoning?: string;
                    };
                    await this.submitVote({
                        sessionId,
                        modelId: model,
                        provider,
                        decision: parsed.decision,
                        confidence: parsed.confidence,
                        reasoning: parsed.reasoning
                    });
                }
            } catch (error) {
                appLogger.warn(
                    this.name,
                    `Failed to get vote from ${provider}/${model}: ${error}`
                );
            }
        });

        await Promise.all(votePromises);
        return this.sessions.get(sessionId) ?? null;
    }

    /**
     * Resolve a voting session
     */
    resolve(sessionId: string): VotingSession | null {
        const session = this.sessions.get(sessionId);
        if (!session || session.votes.length === 0) {
            return null;
        }
        if (session.votes.length < this.configuration.minimumVotes) {
            session.status = 'voting';
            return session;
        }

        // Count votes weighted by confidence
        const voteWeights = new Map<string, number>();
        for (const vote of session.votes) {
            const current = voteWeights.get(vote.decision) ?? 0;
            voteWeights.set(vote.decision, current + vote.confidence);
        }

        // Find winner
        let maxWeight = 0;
        let winner = session.votes[0].decision;
        for (const [decision, weight] of voteWeights) {
            if (weight > maxWeight) {
                maxWeight = weight;
                winner = decision;
            }
        }

        // Check for tie/deadlock
        const topDecisions = Array.from(voteWeights.entries())
            .filter(([, weight]) => weight >= maxWeight * this.configuration.deadlockThreshold);

        if (topDecisions.length > 1) {
            session.status = 'deadlocked';
            appLogger.warn(this.name, `Voting deadlock: ${topDecisions.map(d => d[0]).join(' vs ')}`);
            this.track(AgentCollaborationTelemetryEvent.CONFLICT_DETECTED, {
                sessionId,
                conflictType: 'voting_deadlock',
                decisionCount: topDecisions.length
            });
        } else {
            session.status = 'resolved';
            session.finalDecision = winner;
            session.resolutionSource = 'automatic';
            session.resolvedAt = Date.now();
            appLogger.info(this.name, `Voting resolved: "${winner}"`);
            this.track(AgentCollaborationTelemetryEvent.VOTING_COMPLETED, {
                sessionId,
                finalDecision: winner,
                voteCount: session.votes.length,
                resolutionSource: 'automatic'
            });
        }

        return session;
    }

    getSession(sessionId: string): VotingSession | null {
        return this.sessions.get(sessionId) ?? null;
    }

    getSessions(taskId?: string): VotingSession[] {
        const sessions = Array.from(this.sessions.values());
        const filtered = taskId ? sessions.filter(session => session.taskId === taskId) : sessions;
        return filtered.sort((a, b) => b.createdAt - a.createdAt);
    }

    overrideDecision(
        sessionId: string,
        finalDecision: string,
        reason?: string
    ): VotingSession | null {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Voting session ${sessionId} not found`);
        }

        if (!finalDecision) { throw new Error('finalDecision is required'); }

        session.status = 'resolved';
        session.finalDecision = finalDecision;
        session.resolutionSource = 'manual_override';
        session.overrideReason = reason;
        session.resolvedAt = Date.now();
        appLogger.warn(
            this.name,
            `Voting manually overridden for ${sessionId}: "${finalDecision}"`
        );
        return session;
    }

    getAnalytics(taskId?: string): VotingAnalytics {
        const sessions = this.getSessions(taskId);
        if (sessions.length === 0) {
            return {
                totalSessions: 0,
                pendingSessions: 0,
                resolvedSessions: 0,
                deadlockedSessions: 0,
                averageVotesPerSession: 0,
                averageConfidence: 0,
                disagreementIndex: 0,
                updatedAt: Date.now()
            };
        }

        const totalVotes = sessions.reduce((sum, session) => sum + session.votes.length, 0);
        const totalConfidence = sessions.reduce(
            (sum, session) => sum + session.votes.reduce((voteSum, vote) => voteSum + vote.confidence, 0),
            0
        );
        const disagreementSignals = sessions.filter(session => {
            const uniqueDecisions = new Set(session.votes.map(vote => vote.decision));
            return uniqueDecisions.size > 1 || session.status === 'deadlocked';
        }).length;

        return {
            totalSessions: sessions.length,
            pendingSessions: sessions.filter(session => session.status === 'pending' || session.status === 'voting').length,
            resolvedSessions: sessions.filter(session => session.status === 'resolved').length,
            deadlockedSessions: sessions.filter(session => session.status === 'deadlocked').length,
            averageVotesPerSession: totalVotes / sessions.length,
            averageConfidence: totalVotes > 0 ? totalConfidence / totalVotes : 0,
            disagreementIndex: disagreementSignals / sessions.length,
            updatedAt: Date.now()
        };
    }

    getConfiguration(): VotingConfiguration {
        return { ...this.configuration };
    }

    updateConfiguration(patch: Partial<VotingConfiguration>): VotingConfiguration {
        this.configuration = {
            ...this.configuration,
            ...patch,
            minimumVotes: Math.max(1, patch.minimumVotes ?? this.configuration.minimumVotes),
            deadlockThreshold: Math.min(
                1,
                Math.max(0.5, patch.deadlockThreshold ?? this.configuration.deadlockThreshold)
            ),
            autoResolveTimeoutMs: Math.max(
                10_000,
                patch.autoResolveTimeoutMs ?? this.configuration.autoResolveTimeoutMs
            )
        };
        return { ...this.configuration };
    }

    getTemplates(): VotingTemplate[] {
        return [...this.templates];
    }

    private track(event: AgentCollaborationTelemetryEvent, payload: Record<string, unknown>): void {
        if (this.deps.telemetry) {
            this.deps.telemetry.track(event, payload);
        }
    }

    private warnIfOverBudget(operation: string, startMs: number, budgetMs: number): void {
        const duration = Date.now() - startMs;
        if (duration > budgetMs) {
            this.logWarn(`Performance budget exceeded for ${operation}: ${duration}ms (budget: ${budgetMs}ms)`);
        }
    }

    async cleanup(): Promise<void> {
        this.sessions.clear();
    }
}
