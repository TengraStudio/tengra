import type { AgentEventRecord, TaskMetrics } from './agent-state';
import type {
    AgentCollaborationIntent,
    AgentCollaborationMessage,
    AgentCollaborationPriority,
    AgentProfile,
    AgentStartOptions,
    AgentTaskHistoryItem,
    AgentTeamworkAnalytics,
    AgentTemplate,
    AgentTemplateCategory,
    AgentTemplateExport,
    AutomationWorkflowState,
    AutomationWorkflowStep,
    ConsensusResult,
    DebateCitation,
    DebateReplay,
    DebateSession,
    DebateSide,
    HelperCandidateScore,
    HelperHandoffPackage,
    HelperMergeGateDecision,
    ModelRoutingRule,
    QuotaInterruptResult,
    RollbackCheckpointResult,
    VotingAnalytics,
    VotingConfiguration,
    VotingSession,
    VotingTemplate,
    WorkerAvailabilityRecord,
} from './automation-workflow';
import type { Message } from './chat';
import type { IpcValue } from './common';
import type { SessionCouncilQuotaInterruptEvent } from './session-engine';
import type {
    SessionCanvasEdgeRecord,
    SessionCanvasNodeRecord,
} from './session-workspace';

export interface SessionAutomationApi {
    start: (options: AgentStartOptions) => Promise<{ taskId: string }>;
    generatePlan: (options: AgentStartOptions) => Promise<{ taskId: string }>;
    approvePlan: (plan: string[] | AutomationWorkflowStep[], taskId?: string) => Promise<void>;
    stop: (taskId?: string) => Promise<void>;
    pauseTask: (taskId: string) => Promise<{ success: true }>;
    resumeTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    saveSnapshot: (taskId: string) => Promise<{ success: boolean; checkpointId?: string }>;
    approveCurrentPlan: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    rejectCurrentPlan: (taskId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
    resetState: (taskId?: string) => Promise<void>;
    getStatus: (taskId?: string) => Promise<AutomationWorkflowState>;
    getTaskMessages: (taskId: string) => Promise<{ success: boolean; messages?: Message[] }>;
    getTaskEvents: (taskId: string) => Promise<{ success: boolean; events: AgentEventRecord[] }>;
    getTaskTelemetry: (taskId: string) => Promise<{ success: boolean; telemetry: TaskMetrics[] }>;
    getTaskHistory: (workspaceId?: string) => Promise<AgentTaskHistoryItem[]>;
    deleteTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    getAvailableModels: () => Promise<{
        success: boolean;
        models: Array<{ id: string; name: string; provider: string }>;
    }>;
    retryStep: (index: number, taskId?: string) => Promise<void>;
    selectModel: (payload: {
        taskId: string;
        provider: string;
        model: string;
    }) => Promise<{ success: boolean; error?: string }>;
    approveStep: (taskId: string, stepId: string) => Promise<void>;
    skipStep: (taskId: string, stepId: string) => Promise<void>;
    editStep: (taskId: string, stepId: string, text: string) => Promise<void>;
    addStepComment: (taskId: string, stepId: string, comment: string) => Promise<void>;
    insertInterventionPoint: (taskId: string, afterStepId: string) => Promise<void>;
    getCheckpoints: (
        taskId: string
    ) => Promise<Array<{ id: string; stepIndex: number; trigger: string; createdAt: number }>>;
    resumeCheckpoint: (checkpointId: string) => Promise<void>;
    rollbackCheckpoint: (checkpointId: string) => Promise<RollbackCheckpointResult | null>;
    getPlanVersions: (taskId: string) => Promise<Array<{
        id: string;
        taskId: string;
        versionNumber: number;
        reason: string;
        plan: AutomationWorkflowStep[];
        createdAt: number;
    }>>;
    deleteTaskByNodeId: (nodeId: string) => Promise<boolean>;
    createPullRequest: (taskId?: string) => Promise<{
        success: boolean;
        url?: string;
        error?: string;
    } | null>;
    getProfiles: () => Promise<AgentProfile[]>;
    getRoutingRules: () => Promise<ModelRoutingRule[]>;
    setRoutingRules: (rules: ModelRoutingRule[]) => Promise<{ success: true }>;
    getTemplates: (category?: AgentTemplateCategory) => Promise<AgentTemplate[]>;
    getTemplate: (id: string) => Promise<AgentTemplate | null>;
    saveTemplate: (template: AgentTemplate) => Promise<{
        success: boolean;
        template: AgentTemplate;
    }>;
    deleteTemplate: (id: string) => Promise<{ success: boolean }>;
    exportTemplate: (id: string) => Promise<AgentTemplateExport | null>;
    importTemplate: (exported: AgentTemplateExport) => Promise<{
        success: boolean;
        template?: AgentTemplate;
        error?: string;
    }>;
    applyTemplate: (payload: {
        templateId: string;
        values: Record<string, string | number | boolean>;
    }) => Promise<{
        success: boolean;
        template?: AgentTemplate;
        task?: string;
        steps?: string[];
        error?: string;
    }>;
}

export interface SessionWorkspaceApi {
    saveCanvasNodes: (nodes: SessionCanvasNodeRecord[]) => Promise<void>;
    getCanvasNodes: () => Promise<SessionCanvasNodeRecord[]>;
    deleteCanvasNode: (id: string) => Promise<void>;
    saveCanvasEdges: (edges: SessionCanvasEdgeRecord[]) => Promise<void>;
    getCanvasEdges: () => Promise<SessionCanvasEdgeRecord[]>;
    deleteCanvasEdge: (id: string) => Promise<void>;
}

export interface SessionCouncilApi {
    generatePlan: (taskId: string, task: string) => Promise<{ success: boolean; error?: string }>;
    getProposal: (taskId: string) => Promise<{ success: boolean; plan?: AutomationWorkflowStep[]; error?: string }>;
    approveProposal: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    rejectProposal: (taskId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
    startExecution: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    pauseExecution: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    resumeExecution: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    getTimeline: (taskId: string) => Promise<{ success: boolean; events?: Array<Record<string, IpcValue>>; error?: string }>;
    createVotingSession: (payload: {
        taskId: string;
        stepIndex: number;
        question: string;
        options: string[];
    }) => Promise<VotingSession | null>;
    submitVote: (payload: {
        sessionId: string;
        modelId: string;
        provider: string;
        decision: string;
        confidence: number;
        reasoning?: string;
    }) => Promise<VotingSession | null>;
    requestVotes: (payload: {
        sessionId: string;
        models: Array<{ provider: string; model: string }>;
    }) => Promise<VotingSession | null>;
    resolveVoting: (sessionId: string) => Promise<VotingSession | null>;
    getVotingSession: (sessionId: string) => Promise<VotingSession | null>;
    listVotingSessions: (taskId?: string) => Promise<VotingSession[]>;
    getVotingAnalytics: (taskId?: string) => Promise<VotingAnalytics>;
    getVotingConfiguration: () => Promise<VotingConfiguration>;
    updateVotingConfiguration: (patch: Partial<VotingConfiguration>) => Promise<VotingConfiguration>;
    listVotingTemplates: () => Promise<VotingTemplate[]>;
    buildConsensus: (outputs: Array<{ modelId: string; provider: string; output: string }>) => Promise<ConsensusResult | null>;
    overrideVotingDecision: (payload: {
        sessionId: string;
        finalDecision: string;
        reason?: string;
    }) => Promise<VotingSession | null>;
    createDebateSession: (payload: {
        taskId: string;
        stepIndex: number;
        topic: string;
    }) => Promise<DebateSession | null>;
    submitDebateArgument: (payload: {
        sessionId: string;
        agentId: string;
        provider: string;
        side: DebateSide;
        content: string;
        confidence: number;
        citations?: DebateCitation[];
    }) => Promise<DebateSession | null>;
    resolveDebateSession: (sessionId: string) => Promise<DebateSession | null>;
    overrideDebateSession: (payload: {
        sessionId: string;
        moderatorId: string;
        decision: DebateSide | 'balanced';
        reason?: string;
    }) => Promise<DebateSession | null>;
    getDebateSession: (sessionId: string) => Promise<DebateSession | null>;
    listDebateHistory: (taskId?: string) => Promise<DebateSession[]>;
    getDebateReplay: (sessionId: string) => Promise<DebateReplay | null>;
    generateDebateSummary: (sessionId: string) => Promise<string | null>;
    getTeamworkAnalytics: () => Promise<AgentTeamworkAnalytics | null>;
    sendMessage: (payload: {
        taskId: string;
        stageId: string;
        fromAgentId: string;
        toAgentId?: string;
        intent: AgentCollaborationIntent;
        priority?: AgentCollaborationPriority;
        payload: Record<string, string | number | boolean | null>;
        expiresAt?: number;
    }) => Promise<AgentCollaborationMessage | null>;
    getMessages: (payload: {
        taskId: string;
        stageId?: string;
        agentId?: string;
        includeExpired?: boolean;
    }) => Promise<AgentCollaborationMessage[]>;
    cleanupExpiredMessages: (taskId?: string) => Promise<{ success: boolean; removed: number }>;
    handleQuotaInterrupt: (payload: {
        taskId: string;
        stageId?: string;
        provider: string;
        model: string;
        reason?: string;
        autoSwitch?: boolean;
    }) => Promise<QuotaInterruptResult | null>;
    registerWorkerAvailability: (payload: {
        taskId: string;
        agentId: string;
        status: 'available' | 'busy' | 'offline';
        reason?: string;
        skills?: string[];
        contextReadiness?: number;
    }) => Promise<WorkerAvailabilityRecord | null>;
    listAvailableWorkers: (payload: { taskId: string }) => Promise<WorkerAvailabilityRecord[]>;
    scoreHelperCandidates: (payload: {
        taskId: string;
        stageId: string;
        requiredSkills: string[];
        blockedAgentIds?: string[];
        contextReadinessOverrides?: Record<string, number>;
    }) => Promise<HelperCandidateScore[]>;
    generateHelperHandoff: (payload: {
        taskId: string;
        stageId: string;
        ownerAgentId: string;
        helperAgentId: string;
        stageGoal: string;
        acceptanceCriteria: string[];
        constraints: string[];
        contextNotes?: string;
    }) => Promise<HelperHandoffPackage | null>;
    reviewHelperMerge: (payload: {
        acceptanceCriteria: string[];
        constraints: string[];
        helperOutput: string;
        reviewerNotes?: string;
    }) => Promise<HelperMergeGateDecision>;
    onQuotaInterrupt: (callback: (payload: SessionCouncilQuotaInterruptEvent) => void) => () => void;
}
