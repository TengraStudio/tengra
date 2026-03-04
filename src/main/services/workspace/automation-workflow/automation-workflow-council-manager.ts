import { DatabaseService } from '@main/services/data/database.service';
import { AutomationWorkflowCollaborationManager } from '@main/services/workspace/automation-workflow/automation-workflow-collaboration-manager';
import { AutomationWorkflowTaskManager } from '@main/services/workspace/automation-workflow/automation-workflow-task-manager';
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

export interface AutomationWorkflowCouncilManagerDependencies {
    databaseService: DatabaseService;
    collaborationManager: AutomationWorkflowCollaborationManager;
    taskManager: AutomationWorkflowTaskManager;
}

export class AutomationWorkflowCouncilManager {
    private readonly databaseService: DatabaseService;
    private readonly collaborationManager: AutomationWorkflowCollaborationManager;
    private readonly taskManager: AutomationWorkflowTaskManager;

    constructor(deps: AutomationWorkflowCouncilManagerDependencies) {
        this.databaseService = deps.databaseService;
        this.collaborationManager = deps.collaborationManager;
        this.taskManager = deps.taskManager;
    }

    async handleQuotaExhaustedInterrupt(input: {
        taskId: string;
        stageId?: string;
        provider: string;
        model: string;
        reason?: string;
        autoSwitch?: boolean;
    }): Promise<{
        success: boolean;
        interruptId: string;
        checkpointId?: string;
        blockedByQuota: boolean;
        switched: boolean;
        selectedFallback?: { provider: string; model: string };
        availableFallbacks: Array<{ provider: string; model: string }>;
        message: string;
    }> {
        const interruptId = `${input.taskId}:${Date.now()}`;
        const reason = input.reason ?? 'quota_exhausted';
        let checkpointId: string | undefined;

        try {
            checkpointId = await this.taskManager.saveSnapshot(input.taskId);
        } catch {
            // Continue even if checkpoint save fails; caller still needs fallback data.
        }

        await this.databaseService.uac.addLog(
            input.taskId,
            'system',
            JSON.stringify({
                type: 'QUOTA_EXHAUSTED',
                interruptId,
                stageId: input.stageId ?? null,
                provider: input.provider,
                model: input.model,
                reason,
                checkpointId: checkpointId ?? null,
                timestamp: Date.now()
            })
        );

        // Mock getting available models for now (matching original implementation)
        const availableModels = [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
            { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        ];

        const availableFallbacks = availableModels
            .filter(item => item.provider !== input.provider || item.id !== input.model)
            .map(item => ({ provider: item.provider, model: item.id }));

        if (availableFallbacks.length === 0) {
            const task = await this.databaseService.uac.getTask(input.taskId);
            if (task) {
                const metadata = safeJsonParse<Record<string, unknown>>(task.metadata, {});
                metadata['blockedByQuota'] = true;
                metadata['lastQuotaInterruptId'] = interruptId;
                await this.databaseService.uac.updateTaskMetadata(input.taskId, metadata);
            }
            await this.taskManager.pauseTask(input.taskId);
            return {
                success: true,
                interruptId,
                checkpointId,
                blockedByQuota: true,
                switched: false,
                availableFallbacks,
                message: 'No eligible fallback model/account found. Task paused for user action.'
            };
        }

        if (input.autoSwitch === false) {
            return {
                success: true,
                interruptId,
                checkpointId,
                blockedByQuota: false,
                switched: false,
                availableFallbacks,
                message: 'Fallback candidates prepared. Waiting for manual user selection.'
            };
        }

        const selectedFallback = availableFallbacks[0];
        let resumedFromCheckpoint = false;
        if (checkpointId) {
            try {
                await this.taskManager.resumeFromCheckpoint(checkpointId);
                resumedFromCheckpoint = true;
            } catch {
                resumedFromCheckpoint = false;
            }
        }

        const switched = await this.taskManager.selectModel(
            input.taskId,
            selectedFallback.provider,
            selectedFallback.model
        );
        let resumed = false;
        if (switched) {
            try {
                resumed = await this.taskManager.resumeTask(input.taskId);
            } catch {
                resumed = false;
            }
        }

        await this.databaseService.uac.addLog(
            input.taskId,
            'system',
            JSON.stringify({
                type: 'FORCED_MODEL_SWITCH',
                interruptId,
                previous: { provider: input.provider, model: input.model },
                next: selectedFallback,
                switched,
                resumedFromCheckpoint,
                resumed,
                timestamp: Date.now()
            })
        );

        return {
            success: true,
            interruptId,
            checkpointId,
            blockedByQuota: false,
            switched,
            selectedFallback: switched ? selectedFallback : undefined,
            availableFallbacks,
            message: switched
                ? resumed
                    ? resumedFromCheckpoint
                        ? 'Quota exhaustion handled via checkpoint restore, fallback switch, and resume.'
                        : 'Quota exhaustion handled via automatic fallback switch and resume.'
                    : resumedFromCheckpoint
                        ? 'Fallback switched after checkpoint restore, but resume did not start.'
                        : 'Quota exhaustion handled via automatic fallback switch.'
                : 'Fallback switch attempt failed. Manual intervention required.'
        };
    }

    // ===== Delegations to Collaboration Manager =====

    getRoutingRules(): ModelRoutingRule[] {
        return this.collaborationManager.getRoutingRules();
    }

    setRoutingRules(rules: ModelRoutingRule[]): void {
        this.collaborationManager.setRoutingRules(rules);
    }

    createVotingSession(
        taskId: string,
        stepIndex: number,
        question: string,
        options: string[]
    ): VotingSession {
        return this.collaborationManager.createVotingSession(taskId, stepIndex, question, options);
    }

    async submitVote(options: {
        sessionId: string;
        modelId: string;
        provider: string;
        decision: string;
        confidence: number;
        reasoning?: string;
    }): Promise<VotingSession | null> {
        return await this.collaborationManager.submitVote(options);
    }

    async requestVotes(
        sessionId: string,
        models: Array<{ provider: string; model: string }>
    ): Promise<VotingSession | null> {
        return await this.collaborationManager.requestVotes(sessionId, models);
    }

    resolveVoting(sessionId: string): VotingSession | null {
        return this.collaborationManager.resolveVoting(sessionId);
    }

    getVotingSession(sessionId: string): VotingSession | null {
        return this.collaborationManager.getVotingSession(sessionId);
    }

    getVotingSessions(taskId?: string): VotingSession[] {
        return this.collaborationManager.getVotingSessions(taskId);
    }

    overrideVotingDecision(
        sessionId: string,
        finalDecision: string,
        reason?: string
    ): VotingSession | null {
        return this.collaborationManager.overrideVotingDecision(sessionId, finalDecision, reason);
    }

    getVotingAnalytics(taskId?: string): VotingAnalytics {
        return this.collaborationManager.getVotingAnalytics(taskId);
    }

    getVotingConfiguration(): VotingConfiguration {
        return this.collaborationManager.getVotingConfiguration();
    }

    updateVotingConfiguration(patch: Partial<VotingConfiguration>): VotingConfiguration {
        return this.collaborationManager.updateVotingConfiguration(patch);
    }

    getVotingTemplates(): VotingTemplate[] {
        return this.collaborationManager.getVotingTemplates();
    }

    async buildConsensus(
        outputs: Array<{ modelId: string; provider: string; output: string }>
    ): Promise<ConsensusResult> {
        return await this.collaborationManager.buildConsensus(outputs);
    }

    createDebateSession(taskId: string, stepIndex: number, topic: string): DebateSession {
        return this.collaborationManager.createDebateSession(taskId, stepIndex, topic);
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
        return this.collaborationManager.submitDebateArgument(options);
    }

    resolveDebateSession(sessionId: string): DebateSession | null {
        return this.collaborationManager.resolveDebateSession(sessionId);
    }

    overrideDebateSession(
        sessionId: string,
        moderatorId: string,
        decision: DebateSide | 'balanced',
        reason?: string
    ): DebateSession | null {
        return this.collaborationManager.overrideDebateSession(sessionId, moderatorId, decision, reason);
    }

    getDebateSession(sessionId: string): DebateSession | null {
        return this.collaborationManager.getDebateSession(sessionId);
    }

    getDebateHistory(taskId?: string): DebateSession[] {
        return this.collaborationManager.getDebateHistory(taskId);
    }

    getDebateReplay(sessionId: string): DebateReplay | null {
        return this.collaborationManager.getDebateReplay(sessionId);
    }

    generateDebateSummary(sessionId: string): string | null {
        return this.collaborationManager.generateDebateSummary(sessionId);
    }

    getTeamworkAnalytics(): AgentTeamworkAnalytics {
        return this.collaborationManager.getTeamworkAnalytics();
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
        return await this.collaborationManager.sendCollaborationMessage(input);
    }

    registerWorkerAvailability(input: {
        taskId: string;
        agentId: string;
        status: 'available' | 'busy' | 'offline';
        reason?: string;
        skills?: string[];
        contextReadiness?: number;
    }): WorkerAvailabilityRecord {
        return this.collaborationManager.registerWorkerAvailability(input);
    }

    listAvailableWorkers(taskId: string): WorkerAvailabilityRecord[] {
        return this.collaborationManager.listAvailableWorkers(taskId);
    }

    scoreHelperCandidates(input: {
        taskId: string;
        stageId: string;
        requiredSkills: string[];
        blockedAgentIds?: string[];
        contextReadinessOverrides?: Record<string, number>;
    }): HelperCandidateScore[] {
        return this.collaborationManager.scoreHelperCandidates(input);
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
        return this.collaborationManager.generateHelperHandoffPackage(input);
    }

    reviewHelperMergeGate(input: {
        acceptanceCriteria: string[];
        constraints: string[];
        helperOutput: string;
        reviewerNotes?: string;
    }): HelperMergeGateDecision {
        return this.collaborationManager.reviewHelperMergeGate(input);
    }

    async getCollaborationMessages(input: {
        taskId: string;
        stageId?: string;
        agentId?: string;
        includeExpired?: boolean;
    }): Promise<AgentCollaborationMessage[]> {
        return await this.collaborationManager.getCollaborationMessages(input);
    }

    async cleanupExpiredCollaborationMessages(taskId?: string): Promise<number> {
        return await this.collaborationManager.cleanupExpiredCollaborationMessages(taskId);
    }
}
