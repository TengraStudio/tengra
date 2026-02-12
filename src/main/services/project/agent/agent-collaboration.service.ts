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
    ConsensusResult,
    ModelRoutingRule,
    ProjectStep,
    StepModelConfig,
    TaskType,
    VotingSession,
} from '@shared/types/project-agent';

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

export interface AgentCollaborationDependencies {
    llm: LLMService;
}

export class AgentCollaborationService extends BaseService {
    private routingRules: ModelRoutingRule[] = [...DEFAULT_ROUTING_RULES];
    private votingSessions: Map<string, VotingSession> = new Map();

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
        this.routingRules = [...rules];
        appLogger.info('AgentCollaboration', `Updated routing rules: ${rules.length} rules`);
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

        this.votingSessions.set(session.id, session);
        appLogger.info('AgentCollaboration', `Created voting session: ${session.id} - "${question}"`);

        return session;
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
            return null;
        }

        // Check if this model already voted
        const existingVoteIndex = session.votes.findIndex(v => v.modelId === modelId);
        if (existingVoteIndex >= 0) {
            session.votes[existingVoteIndex] = {
                modelId,
                provider,
                decision,
                confidence,
                reasoning,
                timestamp: Date.now(),
            };
        } else {
            session.votes.push({
                modelId,
                provider,
                decision,
                confidence,
                reasoning,
                timestamp: Date.now(),
            });
        }

        session.status = 'voting';
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
            .filter(([, weight]) => weight >= maxWeight * 0.9);

        if (topDecisions.length > 1) {
            session.status = 'deadlocked';
            appLogger.warn('AgentCollaboration', `Voting deadlock: ${topDecisions.map(d => d[0]).join(' vs ')}`);
        } else {
            session.status = 'resolved';
            session.finalDecision = winner;
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
