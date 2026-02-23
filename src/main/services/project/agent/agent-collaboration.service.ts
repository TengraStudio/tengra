/**
 * Agent Collaboration Service
 * Handles multi-model collaboration features:
 * - AGT-COL-01: Per-step model assignment
 * - AGT-COL-02: Task-type based model routing
 * - AGT-COL-03: Voting mechanism for critical decisions
 * - AGT-COL-04: Consensus building for conflicting outputs
 */

import { randomUUID } from 'crypto';

import { appLogger } from '@main/logging/logger';
import { BaseService } from '@main/services/base.service';
import { LLMService } from '@main/services/llm/llm.service';
import {
    DebateArgumentSchema,
    ModelRoutingRuleSchema,
    VotingSessionSchema
} from '@shared/schemas/agent-collaboration.schema';
import {
    AgentCollaborationIntent,
    AgentCollaborationMessage,
    AgentCollaborationPriority,
    AgentTeamworkAnalytics,
    ConsensusResult,
    HelperCandidateScore,
    HelperHandoffPackage,
    HelperMergeGateDecision,
    DebateArgument,
    DebateCitation,
    DebateConsensus,
    DebateReplay,
    DebateSession,
    DebateSide,
    ModelRoutingRule,
    ProjectStep,
    StepModelConfig,
    TaskType,
    WorkerAvailabilityRecord,
    VotingAnalytics,
    VotingConfiguration,
    VotingSession,
    VotingTemplate,
} from '@shared/types/project-agent';
import { z } from 'zod';

/** Standardized error for agent collaboration */
export class AgentCollaborationError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'AgentCollaborationError';
    }
}

