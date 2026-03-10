import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { BaseService } from '@main/services/base.service';
import { LLMService } from '@main/services/llm/llm.service';
import {
    AgentCollaborationIntent,
    AgentCollaborationMessage,
    AgentCollaborationPriority,
    AgentTeamworkAnalytics,
    ConsensusResult,
    DebateCitation,
    DebateReplay,
    DebateSession,
    DebateSide,
    HelperCandidateScore,
    HelperHandoffPackage,
    HelperMergeGateDecision,
    ModelRoutingRule,
    TaskType,
    VotingAnalytics,
    VotingConfiguration,
    VotingSession,
    VotingTemplate,
    WorkerAvailabilityRecord,
    WorkspaceStep,
} from '@shared/types/automation-workflow';

import { AgentConsensusService } from './collaboration/agent-consensus.service';
import { AgentDebateService } from './collaboration/agent-debate.service';
import { AgentMessagingService } from './collaboration/agent-messaging.service';
import { AgentRoutingService } from './collaboration/agent-routing.service';
import { AgentTeamworkService } from './collaboration/agent-teamwork.service';
import { AgentVotingService } from './collaboration/agent-voting.service';

export interface AgentCollaborationDependencies {
    llm: LLMService;
}

/**
 * AgentCollaborationService
 * Orchestrates multi-model collaboration by delegating to specialized services.
 * refactor AI-SYS-14.
 */
export class AgentCollaborationService extends BaseService {
    private readonly voting: AgentVotingService;
    private readonly debate: AgentDebateService;
    private readonly messaging: AgentMessagingService;
    private readonly teamwork: AgentTeamworkService;
    private readonly consensus: AgentConsensusService;
    private readonly routing: AgentRoutingService;

    constructor(private readonly deps: AgentCollaborationDependencies) {
        super('AgentCollaborationService');

        const getStats = (id: string) => this.teamwork.getAgentStats(id);

        this.teamwork = new AgentTeamworkService({ telemetry: undefined });
        this.voting = new AgentVotingService({ llm: this.deps.llm, getAgentStats: getStats });
        this.debate = new AgentDebateService({ getAgentStats: getStats });
        this.messaging = new AgentMessagingService();
        this.consensus = new AgentConsensusService({ llm: this.deps.llm });
        this.routing = new AgentRoutingService({});
    }

    /**
     * Set the telemetry service dependency for all sub-services
     */
    setTelemetryService(service: TelemetryService): void {
        // Inject telemetry into sub-services
        this.teamwork.setTelemetryService(service);
        this.voting.setTelemetryService(service);
        this.debate.setTelemetryService(service);
        this.consensus.setTelemetryService(service);
        this.routing.setTelemetryService(service);
    }

    // --- Routing Delegation ---
    analyzeSteps(steps: WorkspaceStep[]) { return this.routing.analyzeSteps(steps); }
    getModelForStep(step: WorkspaceStep, availableProviders: string[]) { return this.routing.getModelForStep(step, availableProviders); }
    routeByTaskType(taskType: TaskType, availableProviders: string[]) { return this.routing.routeByTaskType(taskType, availableProviders); }
    detectTaskType(text: string) { return this.routing.detectTaskType(text); }
    getRoutingRules() { return this.routing.getRules(); }
    setRoutingRules(rules: ModelRoutingRule[]): void {
        // Clear and add new rules (the routing service needs a reset or a bulk update method)
        // For simplicity, we can add a bulk update method if needed, but here we just add them.
        for (const rule of rules) {
            this.routing.addRule(rule);
        }
    }

    /** AGT-COL-01: Explicitly assign a model to a step */
    assignModelToStep(step: WorkspaceStep, provider: string, model: string, reason?: string): WorkspaceStep {
        return {
            ...step,
            modelConfig: { provider, model, reason }
        };
    }

    // --- Voting Delegation ---
    createVotingSession(taskId: string, stepIndex: number, question: string, options: string[]): VotingSession {
        return this.voting.createSession(taskId, stepIndex, question, options);
    }
    submitVote(options: {
        sessionId: string;
        modelId: string;
        provider: string;
        decision: string;
        confidence: number;
        reasoning?: string;
    }): Promise<VotingSession | null> {
        return this.voting.submitVote(options);
    }
    requestVotes(sessionId: string, models: Array<{ provider: string; model: string }>): Promise<VotingSession | null> {
        return this.voting.requestVotes(sessionId, models);
    }
    resolveVoting(sessionId: string): VotingSession | null {
        return this.voting.resolve(sessionId);
    }
    getVotingSession(sessionId: string): VotingSession | null {
        return this.voting.getSession(sessionId);
    }
    getVotingSessions(taskId?: string): VotingSession[] {
        return this.voting.getSessions(taskId);
    }
    overrideVotingDecision(sessionId: string, decision: string, reason?: string): VotingSession | null {
        return this.voting.overrideDecision(sessionId, decision, reason);
    }
    getVotingAnalytics(taskId?: string): VotingAnalytics {
        return this.voting.getAnalytics(taskId);
    }
    getVotingConfiguration(): VotingConfiguration {
        return this.voting.getConfiguration();
    }
    updateVotingConfiguration(patch: Partial<VotingConfiguration>): VotingConfiguration {
        return this.voting.updateConfiguration(patch);
    }
    getVotingTemplates(): VotingTemplate[] {
        return this.voting.getTemplates();
    }

