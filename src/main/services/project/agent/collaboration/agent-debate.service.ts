import { randomUUID } from 'crypto';

import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { BaseService } from '@main/services/base.service';
import { DebateArgumentSchema } from '@shared/schemas/agent-collaboration.schema';
import {
    AGENT_COLLABORATION_PERFORMANCE_BUDGETS,
    AgentCollaborationTelemetryEvent,
    DebateCitation,
    DebateReplay,
    DebateSession,
    DebateSide,
} from '@shared/types/project-agent';

export interface DebateDependencies {
    telemetry?: TelemetryService;
    getAgentStats: (agentId: string) => { debatesParticipated: number; totalConfidence: number; confidenceSamples: number };
}

/**
 * AgentDebateService
 * Extracted from AgentCollaborationService to handle all debate logic.
 * AI-SYS-14 refactor.
 */
export class AgentDebateService extends BaseService {
    private sessions: Map<string, DebateSession> = new Map();

    constructor(private deps: DebateDependencies) {
        super('AgentDebateService');
    }

    /**
     * Set the telemetry service dependency
     */
    setTelemetryService(telemetry: TelemetryService): void {
        this.deps.telemetry = telemetry;
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing Agent Debate Service...');
    }

    /**
     * Create a debate session for a complex decision
     */
    createSession(
        taskId: string,
        stepIndex: number,
        topic: string
    ): DebateSession {
        const startMs = Date.now();
        if (!taskId) { throw new Error('taskId is required'); }

        const session: DebateSession = {
            id: randomUUID(),
            taskId,
            stepIndex,
            topic,
            status: 'open',
            arguments: [],
            consensus: {
                detected: false,
                confidence: 0,
                rationale: 'Awaiting arguments'
            },
            createdAt: Date.now()
        };

        this.sessions.set(session.id, session);
        this.logInfo(`Created debate session: ${session.id}`);

        this.track(AgentCollaborationTelemetryEvent.DEBATE_STARTED, {
            sessionId: session.id,
            taskId,
            stepIndex,
            topic: topic.substring(0, 100)
        });

        this.warnIfOverBudget('createSession', startMs, AGENT_COLLABORATION_PERFORMANCE_BUDGETS.DEBATE_SESSION_MS / 100);
        return session;
    }

    /**
     * Submit a debate argument from a model
     */
    submitArgument(options: {
        sessionId: string;
        agentId: string;
        provider: string;
        side: DebateSide;
        content: string;
        confidence: number;
        citations?: DebateCitation[];
    }): DebateSession | null {
        const session = this.sessions.get(options.sessionId);
        if (!session) {
            throw new Error(`Debate session ${options.sessionId} not found`);
        }

        try {
            const qualityScore = this.scoreArgumentQuality(
                options.content,
                options.confidence,
                options.citations ?? []
            );

            const argument = DebateArgumentSchema.parse({
                ...options,
                id: randomUUID(),
                qualityScore,
                citations: options.citations ?? [],
                timestamp: Date.now()
            });

            session.arguments.push(argument);
            session.consensus = this.detectConsensus(session.arguments);

            // Update stats via callback
            const stats = this.deps.getAgentStats(options.agentId);
            stats.debatesParticipated++;
            stats.totalConfidence += options.confidence;
            stats.confidenceSamples++;

            return session;
        } catch (error) {
            this.logError('Invalid debate argument', error as Error);
            throw new Error('INVALID_DEBATE_ARGUMENT');
        }
    }

    /**
     * Resolve a debate session
     */
    resolve(sessionId: string): DebateSession | null {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }
        session.consensus = this.detectConsensus(session.arguments);
        session.summary = this.createSummaryText(session);
        session.status = 'resolved';
        session.resolvedAt = Date.now();

        this.track(AgentCollaborationTelemetryEvent.DEBATE_COMPLETED, {
            sessionId,
            argumentCount: session.arguments.length,
            consensusDetected: session.consensus.detected,
            winningSide: session.consensus.winningSide ?? 'none'
        });

        return session;
    }

    override(
        sessionId: string,
        moderatorId: string,
        decision: DebateSide | 'balanced',
        reason?: string
    ): DebateSession | null {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }
        session.moderatorOverride = {
            moderatorId,
            moderatorRole: 'human_moderator',
            decision,
            reason,
            timestamp: Date.now()
        };
        session.consensus = {
            detected: true,
            winningSide: decision,
            confidence: 1,
            rationale: reason ?? 'Resolved by human moderator'
        };
        session.summary = this.createSummaryText(session);
        session.status = 'resolved';
        session.resolvedAt = Date.now();
        return session;
    }

    getSession(sessionId: string): DebateSession | null {
        return this.sessions.get(sessionId) ?? null;
    }

    getHistory(taskId?: string): DebateSession[] {
        const sessions = Array.from(this.sessions.values());
        const filtered = taskId ? sessions.filter(session => session.taskId === taskId) : sessions;
        return filtered.sort((left, right) => right.createdAt - left.createdAt);
    }

    getReplay(sessionId: string): DebateReplay | null {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }
        const timeline = [...session.arguments].sort((left, right) => left.timestamp - right.timestamp);
        return { session, timeline };
    }

    generateSummary(sessionId: string): string | null {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }
        const summary = this.createSummaryText(session);
        session.summary = summary;
        return summary;
    }

    private detectConsensus(args: DebateSession['arguments']): DebateSession['consensus'] {
        if (args.length === 0) {
            return { detected: false, confidence: 0, rationale: 'No arguments yet' };
        }

        const total = args.length;

        if (total < 2) {
            return { detected: false, confidence: 0.5, rationale: 'Insufficient arguments for consensus' };
        }

        const proWeight = args.filter(a => a.side === 'pro').reduce((s, a) => s + (a.confidence * a.qualityScore), 0);
        const conWeight = args.filter(a => a.side === 'con').reduce((s, a) => s + (a.confidence * a.qualityScore), 0);
        const totalWeight = proWeight + conWeight;

        if (totalWeight === 0) {
            return { detected: false, confidence: 0, rationale: 'Arguments have zero weight' };
        }

        const proRatio = proWeight / totalWeight;
        const conRatio = conWeight / totalWeight;

        if (Math.abs(proRatio - conRatio) < 0.2) {
            return {
                detected: true,
                winningSide: 'balanced',
                confidence: 1 - Math.abs(proRatio - conRatio),
                rationale: 'Balanced perspectives with no clear dominant side'
            };
        }

        return {
            detected: true,
            winningSide: proRatio > conRatio ? 'pro' : 'con',
            confidence: Math.abs(proRatio - conRatio),
            rationale: `Stronger weight for ${proRatio > conRatio ? 'pro' : 'con'} side`
        };
    }

    private scoreArgumentQuality(content: string, confidence: number, citations: DebateCitation[]): number {
        let score = (confidence / 100) * 50;
        if (content.length > 200) { score += 10; }
        if (content.length > 500) { score += 10; }
        score += Math.min(30, citations.length * 10);
        return Math.min(100, score);
    }

    private createSummaryText(session: DebateSession): string {
        const side = session.consensus.winningSide;
        const winner = side === 'pro' ? 'Pro-side' : side === 'con' ? 'Con-side' : 'A balanced view';
        return `Debate on "${session.topic}" concluded with ${winner}. ${session.consensus.rationale}.`;
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

    override async cleanup(): Promise<void> {
        this.sessions.clear();
    }
}
