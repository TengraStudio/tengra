import { TelemetryService } from '@main/services/analysis/telemetry.service';
import { BaseService } from '@main/services/base.service';
import {
    AgentCollaborationTelemetryEvent,
    AgentTeamworkAnalytics,
    HelperCandidateScore,
    WorkerAvailabilityRecord,
} from '@shared/types/workspace-agent';

export interface TeamworkDependencies {
    telemetry?: TelemetryService;
}

/**
 * AgentTeamworkService
 * Extracted from AgentCollaborationService to handle agent task stats and worker availability.
 * AI-SYS-14 refactor.
 */
export class AgentTeamworkService extends BaseService {
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

    constructor(private deps: TeamworkDependencies) {
        super('AgentTeamworkService');
    }

    /**
     * Set the telemetry service dependency
     */
    setTelemetryService(telemetry: TelemetryService): void {
        this.deps.telemetry = telemetry;
    }

    override async initialize(): Promise<void> {
        this.logInfo('Initializing Agent Teamwork Service...');
    }

    getAgentStats(agentId: string) {
        let stats = this.agentTaskStats.get(agentId);
        if (!stats) {
            stats = {
                completedTasks: 0,
                failedTasks: 0,
                inProgressTasks: 0,
                totalDurationMs: 0,
                totalConfidence: 0,
                confidenceSamples: 0,
                votesParticipated: 0,
                debatesParticipated: 0,
                consensusAligned: 0,
            };
            this.agentTaskStats.set(agentId, stats);
        }
        return stats;
    }

    recordTaskProgress(options: {
        agentId: string;
        status: 'in_progress' | 'completed' | 'failed';
        durationMs?: number;
        confidence?: number;
        taskId?: string;
        reason?: string;
        skills?: string[];
    }): void {
        const { agentId, status, durationMs, confidence } = options;
        if (!agentId) { throw new Error('agentId is required'); }

        const stats = this.getAgentStats(agentId);
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
            this.registerWorkerAvailability({
                taskId: options.taskId,
                agentId,
                status: status === 'in_progress' ? 'busy' : 'available',
                reason: options.reason ?? (status === 'in_progress' ? 'Task in progress' : (status === 'completed' ? 'Task completed' : 'Task failed')),
                skills: options.skills ?? []
            });
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
        if (!input.taskId) { throw new Error('taskId is required'); }
        if (!input.agentId) { throw new Error('agentId is required'); }

        const perTask = this.workerAvailability.get(input.taskId) ?? new Map<string, WorkerAvailabilityRecord>();
        const previous = perTask.get(input.agentId);
        const isNewAgent = !previous;
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

        if (isNewAgent && input.status === 'available') {
            this.track(AgentCollaborationTelemetryEvent.AGENT_JOINED, {
                taskId: input.taskId,
                agentId: input.agentId,
                skillCount: nextRecord.skills.length
            });
        }

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

        return available
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
    }

    getAnalytics(): AgentTeamworkAnalytics {
        const metrics: AgentTeamworkAnalytics['perAgentMetrics'] = [];
        const efficiencyScores: Record<string, number> = {};
        const healthSignals: AgentTeamworkAnalytics['healthSignals'] = [];
        let totalAgents = 0;
        let totalVotes = 0;
        let totalDebates = 0;
        let totalAligned = 0;

        for (const [agentId, stats] of this.agentTaskStats.entries()) {
            totalAgents++;
            metrics.push({
                agentId,
                completedTasks: stats.completedTasks,
                failedTasks: stats.failedTasks,
                inProgressTasks: stats.inProgressTasks,
                averageTaskDurationMs: stats.completedTasks === 0 ? 0 : stats.totalDurationMs / stats.completedTasks,
                completionRate: (stats.completedTasks + stats.failedTasks) === 0 ? 0 : stats.completedTasks / (stats.completedTasks + stats.failedTasks)
            });

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

        return {
            perAgentMetrics: metrics,
            collaborationPatterns: {
                votingParticipationRate: totalAgents === 0 ? 0 : totalVotes / totalAgents,
                debateParticipationRate: totalAgents === 0 ? 0 : totalDebates / totalAgents,
                consensusAlignmentRate: totalDebates === 0 ? 0 : totalAligned / totalDebates
            },
            efficiencyScores,
            resourceAllocationInsights: [],
            healthSignals,
            comparisonReport: 'Comparison report placeholder',
            productivityRecommendations: [],
            updatedAt: Date.now()
        };
    }

    private track(event: AgentCollaborationTelemetryEvent, payload: Record<string, unknown>): void {
        if (this.deps.telemetry) {
            this.deps.telemetry.track(event, payload);
        }
    }

    override async cleanup(): Promise<void> {
        this.agentTaskStats.clear();
        this.workerAvailability.clear();
    }
}
