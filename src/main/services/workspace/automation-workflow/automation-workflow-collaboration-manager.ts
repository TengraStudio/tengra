import { DatabaseService } from '@main/services/data/database.service';
import { AgentCollaborationService } from '@main/services/workspace/automation-workflow/agent-collaboration.service';
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
    VotingAnalytics,
    VotingConfiguration,
    VotingSession,
    VotingTemplate,
    WorkerAvailabilityRecord,
} from '@shared/types/automation-workflow';
import { safeJsonParse } from '@shared/utils/sanitize.util';

interface AutomationWorkflowCollaborationManagerDeps {
    databaseService: DatabaseService;
    collaborationService: AgentCollaborationService;
}

export class AutomationWorkflowCollaborationManager {
    constructor(private readonly deps: AutomationWorkflowCollaborationManagerDeps) { }

    getRoutingRules(): ModelRoutingRule[] {
        return this.deps.collaborationService.getRoutingRules();
    }

    setRoutingRules(rules: ModelRoutingRule[]): void {
        this.deps.collaborationService.setRoutingRules(rules);
    }

    createVotingSession(taskId: string, stepIndex: number, question: string, options: string[]): VotingSession {
        return this.deps.collaborationService.createVotingSession(taskId, stepIndex, question, options);
    }

    async submitVote(options: {
        sessionId: string;
        modelId: string;
        provider: string;
        decision: string;
        confidence: number;
        reasoning?: string;
    }): Promise<VotingSession | null> {
        return await this.deps.collaborationService.submitVote(options);
    }

    async requestVotes(
        sessionId: string,
        models: Array<{ provider: string; model: string }>
    ): Promise<VotingSession | null> {
        return await this.deps.collaborationService.requestVotes(sessionId, models);
    }

    resolveVoting(sessionId: string): VotingSession | null {
        return this.deps.collaborationService.resolveVoting(sessionId);
    }

    getVotingSession(sessionId: string): VotingSession | null {
        return this.deps.collaborationService.getVotingSession(sessionId);
    }

    getVotingSessions(taskId?: string): VotingSession[] {
        return this.deps.collaborationService.getVotingSessions(taskId);
    }

    overrideVotingDecision(sessionId: string, finalDecision: string, reason?: string): VotingSession | null {
        return this.deps.collaborationService.overrideVotingDecision(sessionId, finalDecision, reason);
    }

    getVotingAnalytics(taskId?: string): VotingAnalytics {
        return this.deps.collaborationService.getVotingAnalytics(taskId);
    }

    getVotingConfiguration(): VotingConfiguration {
        return this.deps.collaborationService.getVotingConfiguration();
    }

    updateVotingConfiguration(patch: Partial<VotingConfiguration>): VotingConfiguration {
        return this.deps.collaborationService.updateVotingConfiguration(patch);
    }

    getVotingTemplates(): VotingTemplate[] {
        return this.deps.collaborationService.getVotingTemplates();
    }

    async buildConsensus(
        outputs: Array<{ modelId: string; provider: string; output: string }>
    ): Promise<ConsensusResult> {
        return await this.deps.collaborationService.buildConsensus(
            outputs.map(output => ({ model: output.modelId, output: output.output }))
        );
    }

    createDebateSession(taskId: string, stepIndex: number, topic: string): DebateSession {
        return this.deps.collaborationService.createDebateSession(taskId, stepIndex, topic);
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
        return this.deps.collaborationService.submitDebateArgument(options);
    }

    resolveDebateSession(sessionId: string): DebateSession | null {
        return this.deps.collaborationService.resolveDebateSession(sessionId);
    }

    overrideDebateSession(
        sessionId: string,
        moderatorId: string,
        decision: DebateSide | 'balanced',
        reason?: string
    ): DebateSession | null {
        return this.deps.collaborationService.overrideDebateSession(sessionId, moderatorId, decision, reason);
    }

    getDebateSession(sessionId: string): DebateSession | null {
        return this.deps.collaborationService.getDebateSession(sessionId);
    }

    getDebateHistory(taskId?: string): DebateSession[] {
        return this.deps.collaborationService.getDebateHistory(taskId);
    }