/** Default model routing rules based on task type */
const DEFAULT_ROUTING_RULES: ModelRoutingRule[] = [
    // Code generation - GPT-4 and Claude are strong
    { taskType: 'code_generation', provider: 'openai', model: 'gpt-4o', priority: 100 },
    { taskType: 'code_generation', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 90 },

    // Code review - Claude excels at analysis
    { taskType: 'code_review', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 100 },
    { taskType: 'code_review', provider: 'openai', model: 'gpt-4o', priority: 80 },

    // Research - Claude has good reasoning
    { taskType: 'research', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 100 },
    { taskType: 'research', provider: 'google', model: 'gemini-1.5-pro', priority: 85 },

    // Documentation - Both are good
    { taskType: 'documentation', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 95 },
    { taskType: 'documentation', provider: 'openai', model: 'gpt-4o', priority: 90 },

    // Debugging - GPT-4 is strong at reasoning
    { taskType: 'debugging', provider: 'openai', model: 'gpt-4o', priority: 100 },
    { taskType: 'debugging', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 90 },

    // Testing - Both are capable
    { taskType: 'testing', provider: 'openai', model: 'gpt-4o', priority: 95 },
    { taskType: 'testing', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 90 },

    // Refactoring - Claude's careful analysis helps
    { taskType: 'refactoring', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 100 },
    { taskType: 'refactoring', provider: 'openai', model: 'gpt-4o', priority: 85 },

    // Planning - Claude excels at structured thinking
    { taskType: 'planning', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 100 },
    { taskType: 'planning', provider: 'openai', model: 'o1', priority: 95 },

    // General - Balanced choice
    { taskType: 'general', provider: 'openai', model: 'gpt-4o', priority: 90 },
    { taskType: 'general', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', priority: 90 },
];

/** Task type detection patterns */
const TASK_TYPE_PATTERNS: Array<{ type: TaskType; patterns: RegExp[] }> = [
    {
        type: 'code_generation',
        patterns: [
            /\b(create|implement|write|add|build)\s+(a\s+)?(function|class|component|module|api|service)/i,
            /\b(generate|implement)\s+(code|logic)/i,
        ],
    },
    {
        type: 'code_review',
        patterns: [
            /\b(review|analyze|audit|check)\s+(the\s+)?(code|implementation)/i,
            /\b(find\s+)?(bugs|issues|problems)/i,
        ],
    },
    {
        type: 'research',
        patterns: [
            /\b(research|investigate|explore|find\s+out|look\s+into)/i,
            /\b(understand|learn\s+about|study)/i,
        ],
    },
    {
        type: 'documentation',
        patterns: [
            /\b(document|write\s+docs|add\s+comments|create\s+readme)/i,
            /\b(jsdoc|docstring|api\s+docs)/i,
        ],
    },
    {
        type: 'debugging',
        patterns: [
            /\b(debug|fix\s+bug|troubleshoot|diagnose)/i,
            /\b(error|exception|crash|failing)/i,
        ],
    },
    {
        type: 'testing',
        patterns: [
            /\b(test|write\s+tests|add\s+tests|unit\s+test|integration\s+test)/i,
            /\b(coverage|spec|assert)/i,
        ],
    },
    {
        type: 'refactoring',
        patterns: [
            /\b(refactor|restructure|reorganize|clean\s+up|optimize)/i,
            /\b(improve|simplify|extract|move)/i,
        ],
    },
    {
        type: 'planning',
        patterns: [
            /\b(plan|design|architect|outline|strategy)/i,
            /\b(roadmap|breakdown|steps)/i,
        ],
    },
];

const DEFAULT_VOTING_CONFIGURATION: VotingConfiguration = {
    minimumVotes: 2,
    deadlockThreshold: 0.9,
    autoResolve: true,
    autoResolveTimeoutMs: 60_000
};

const DEFAULT_VOTING_TEMPLATES: VotingTemplate[] = [
    {
        id: 'risk-assessment',
        name: 'Risk Assessment',
        description: 'Use when models disagree on implementation safety.',
        questionTemplate: 'Which option has the lowest regression risk?',
        options: ['Option A', 'Option B', 'Option C'],
        isBuiltIn: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
    },
    {
        id: 'strategy-selection',
        name: 'Strategy Selection',
        description: 'Compare implementation strategies for a task.',
        questionTemplate: 'Which strategy best fits the current codebase constraints?',
        options: ['Conservative', 'Balanced', 'Aggressive'],
        isBuiltIn: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
    }
];

const AGENT_COLLABORATION_INTENTS: readonly AgentCollaborationIntent[] = [
    'REQUEST_HELP',
    'SHARE_CONTEXT',
    'PROPOSE_CHANGE',
    'BLOCKER_REPORT'
];

const MAX_COLLABORATION_PAYLOAD_KEYS = 32;
const MAX_COLLABORATION_STRING_LENGTH = 4000;
const COLLABORATION_LOOP_WINDOW_MS = 5 * 60 * 1000;
const COLLABORATION_LOOP_THRESHOLD = 3;

export interface AgentCollaborationDependencies {
    llm: LLMService;
}

export class AgentCollaborationService extends BaseService {
    private routingRules: ModelRoutingRule[] = [...DEFAULT_ROUTING_RULES];
    private votingSessions: Map<string, VotingSession> = new Map();
    private debateSessions: Map<string, DebateSession> = new Map();
    private collaborationMessages = new Map<string, AgentCollaborationMessage[]>();
    private votingConfiguration: VotingConfiguration = { ...DEFAULT_VOTING_CONFIGURATION };
    private votingTemplates: VotingTemplate[] = [...DEFAULT_VOTING_TEMPLATES];
    private workerAvailability = new Map<string, Map<string, WorkerAvailabilityRecord>>();
    private agentTaskStats = new Map<string, {
        completedTasks: number;
        failedTasks: number;
        inProgressTasks: number;
        totalDurationMs: number;
        totalConfidence: number;
        confidenceSamples: number;
        votesParticipated: number;
        debatesParticipated: number;
        consensusAligned: number;
    }>();

    constructor(private deps: AgentCollaborationDependencies) {
        super('AgentCollaborationService');
    }

    // ===== AGT-COL-01: Per-Step Model Assignment =====

    /**
     * Assign a specific model to a step
     */
    assignModelToStep(step: ProjectStep, provider: string, model: string, reason?: string): ProjectStep {
        appLogger.info('AgentCollaboration', `Assigning ${provider}/${model} to step: ${step.text.substring(0, 50)}...`);

        return {
            ...step,
            modelConfig: {
                provider,
                model,
                reason,
            },
        };
    }

    /**
     * Get the model configuration for a step (returns assigned or routed model)
     */
    getModelForStep(step: ProjectStep, availableProviders: string[]): StepModelConfig {
        // If explicitly assigned, use that
        if (step.modelConfig) {
            return step.modelConfig;
        }

        // Otherwise, route based on task type
        const taskType = step.taskType ?? this.detectTaskType(step.text);
        return this.routeByTaskType(taskType, availableProviders);
    }

    // ===== AGT-COL-02: Task-Type Based Model Routing =====

    /**
     * Detect the task type from step text
     */
    detectTaskType(stepText: string): TaskType {
        const text = stepText.toLowerCase();

        for (const { type, patterns } of TASK_TYPE_PATTERNS) {
            if (patterns.some(pattern => pattern.test(text))) {
                return type;
            }
        }

        return 'general';
    }

    /**
     * Route to the best model for a task type
     */
    routeByTaskType(taskType: TaskType, availableProviders: string[]): StepModelConfig {
        // Find matching rules sorted by priority
        const matchingRules = this.routingRules
            .filter(rule => rule.taskType === taskType)
            .filter(rule => availableProviders.includes(rule.provider))
            .sort((a, b) => b.priority - a.priority);

        if (matchingRules.length > 0) {
            const bestRule = matchingRules[0];
            return {
                provider: bestRule.provider,
                model: bestRule.model,
                reason: `Best model for ${taskType} tasks`,
            };
        }

        // Fallback to first available provider
        const fallbackProvider = availableProviders[0] ?? 'openai';
        return {
            provider: fallbackProvider,
            model: fallbackProvider === 'anthropic' ? 'claude-3-5-sonnet-20241022' : 'gpt-4o',
            reason: 'Fallback model',
        };
    }

    /**
     * Add or update routing rules
     */
    setRoutingRules(rules: ModelRoutingRule[]): void {
        try {
            const validatedRules = z.array(ModelRoutingRuleSchema).parse(rules) as ModelRoutingRule[];
            this.routingRules = [...validatedRules];
            appLogger.info('AgentCollaboration', `Updated routing rules: ${validatedRules.length} rules`);
        } catch (error) {
            throw new AgentCollaborationError(
                'Invalid routing rules',
                'INVALID_ROUTING_RULES',
                { error }
            );
        }
    }

    /**
     * Get current routing rules
     */
    getRoutingRules(): ModelRoutingRule[] {
        return [...this.routingRules];
    }

    /**
     * Analyze steps and assign task types
     */
    analyzeSteps(steps: ProjectStep[]): ProjectStep[] {
        return steps.map(step => ({
            ...step,
            taskType: step.taskType ?? this.detectTaskType(step.text),
        }));
    }

    // ===== AGT-COL-03: Voting Mechanism =====

    /**
     * Create a voting session for a critical decision
     */
    createVotingSession(
        taskId: string,
        stepIndex: number,
        question: string,
        options: string[]
    ): VotingSession {
        if (!taskId) {throw new AgentCollaborationError('taskId is required', 'MISSING_TASK_ID');}
        if (options.length < 2) {throw new AgentCollaborationError('At least 2 options required', 'INVALID_OPTIONS');}

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
            this.votingSessions.set(session.id, session);
            appLogger.info('AgentCollaboration', `Created voting session: ${session.id} - "${question}"`);
            return session;
        } catch (error) {
            throw new AgentCollaborationError('Failed to create valid voting session', 'VOTING_SESSION_INVALID', { error });
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
        const session = this.votingSessions.get(sessionId);
        if (!session) {
            appLogger.warn('AgentCollaboration', `Voting session not found: ${sessionId}`);
            throw new AgentCollaborationError(`Voting session ${sessionId} not found`, 'VOTING_SESSION_NOT_FOUND');
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
        this.getAgentTaskStats(modelId).votesParticipated++;
        this.getAgentTaskStats(modelId).totalConfidence += confidence;
        this.getAgentTaskStats(modelId).confidenceSamples++;
        appLogger.info(
            'AgentCollaboration',
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
        const session = this.votingSessions.get(sessionId);
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
                    'AgentCollaboration',
                    `Failed to get vote from ${provider}/${model}: ${error}`
                );
            }
        });

        await Promise.all(votePromises);
        return this.votingSessions.get(sessionId) ?? null;
    }

    /**
     * Resolve a voting session
     */
    resolveVoting(sessionId: string): VotingSession | null {
        const session = this.votingSessions.get(sessionId);
        if (!session || session.votes.length === 0) {
            return null;
        }
        if (session.votes.length < this.votingConfiguration.minimumVotes) {
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
            .filter(([, weight]) => weight >= maxWeight * this.votingConfiguration.deadlockThreshold);

        if (topDecisions.length > 1) {
            session.status = 'deadlocked';
            appLogger.warn('AgentCollaboration', `Voting deadlock: ${topDecisions.map(d => d[0]).join(' vs ')}`);
        } else {
            session.status = 'resolved';
            session.finalDecision = winner;
            session.resolutionSource = 'automatic';
            session.overrideReason = undefined;
            session.resolvedAt = Date.now();
            appLogger.info('AgentCollaboration', `Voting resolved: "${winner}"`);
        }

        return session;
    }

    /**
     * Get a voting session
     */
    getVotingSession(sessionId: string): VotingSession | null {
        return this.votingSessions.get(sessionId) ?? null;
    }

    /**
     * Get all voting sessions, optionally filtered by task.
     */
    getVotingSessions(taskId?: string): VotingSession[] {
        const sessions = Array.from(this.votingSessions.values());
        const filtered = taskId ? sessions.filter(session => session.taskId === taskId) : sessions;
        return filtered.sort((a, b) => b.createdAt - a.createdAt);
    }

    /**
     * Manually override final decision for a voting session.
     */
    overrideVotingDecision(
        sessionId: string,
        finalDecision: string,
        reason?: string
    ): VotingSession | null {
        const session = this.votingSessions.get(sessionId);
        if (!session) {
            throw new AgentCollaborationError(`Voting session ${sessionId} not found`, 'VOTING_SESSION_NOT_FOUND');
        }

        if (!finalDecision) {throw new AgentCollaborationError('finalDecision is required', 'MISSING_DECISION');}

        session.status = 'resolved';
        session.finalDecision = finalDecision;
        session.resolutionSource = 'manual_override';
        session.overrideReason = reason;
        session.resolvedAt = Date.now();
        appLogger.warn(
            'AgentCollaboration',
            `Voting manually overridden for ${sessionId}: "${finalDecision}"`
        );
        return session;
    }

    /**
     * Aggregate voting analytics for active and historical sessions.
     */
    getVotingAnalytics(taskId?: string): VotingAnalytics {
        const sessions = this.getVotingSessions(taskId);
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

    getVotingConfiguration(): VotingConfiguration {
        return { ...this.votingConfiguration };
    }

    updateVotingConfiguration(patch: Partial<VotingConfiguration>): VotingConfiguration {
        this.votingConfiguration = {
            ...this.votingConfiguration,
            ...patch,
            minimumVotes: Math.max(1, patch.minimumVotes ?? this.votingConfiguration.minimumVotes),
            deadlockThreshold: Math.min(
                1,
                Math.max(0.5, patch.deadlockThreshold ?? this.votingConfiguration.deadlockThreshold)
            ),
            autoResolveTimeoutMs: Math.max(
                10_000,
                patch.autoResolveTimeoutMs ?? this.votingConfiguration.autoResolveTimeoutMs
            )
        };
        return { ...this.votingConfiguration };
    }

    getVotingTemplates(): VotingTemplate[] {
        return [...this.votingTemplates];
    }

    // ===== AGT-COL-04: Consensus Building =====

    /**
     * Build consensus from multiple model outputs
     */
    async buildConsensus(
        outputs: Array<{ modelId: string; provider: string; output: string }>
    ): Promise<ConsensusResult> {
        if (outputs.length === 0) {
            return {
                agreed: false,
                resolutionMethod: 'manual',
            };
        }

        if (outputs.length === 1) {
            return {
                agreed: true,
                mergedOutput: outputs[0].output,
                resolutionMethod: 'unanimous',
            };
        }

        // Simple similarity check (could be enhanced with embedding comparison)
        const similarities = this.calculateOutputSimilarities(outputs);

        // If all outputs are very similar, return the first one
        if (similarities.every(s => s > 0.8)) {
            return {
                agreed: true,
                mergedOutput: outputs[0].output,
                resolutionMethod: 'unanimous',
            };
        }

        // If majority are similar, use majority approach
        const majorityOutput = this.findMajorityOutput(outputs);
        if (majorityOutput) {
            return {
                agreed: true,
                mergedOutput: majorityOutput,
                resolutionMethod: 'majority',
            };
        }

        // Outputs conflict - need arbitration
        const conflictingPoints = this.identifyConflicts(outputs);

        // Try to merge using an arbitrator model
        const mergedOutput = await this.arbitrate(outputs);
        if (mergedOutput) {
            return {
                agreed: true,
                mergedOutput,
                conflictingPoints,
                resolutionMethod: 'arbitration',
            };
        }

        return {
            agreed: false,
            conflictingPoints,
            resolutionMethod: 'manual',
        };
    }

    // ===== AGENT-13: Multi-Agent Debate =====

    createDebateSession(taskId: string, stepIndex: number, topic: string): DebateSession {
        if (!taskId) {throw new AgentCollaborationError('taskId is required', 'MISSING_TASK_ID');}
        if (!topic) {throw new AgentCollaborationError('topic is required', 'MISSING_TOPIC');}

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

        this.debateSessions.set(session.id, session);
        appLogger.info('AgentCollaboration', `Created debate session: ${session.id}`);
        return session;
    }

    submitDebateArgument(options: {
        sessionId: string;
        agentId: string;
        provider: string;
        side: DebateSide;
        content: string;
        confidence: number;
        citations?: DebateCitation[];
    }): DebateSession | null {
        const session = this.debateSessions.get(options.sessionId);
        if (!session) {
            throw new AgentCollaborationError(`Debate session ${options.sessionId} not found`, 'DEBATE_SESSION_NOT_FOUND');
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
            session.consensus = this.detectDebateConsensus(session.arguments);
            this.getAgentTaskStats(options.agentId).debatesParticipated++;
            this.getAgentTaskStats(options.agentId).totalConfidence += options.confidence;
            this.getAgentTaskStats(options.agentId).confidenceSamples++;

            return session;
        } catch (error) {
            throw new AgentCollaborationError('Invalid debate argument', 'INVALID_DEBATE_ARGUMENT', { error });
        }
    }

    resolveDebateSession(sessionId: string): DebateSession | null {
        const session = this.debateSessions.get(sessionId);
        if (!session) {
            return null;
        }
        session.consensus = this.detectDebateConsensus(session.arguments);
        session.summary = this.createDebateSummaryText(session);
        session.status = 'resolved';
        session.resolvedAt = Date.now();
        return session;
    }

    overrideDebateSession(
        sessionId: string,
        moderatorId: string,
        decision: DebateSide | 'balanced',
        reason?: string
    ): DebateSession | null {
        const session = this.debateSessions.get(sessionId);
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
        session.summary = this.createDebateSummaryText(session);
        session.status = 'resolved';
        session.resolvedAt = Date.now();
        return session;
    }

    getDebateSession(sessionId: string): DebateSession | null {
        return this.debateSessions.get(sessionId) ?? null;
    }

    getDebateHistory(taskId?: string): DebateSession[] {
        const sessions = Array.from(this.debateSessions.values());
        const filtered = taskId ? sessions.filter(session => session.taskId === taskId) : sessions;
        return filtered.sort((left, right) => right.createdAt - left.createdAt);
    }

    getDebateReplay(sessionId: string): DebateReplay | null {
        const session = this.debateSessions.get(sessionId);
        if (!session) {
            return null;
        }
        const timeline = [...session.arguments].sort((left, right) => left.timestamp - right.timestamp);
        return { session, timeline };
    }

    generateDebateSummary(sessionId: string): string | null {
        const session = this.debateSessions.get(sessionId);
        if (!session) {
            return null;
        }
        const summary = this.createDebateSummaryText(session);
        session.summary = summary;
        return summary;
    }

    // ===== AGENT-15: Teamwork Analytics =====

    recordAgentTaskProgress(options: {
        agentId: string;
        status: 'in_progress' | 'completed' | 'failed';
        durationMs?: number;
        confidence?: number;
        taskId?: string;
        reason?: string;
        skills?: string[];
    }): void {
        const { agentId, status, durationMs, confidence } = options;
        if (!agentId) {throw new AgentCollaborationError('agentId is required', 'MISSING_AGENT_ID');}

        const stats = this.getAgentTaskStats(agentId);
        if (status === 'in_progress') {
            stats.inProgressTasks++;
        } else if (status === 'completed') {
            stats.completedTasks++;
            stats.inProgressTasks = Math.max(0, stats.inProgressTasks - 1);
            if (durationMs !== undefined) {
                stats.totalDurationMs += durationMs;
            }
        } else {
            stats.failedTasks++;
            stats.inProgressTasks = Math.max(0, stats.inProgressTasks - 1);
            if (durationMs !== undefined) {
                stats.totalDurationMs += durationMs;
            }
        }
        if (confidence !== undefined) {
            stats.totalConfidence += confidence;
            stats.confidenceSamples++;
        }

        if (options.taskId) {
            if (status === 'in_progress') {
                this.registerWorkerAvailability({
                    taskId: options.taskId,
                    agentId,
                    status: 'busy',
                    reason: options.reason ?? 'Task in progress',
                    skills: options.skills ?? []
                });
            } else {
                this.registerWorkerAvailability({
                    taskId: options.taskId,
                    agentId,
                    status: 'available',
                    reason: options.reason ?? (status === 'completed' ? 'Task completed' : 'Task failed'),
                    skills: options.skills ?? []
                });
            }
        }
    }

    registerWorkerAvailability(input: {
        taskId: string;
        agentId: string;
        status: 'available' | 'busy' | 'offline';
        reason?: string;
        skills?: string[];
        contextReadiness?: number;
    }): WorkerAvailabilityRecord {
        if (!input.taskId) {
            throw new AgentCollaborationError('taskId is required', 'MISSING_TASK_ID');
        }
        if (!input.agentId) {
            throw new AgentCollaborationError('agentId is required', 'MISSING_AGENT_ID');
        }

        const perTask = this.workerAvailability.get(input.taskId) ?? new Map<string, WorkerAvailabilityRecord>();
        const previous = perTask.get(input.agentId);
        const now = Date.now();
        const nextRecord: WorkerAvailabilityRecord = {
            taskId: input.taskId,
            agentId: input.agentId,
            status: input.status,
            availableAt: input.status === 'available' ? (previous?.availableAt ?? now) : undefined,
            lastActiveAt: now,
            reason: input.reason,
            skills: input.skills ?? previous?.skills ?? [],
            contextReadiness: input.contextReadiness ?? previous?.contextReadiness ?? 0.5,
            completedStages: previous?.completedStages ?? 0,
            failedStages: previous?.failedStages ?? 0,
        };

        if (input.status === 'available' && input.reason?.toLowerCase().includes('completed')) {
            nextRecord.completedStages += 1;
        }
        if (input.status === 'available' && input.reason?.toLowerCase().includes('failed')) {
            nextRecord.failedStages += 1;
        }

        perTask.set(input.agentId, nextRecord);
        this.workerAvailability.set(input.taskId, perTask);
        return nextRecord;
    }

    listAvailableWorkers(taskId: string): WorkerAvailabilityRecord[] {
        const perTask = this.workerAvailability.get(taskId);
        if (!perTask) {
            return [];
        }
        return Array.from(perTask.values())
            .filter(record => record.status === 'available')
            .sort((left, right) => (right.availableAt ?? 0) - (left.availableAt ?? 0));
    }

    scoreHelperCandidates(input: {
        taskId: string;
        stageId: string;
        requiredSkills: string[];
        blockedAgentIds?: string[];
        contextReadinessOverrides?: Record<string, number>;
    }): HelperCandidateScore[] {
        const available = this.listAvailableWorkers(input.taskId);
        const blocked = new Set(input.blockedAgentIds ?? []);
        const requiredSkillSet = new Set(input.requiredSkills.map(skill => skill.toLowerCase()));

        const scored = available
            .filter(candidate => !blocked.has(candidate.agentId))
            .map(candidate => {
                const candidateSkills = candidate.skills.map(skill => skill.toLowerCase());
                const matchedSkills = candidateSkills.filter(skill => requiredSkillSet.has(skill)).length;
                const skillMatch = requiredSkillSet.size === 0 ? 1 : matchedSkills / requiredSkillSet.size;
                const contextReadiness = Math.max(
                    0,
                    Math.min(
                        1,
                        input.contextReadinessOverrides?.[candidate.agentId] ?? candidate.contextReadiness
                    )
                );
                const idleMs = Date.now() - (candidate.availableAt ?? candidate.lastActiveAt);
                const idleBonus = Math.max(0, Math.min(1, idleMs / (15 * 60 * 1000)));
                const score = Number((skillMatch * 0.5 + contextReadiness * 0.35 + idleBonus * 0.15).toFixed(4));
                const rationale = [
                    `skillMatch=${skillMatch.toFixed(2)}`,
                    `contextReadiness=${contextReadiness.toFixed(2)}`,
                    `idleBonus=${idleBonus.toFixed(2)}`,
                ];
                return {
                    taskId: input.taskId,
                    stageId: input.stageId,
                    agentId: candidate.agentId,
                    score,
                    skillMatch,
                    contextReadiness,
                    idleBonus,
                    rationale,
                } satisfies HelperCandidateScore;
            })
            .sort((left, right) => right.score - left.score);

        return scored;
    }

    generateHelperHandoffPackage(input: {
        taskId: string;
        stageId: string;
        ownerAgentId: string;
        helperAgentId: string;
        stageGoal: string;
        acceptanceCriteria: string[];
        constraints: string[];
        contextNotes?: string;
    }): HelperHandoffPackage {
        const contextSummaryParts = [
            `Stage goal: ${input.stageGoal}`,
            input.contextNotes ? `Context: ${input.contextNotes}` : '',
            `Owner: ${input.ownerAgentId}`,
            `Helper: ${input.helperAgentId}`,
        ].filter(Boolean);

        return {
            taskId: input.taskId,
            stageId: input.stageId,
            ownerAgentId: input.ownerAgentId,
            helperAgentId: input.helperAgentId,
            contextSummary: contextSummaryParts.join(' | '),
            acceptanceCriteria: [...input.acceptanceCriteria],
            constraints: [...input.constraints],
            generatedAt: Date.now(),
        };
    }

    evaluateHelperMergeGate(input: {
        acceptanceCriteria: string[];
        constraints: string[];
        helperOutput: string;
        reviewerNotes?: string;
    }): HelperMergeGateDecision {
        const normalizedOutput = input.helperOutput.toLowerCase();
        const failedAcceptance = input.acceptanceCriteria.filter(criteria => {
            const token = criteria.trim().toLowerCase();
            return token.length > 0 && !normalizedOutput.includes(token);
        });
        const violatedConstraints = input.constraints.filter(constraint => {
            const token = constraint.trim().toLowerCase();
            return token.length > 0 && normalizedOutput.includes(`violate:${token}`);
        });

        const reasons: string[] = [];
        const requiredFixes: string[] = [];

        if (failedAcceptance.length > 0) {
            reasons.push('Some acceptance criteria are not satisfied in helper output.');
            requiredFixes.push(...failedAcceptance.map(item => `Address acceptance criteria: ${item}`));
        }
        if (violatedConstraints.length > 0) {
            reasons.push('Helper output appears to violate one or more constraints.');
            requiredFixes.push(...violatedConstraints.map(item => `Resolve constraint violation: ${item}`));
        }
        if (input.reviewerNotes && input.reviewerNotes.trim().length > 0) {
            reasons.push(`Reviewer notes: ${input.reviewerNotes.trim()}`);
        }

        const hasHardFailure = failedAcceptance.length > 0 || violatedConstraints.length > 0;
        return {
            accepted: !hasHardFailure,
            verdict: hasHardFailure ? 'REVISE' : 'ACCEPT',
            reasons: hasHardFailure ? reasons : ['Helper contribution passed merge gate checks.'],
            requiredFixes,
            reviewedAt: Date.now(),
        };
    }

    getTeamworkAnalytics(): AgentTeamworkAnalytics {
        const metrics = Array.from(this.agentTaskStats.entries()).map(([agentId, stats]) => {
            const doneOrFailed = stats.completedTasks + stats.failedTasks;
            const completionRate = doneOrFailed === 0 ? 0 : (stats.completedTasks / doneOrFailed) * 100;
            return {
                agentId,
                completedTasks: stats.completedTasks,
                failedTasks: stats.failedTasks,
                inProgressTasks: stats.inProgressTasks,
                averageTaskDurationMs: doneOrFailed === 0 ? 0 : stats.totalDurationMs / doneOrFailed,
                completionRate
            };
        });

        const totalAgents = Math.max(1, metrics.length);
        let totalVotes = 0;
        let totalDebates = 0;
        let totalAligned = 0;
        const efficiencyScores: Record<string, number> = {};
        const healthSignals: AgentTeamworkAnalytics['healthSignals'] = [];

        for (const [agentId, stats] of this.agentTaskStats.entries()) {
            totalVotes += stats.votesParticipated;
            totalDebates += stats.debatesParticipated;
            totalAligned += stats.consensusAligned;
            const doneOrFailed = stats.completedTasks + stats.failedTasks;
            const completionRate = doneOrFailed === 0 ? 0 : stats.completedTasks / doneOrFailed;
            const avgConfidence = stats.confidenceSamples === 0 ? 0.5 : stats.totalConfidence / stats.confidenceSamples / 100;
            const efficiency = Math.max(0, Math.min(1, completionRate * 0.7 + avgConfidence * 0.3));
            efficiencyScores[agentId] = efficiency;
            const failureRate = doneOrFailed === 0 ? 0 : stats.failedTasks / doneOrFailed;
            healthSignals.push({
                agentId,
                status: failureRate > 0.4 ? 'critical' : failureRate > 0.2 ? 'warning' : 'healthy',
                failureRate,
                averageConfidence: avgConfidence
            });
        }

        const resourceAllocationInsights = Object.entries(efficiencyScores)
            .sort((left, right) => right[1] - left[1])
            .slice(0, 3)
            .map(([agentId, score]) => `Prioritize ${agentId} for high-impact tasks (efficiency ${(score * 100).toFixed(1)}%).`);

        return {
            perAgentMetrics: metrics,
            collaborationPatterns: {
                votingParticipationRate: totalVotes / totalAgents,
                debateParticipationRate: totalDebates / totalAgents,
                consensusAlignmentRate: totalDebates === 0 ? 0 : totalAligned / totalDebates
            },
            efficiencyScores,
            resourceAllocationInsights,
            healthSignals,
            comparisonReport: this.createComparisonReport(metrics, efficiencyScores),
            productivityRecommendations: this.createProductivityRecommendations(healthSignals),
            updatedAt: Date.now()
        };
    }

    createCollaborationMessage(input: {
        taskId: string;
        stageId: string;
        fromAgentId: string;
        toAgentId?: string;
        intent: AgentCollaborationIntent;
        priority?: AgentCollaborationPriority;
        payload: Record<string, string | number | boolean | null>;
        expiresAt?: number;
    }): AgentCollaborationMessage {
        this.validateCollaborationIntent(input.intent);

        if (!input.taskId) {
            throw new AgentCollaborationError('taskId is required', 'MISSING_TASK_ID');
        }
        if (!input.stageId) {
            throw new AgentCollaborationError('stageId is required', 'MISSING_STAGE_ID');
        }
        if (!input.fromAgentId) {
            throw new AgentCollaborationError('fromAgentId is required', 'MISSING_AGENT_ID');
        }

        return {
            id: randomUUID(),
            taskId: input.taskId,
            stageId: input.stageId,
            fromAgentId: input.fromAgentId,
            toAgentId: input.toAgentId,
            channel: input.toAgentId ? 'private' : 'group',
            intent: input.intent,
            priority: input.priority ?? 'normal',
            payload: input.payload,
            createdAt: Date.now(),
            expiresAt: input.expiresAt
        };
    }

    sendCollaborationMessage(input: {
        taskId: string;
        stageId: string;
        fromAgentId: string;
        toAgentId?: string;
        intent: AgentCollaborationIntent;
        priority?: AgentCollaborationPriority;
        payload: Record<string, string | number | boolean | null>;
        expiresAt?: number;
    }): AgentCollaborationMessage {
        this.validateCollaborationPayload(input.payload);
        this.enforceCollaborationAntiLoop(input);
        const message = this.createCollaborationMessage(input);
        const taskMessages = this.collaborationMessages.get(message.taskId) ?? [];
        this.collaborationMessages.set(message.taskId, [...taskMessages, message]);
        return message;
    }

    getCollaborationMessages(options: {
        taskId: string;
        stageId?: string;
        agentId?: string;
        includeExpired?: boolean;
    }): AgentCollaborationMessage[] {
        const allTaskMessages = this.collaborationMessages.get(options.taskId) ?? [];
        const now = Date.now();

        return allTaskMessages.filter(message => {
            if (!options.includeExpired && message.expiresAt !== undefined && message.expiresAt <= now) {
                return false;
            }
            if (options.stageId && message.stageId !== options.stageId) {
                return false;
            }
            if (!options.agentId) {
                return true;
            }
            if (message.channel === 'group') {
                return true;
            }
            return message.fromAgentId === options.agentId || message.toAgentId === options.agentId;
        });
    }

    cleanupExpiredCollaborationMessages(taskId?: string): number {
        const now = Date.now();
        let removedCount = 0;
        const targetTaskIds = taskId
            ? [taskId]
            : Array.from(this.collaborationMessages.keys());

        for (const currentTaskId of targetTaskIds) {
            const currentMessages = this.collaborationMessages.get(currentTaskId);
            if (!currentMessages || currentMessages.length === 0) {
                continue;
            }
            const filtered = currentMessages.filter(
                message => message.expiresAt === undefined || message.expiresAt > now
            );
            removedCount += currentMessages.length - filtered.length;
            if (filtered.length === 0) {
                this.collaborationMessages.delete(currentTaskId);
            } else {
                this.collaborationMessages.set(currentTaskId, filtered);
            }
        }

        return removedCount;
    }

    restoreCollaborationMessages(
        taskId: string,
        messages: AgentCollaborationMessage[]
    ): void {
        this.collaborationMessages.set(taskId, [...messages]);
    }

    private validateCollaborationIntent(intent: AgentCollaborationIntent): void {
        if (!AGENT_COLLABORATION_INTENTS.includes(intent)) {
            throw new AgentCollaborationError(
                `Unsupported collaboration intent: ${intent}`,
                'INVALID_COLLABORATION_INTENT',
                { intent }
            );
        }
    }

    private validateCollaborationPayload(
        payload: Record<string, string | number | boolean | null>
    ): void {
        const keys = Object.keys(payload);
        if (keys.length > MAX_COLLABORATION_PAYLOAD_KEYS) {
            throw new AgentCollaborationError(
                `Collaboration payload has too many keys (${keys.length})`,
                'COLLABORATION_PAYLOAD_TOO_LARGE',
                { keyCount: keys.length }
            );
        }

        for (const [key, value] of Object.entries(payload)) {
            if (key.length > 120) {
                throw new AgentCollaborationError(
                    `Collaboration payload key is too long (${key.length})`,
                    'COLLABORATION_PAYLOAD_KEY_TOO_LONG',
                    { key }
                );
            }
            if (typeof value === 'string' && value.length > MAX_COLLABORATION_STRING_LENGTH) {
                throw new AgentCollaborationError(
                    `Collaboration payload value for "${key}" is too long (${value.length})`,
                    'COLLABORATION_PAYLOAD_VALUE_TOO_LONG',
                    { key, length: value.length }
                );
            }
        }
    }

    private enforceCollaborationAntiLoop(input: {
        taskId: string;
        fromAgentId: string;
        toAgentId?: string;
        intent: AgentCollaborationIntent;
        payload: Record<string, string | number | boolean | null>;
    }): void {
        const recent = this.collaborationMessages.get(input.taskId) ?? [];
        const now = Date.now();
        const signature = this.buildCollaborationSignature(input);
        let repeatedCount = 0;

        for (let index = recent.length - 1; index >= 0; index -= 1) {
            const message = recent[index];
            if (now - message.createdAt > COLLABORATION_LOOP_WINDOW_MS) {
                break;
            }
            const messageSignature = this.buildCollaborationSignature({
                taskId: message.taskId,
                fromAgentId: message.fromAgentId,
                toAgentId: message.toAgentId,
                intent: message.intent,
                payload: message.payload
            });
            if (messageSignature === signature) {
                repeatedCount += 1;
                if (repeatedCount >= COLLABORATION_LOOP_THRESHOLD) {
                    throw new AgentCollaborationError(
                        'Repeated collaboration request detected; escalation required',
                        'COLLABORATION_LOOP_DETECTED',
                        { taskId: input.taskId, intent: input.intent, repeatedCount }
                    );
                }
            }
        }
    }

    private buildCollaborationSignature(input: {
        taskId: string;
        fromAgentId: string;
        toAgentId?: string;
        intent: AgentCollaborationIntent;
        payload: Record<string, string | number | boolean | null>;
    }): string {
        const payloadEntries = Object.entries(input.payload)
            .sort((left, right) => left[0].localeCompare(right[0]))
            .map(([key, value]) => `${key}:${String(value)}`)
            .join('|');
        return `${input.taskId}::${input.fromAgentId}::${input.toAgentId ?? 'group'}::${input.intent}::${payloadEntries}`;
    }

    private getAgentTaskStats(agentId: string): {
        completedTasks: number;
        failedTasks: number;
        inProgressTasks: number;
        totalDurationMs: number;
        totalConfidence: number;
        confidenceSamples: number;
        votesParticipated: number;
        debatesParticipated: number;
        consensusAligned: number;
    } {
        const existing = this.agentTaskStats.get(agentId);
        if (existing) {
            return existing;
        }
        const initial = {
            completedTasks: 0,
            failedTasks: 0,
            inProgressTasks: 0,
            totalDurationMs: 0,
            totalConfidence: 0,
            confidenceSamples: 0,
            votesParticipated: 0,
            debatesParticipated: 0,
            consensusAligned: 0
        };
        this.agentTaskStats.set(agentId, initial);
        return initial;
    }

    private scoreArgumentQuality(content: string, confidence: number, citations: DebateCitation[]): number {
        const normalizedLength = Math.min(1, content.trim().length / 400);
        const confidenceScore = Math.max(0, Math.min(1, confidence / 100));
        const citationScore = Math.min(1, citations.length / 3);
        return Number((normalizedLength * 0.4 + confidenceScore * 0.4 + citationScore * 0.2).toFixed(3));
    }

    private detectDebateConsensus(argumentsList: DebateArgument[]): DebateConsensus {
        if (argumentsList.length === 0) {
            return {
                detected: false,
                confidence: 0,
                rationale: 'No arguments submitted'
            };
        }

        let proScore = 0;
        let conScore = 0;
        for (const argument of argumentsList) {
            const scoreWeight = argument.qualityScore * (argument.confidence / 100);
            if (argument.side === 'pro') {
                proScore += scoreWeight;
            } else {
                conScore += scoreWeight;
            }
        }

        const total = proScore + conScore;
        const delta = Math.abs(proScore - conScore);
        const confidence = total === 0 ? 0 : delta / total;
        if (confidence < 0.15) {
            return {
                detected: true,
                winningSide: 'balanced',
                confidence: Number(confidence.toFixed(3)),
                rationale: 'Arguments are balanced'
            };
        }
        const winningSide: DebateSide = proScore >= conScore ? 'pro' : 'con';
        for (const argument of argumentsList) {
            if (argument.side === winningSide) {
                this.getAgentTaskStats(argument.agentId).consensusAligned++;
            }
        }
        return {
            detected: true,
            winningSide,
            confidence: Number(confidence.toFixed(3)),
            rationale: `Higher weighted score on ${winningSide} side`
        };
    }

    private createDebateSummaryText(session: DebateSession): string {
        const totalArguments = session.arguments.length;
        const averageQuality = totalArguments === 0
            ? 0
            : session.arguments.reduce((sum, item) => sum + item.qualityScore, 0) / totalArguments;
        const totalCitations = session.arguments.reduce((sum, item) => sum + item.citations.length, 0);
        const decision = session.moderatorOverride?.decision
            ?? session.consensus.winningSide
            ?? 'undecided';
        return `Debate on "${session.topic}" recorded ${totalArguments} arguments, ${totalCitations} citations, average quality ${averageQuality.toFixed(2)}. Decision: ${decision}.`;
    }

    private createComparisonReport(
        metrics: AgentTeamworkAnalytics['perAgentMetrics'],
        efficiencyScores: Record<string, number>
    ): string {
        if (metrics.length === 0) {
            return 'No agent teamwork data available yet.';
        }
        const ranked = [...metrics].sort((left, right) => {
            const leftScore = efficiencyScores[left.agentId] ?? 0;
            const rightScore = efficiencyScores[right.agentId] ?? 0;
            return rightScore - leftScore;
        });
        const top = ranked[0];
        const topScore = (efficiencyScores[top.agentId] ?? 0) * 100;
        return `Top performer: ${top.agentId} (${topScore.toFixed(1)}% efficiency). Compared ${metrics.length} agents.`;
    }

    private createProductivityRecommendations(
        healthSignals: AgentTeamworkAnalytics['healthSignals']
    ): string[] {
        const recommendations: string[] = [];
        const critical = healthSignals.filter(signal => signal.status === 'critical');
        if (critical.length > 0) {
            recommendations.push(`Reduce task load for ${critical.map(item => item.agentId).join(', ')} until failure rate improves.`);
        }
        if (healthSignals.length > 0 && recommendations.length === 0) {
            recommendations.push('Maintain current task distribution and continue monitoring debate participation.');
        }
        return recommendations;
    }

    /**
     * Calculate pairwise similarities between outputs
     */
    private calculateOutputSimilarities(
        outputs: Array<{ output: string }>
    ): number[] {
        const similarities: number[] = [];

        for (let i = 0; i < outputs.length; i++) {
            for (let j = i + 1; j < outputs.length; j++) {
                const similarity = this.calculateStringSimilarity(
                    outputs[i].output,
                    outputs[j].output
                );
                similarities.push(similarity);
            }
        }

        return similarities;
    }

    /**
     * Simple string similarity (Jaccard on words)
     */
    private calculateStringSimilarity(a: string, b: string): number {
        const wordsA = new Set(a.toLowerCase().split(/\s+/));
        const wordsB = new Set(b.toLowerCase().split(/\s+/));

        const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
        const union = new Set([...wordsA, ...wordsB]);

        return intersection.size / union.size;
    }

    /**
     * Find if there's a majority output
     */
    private findMajorityOutput(
        outputs: Array<{ output: string }>
    ): string | null {
        const groups: Map<number, string[]> = new Map();

        for (let i = 0; i < outputs.length; i++) {
            let foundGroup = false;
            for (const [, members] of groups) {
                const similarity = this.calculateStringSimilarity(
                    outputs[i].output,
                    members[0]
                );
                if (similarity > 0.7) {
                    members.push(outputs[i].output);
                    foundGroup = true;
                    break;
                }
            }
            if (!foundGroup) {
                groups.set(i, [outputs[i].output]);
            }
        }

        // Find largest group
        let maxSize = 0;
        let majorityOutput: string | null = null;
        for (const members of groups.values()) {
            if (members.length > maxSize && members.length > outputs.length / 2) {
                maxSize = members.length;
                majorityOutput = members[0];
            }
        }

        return majorityOutput;
    }

    /**
     * Identify conflicting points between outputs
     */
    private identifyConflicts(
        outputs: Array<{ modelId: string; output: string }>
    ): ConsensusResult['conflictingPoints'] {
        // Simplified conflict identification
        // In a real implementation, this would use NLP to identify semantic differences
        return [{
            topic: 'Overall approach',
            outputs: outputs.map(o => ({ modelId: o.modelId, output: o.output.substring(0, 200) })),
        }];
    }

    /**
     * Use an arbitrator model to merge conflicting outputs
     */
    private async arbitrate(
        outputs: Array<{ modelId: string; provider: string; output: string }>
    ): Promise<string | null> {
        const prompt = `You are an arbitrator merging multiple AI outputs. Analyze these outputs and create a unified, best-of-both response:

${outputs.map((o, i) => `Output ${i + 1} (from ${o.modelId}):
${o.output}
`).join('\n---\n')}

Create a merged output that:
1. Incorporates the best elements from each output
2. Resolves any conflicting information
3. Maintains accuracy and completeness

Merged output:`;

        try {
            const response = await this.deps.llm.chat(
                [{ id: randomUUID(), role: 'user', content: prompt, timestamp: new Date() }],
                'claude-3-5-sonnet-20241022',
                [],
                'anthropic'
            );

            return typeof response.content === 'string' ? response.content : null;
        } catch (error) {
            appLogger.error('AgentCollaboration', 'Arbitration failed', error as Error);
            return null;
        }
    }
}

// Singleton instance
let instance: AgentCollaborationService | null = null;

export function getAgentCollaborationService(deps: AgentCollaborationDependencies): AgentCollaborationService {
    instance ??= new AgentCollaborationService(deps);
    return instance;
}