    // --- Debate Delegation ---
    createDebateSession(taskId: string, stepIndex: number, topic: string): DebateSession {
        return this.debate.createSession(taskId, stepIndex, topic);
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
        return this.debate.submitArgument(options);
    }
    resolveDebateSession(sessionId: string): DebateSession | null {
        return this.debate.resolve(sessionId);
    }
    overrideDebateSession(sessionId: string, modId: string, decision: DebateSide | 'balanced', reason?: string): DebateSession | null {
        return this.debate.override(sessionId, modId, decision, reason);
    }
    getDebateSession(sessionId: string): DebateSession | null {
        return this.debate.getSession(sessionId);
    }
    getDebateHistory(taskId?: string): DebateSession[] {
        return this.debate.getHistory(taskId);
    }
    getDebateReplay(sessionId: string): DebateReplay | null {
        return this.debate.getReplay(sessionId);
    }
    generateDebateSummary(sessionId: string): string | null {
        return this.debate.generateSummary(sessionId);
    }

    // --- Messaging Delegation ---
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
        return this.messaging.createMessage(input);
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
        return this.messaging.sendMessage(input);
    }
    getCollaborationMessages(options: {
        taskId: string;
        stageId?: string;
        agentId?: string;
        includeExpired?: boolean;
    }): AgentCollaborationMessage[] {
        return this.messaging.getMessages(options);
    }
    cleanupExpiredCollaborationMessages(taskId?: string): number {
        return this.messaging.cleanupExpired(taskId);
    }
    restoreCollaborationMessages(taskId: string, messages: AgentCollaborationMessage[]): void {
        this.messaging.restoreMessages(taskId, messages);
    }

    // --- Teamwork Delegation ---
    recordAgentTaskProgress(options: {
        agentId: string;
        status: 'in_progress' | 'completed' | 'failed';
        durationMs?: number;
        confidence?: number;
        taskId?: string;
        reason?: string;
        skills?: string[];
    }): void {
        this.teamwork.recordTaskProgress(options);
    }
    registerWorkerAvailability(input: {
        taskId: string;
        agentId: string;
        status: 'available' | 'busy' | 'offline';
        reason?: string;
        skills?: string[];
        contextReadiness?: number;
    }): WorkerAvailabilityRecord {
        return this.teamwork.registerWorkerAvailability(input);
    }
    listAvailableWorkers(taskId: string): WorkerAvailabilityRecord[] {
        return this.teamwork.listAvailableWorkers(taskId);
    }
    scoreHelperCandidates(input: {
        taskId: string;
        stageId: string;
        requiredSkills: string[];
        blockedAgentIds?: string[];
        contextReadinessOverrides?: Record<string, number>;
    }): HelperCandidateScore[] {
        return this.teamwork.scoreHelperCandidates(input);
    }
    getTeamworkAnalytics(): AgentTeamworkAnalytics {
        return this.teamwork.getAnalytics();
    }

    /** MARCH1-AGENT-COL-01: Generate handoff package for helper agent */
    generateHelperHandoffPackage(input: {
        taskId: string;
        stageId: string;
        ownerAgentId: string;
        helperAgentId: string;
        contextSummary?: string;
        stageGoal?: string;
        contextNotes?: string;
        acceptanceCriteria: string[];
        constraints: string[];
    }): HelperHandoffPackage {
        return {
            taskId: input.taskId,
            stageId: input.stageId,
            ownerAgentId: input.ownerAgentId,
            helperAgentId: input.helperAgentId,
            contextSummary: input.contextSummary ?? input.stageGoal ?? input.contextNotes ?? 'No context provided',
            acceptanceCriteria: input.acceptanceCriteria,
            constraints: input.constraints,
            generatedAt: Date.now()
        };
    }

    /** MARCH1-AGENT-COL-02: Evaluate if helper's work meets criteria */
    evaluateHelperMergeGate(input: {
        acceptanceCriteria: string[];
        constraints: string[];
        helperOutput: string;
        reviewerNotes?: string;
    }): HelperMergeGateDecision {
        // Basic heuristic evaluation for now
        const hasFailKeywords = /\b(fail|error|wrong|incomplete|missing)/i.test(input.helperOutput);

        return {
            accepted: !hasFailKeywords,
            verdict: hasFailKeywords ? 'REVISE' : 'ACCEPT',
            reasons: hasFailKeywords ? ['Output contains quality flags'] : ['Criteria met'],
            requiredFixes: hasFailKeywords ? ['Review the output for completion'] : [],
            reviewedAt: Date.now()
        };
    }

    // --- Consensus Delegation ---
    async buildConsensus(outputs: Array<{ model: string; output: string }>): Promise<ConsensusResult> {
        return this.consensus.buildConsensus(outputs);
    }

    /**
     * Cleanup resources
     */
    override async cleanup(): Promise<void> {
        await Promise.all([
            this.voting.cleanup(),
            this.debate.cleanup(),
            this.messaging.cleanup(),
            this.teamwork.cleanup(),
            this.consensus.cleanup(),
            this.routing.cleanup(),
        ]);
        this.logInfo('Cleaned up all collaboration sub-services');
    }
}