    getDebateReplay(sessionId: string): DebateReplay | null {
        return this.deps.collaborationService.getDebateReplay(sessionId);
    }

    generateDebateSummary(sessionId: string): string | null {
        return this.deps.collaborationService.generateDebateSummary(sessionId);
    }

    getTeamworkAnalytics(): AgentTeamworkAnalytics {
        return this.deps.collaborationService.getTeamworkAnalytics();
    }

    async sendCollaborationMessage(input: {
        taskId: string;
        stageId: string;
        fromAgentId: string;
        toAgentId?: string;
        intent: AgentCollaborationIntent;
        priority?: AgentCollaborationPriority;
        payload: Record<string, string | number | boolean | null>;
        expiresAt?: number;
    }): Promise<AgentCollaborationMessage> {
        const message = this.deps.collaborationService.sendCollaborationMessage(input);
        await this.deps.databaseService.uac.addCollaborationMessage(message);
        return message;
    }

    registerWorkerAvailability(input: {
        taskId: string;
        agentId: string;
        status: 'available' | 'busy' | 'offline';
        reason?: string;
        skills?: string[];
        contextReadiness?: number;
    }): WorkerAvailabilityRecord {
        return this.deps.collaborationService.registerWorkerAvailability(input);
    }

    listAvailableWorkers(taskId: string): WorkerAvailabilityRecord[] {
        return this.deps.collaborationService.listAvailableWorkers(taskId);
    }

    scoreHelperCandidates(input: {
        taskId: string;
        stageId: string;
        requiredSkills: string[];
        blockedAgentIds?: string[];
        contextReadinessOverrides?: Record<string, number>;
    }): HelperCandidateScore[] {
        return this.deps.collaborationService.scoreHelperCandidates(input);
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
        return this.deps.collaborationService.generateHelperHandoffPackage(input);
    }

    reviewHelperMergeGate(input: {
        acceptanceCriteria: string[];
        constraints: string[];
        helperOutput: string;
        reviewerNotes?: string;
    }): HelperMergeGateDecision {
        return this.deps.collaborationService.evaluateHelperMergeGate(input);
    }

    async getCollaborationMessages(input: {
        taskId: string;
        stageId?: string;
        agentId?: string;
        includeExpired?: boolean;
    }): Promise<AgentCollaborationMessage[]> {
        await this.ensureCollaborationMessagesLoaded(input.taskId);
        return this.deps.collaborationService.getCollaborationMessages(input);
    }

    async cleanupExpiredCollaborationMessages(taskId?: string): Promise<number> {
        await this.ensureCollaborationMessagesLoaded(taskId);
        const removedFromMemory = this.deps.collaborationService.cleanupExpiredCollaborationMessages(taskId);
        const removedFromDb = await this.deps.databaseService.uac.deleteExpiredCollaborationMessages(taskId);
        return Math.max(removedFromMemory, removedFromDb);
    }

    private async ensureCollaborationMessagesLoaded(taskId?: string): Promise<void> {
        if (!taskId) {
            return;
        }
        const existing = this.deps.collaborationService.getCollaborationMessages({
            taskId,
            includeExpired: true
        });
        if (existing.length > 0) {
            return;
        }
        await this.restoreCollaborationMessagesForTask(taskId);
    }

    private async restoreCollaborationMessagesForTask(taskId: string): Promise<void> {
        const rows = await this.deps.databaseService.uac.getCollaborationMessages(taskId);
        const messages: AgentCollaborationMessage[] = rows.map(row => ({
            id: row.id,
            taskId: row.task_id,
            stageId: row.stage_id,
            fromAgentId: row.from_agent_id,
            toAgentId: row.to_agent_id,
            channel: row.channel,
            intent: row.intent as AgentCollaborationIntent,
            priority: row.priority as AgentCollaborationPriority,
            payload: safeJsonParse<Record<string, string | number | boolean | null>>(row.payload_json, {}),
            createdAt: row.created_at,
            expiresAt: row.expires_at
        }));
        this.deps.collaborationService.restoreCollaborationMessages(taskId, messages);
    }
}
