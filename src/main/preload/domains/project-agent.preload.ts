import {
    AgentStartOptions,
    AgentTemplate,
    AgentTemplateCategory,
    AgentTemplateExport,
    ConsensusResult,
    DebateCitation,
    DebateReplay,
    DebateSession,
    DebateSide,
    IpcValue,
    Message,
    ModelRoutingRule,
    ProjectState,
    ProjectStep,
    VotingConfiguration,
    VotingSession,
    VotingTemplate,
} from '@shared/types';
import { AgentEventRecord, TaskMetrics } from '@shared/types/agent-state';
import {
    AgentCollaborationIntent,
    AgentCollaborationMessage,
    AgentCollaborationPriority,
    AgentProfile,
    AgentTaskHistoryItem,
    AgentTeamworkAnalytics,
    HelperCandidateScore,
    HelperHandoffPackage,
    HelperMergeGateDecision,
    WorkerAvailabilityRecord,
} from '@shared/types/project-agent';
import { isProjectState } from '@shared/utils/type-guards.util';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface ProjectAgentBridge {
    start: (options: AgentStartOptions) => Promise<{ taskId: string }>;
    generatePlan: (options: AgentStartOptions) => Promise<void>;
    approvePlan: (plan: string[] | ProjectStep[], taskId?: string) => Promise<void>;
    stop: (taskId?: string) => Promise<void>;
    pauseTask: (taskId: string) => Promise<{ success: boolean }>;
    resumeTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    saveSnapshot: (
        taskId: string
    ) => Promise<{ success: boolean; checkpointId?: string }>;
    approveCurrentPlan: (
        taskId: string
    ) => Promise<{ success: boolean; error?: string }>;
    rejectCurrentPlan: (
        taskId: string,
        reason?: string
    ) => Promise<{ success: boolean; error?: string }>;
    createPullRequest: (
        taskId?: string
    ) => Promise<{ success: boolean; url?: string; error?: string }>;
    resetState: () => Promise<void>;
    getStatus: (taskId?: string) => Promise<ProjectState>;
    getTaskMessages: (
        taskId: string
    ) => Promise<{ success: boolean; messages?: Message[] }>;
    getTaskEvents: (
        taskId: string
    ) => Promise<{ success: boolean; events?: AgentEventRecord[] }>;
    getTaskTelemetry: (
        taskId: string
    ) => Promise<{ success: boolean; telemetry?: TaskMetrics[] }>;
    getTaskHistory: (
        projectId?: string
    ) => Promise<AgentTaskHistoryItem[]>;
    deleteTask: (
        taskId: string
    ) => Promise<{ success: boolean; error?: string }>;
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
    rollbackCheckpoint: (checkpointId: string) => Promise<{
        success: boolean;
        taskId: string;
        resumedCheckpointId: string;
        preRollbackCheckpointId: string;
        planVersionId?: string;
    }>;
    getPlanVersions: (taskId: string) => Promise<
        Array<{
            id: string;
            taskId: string;
            versionNumber: number;
            reason: string;
            plan: ProjectStep[];
            createdAt: number;
        }>
    >;
    deleteTaskByNodeId: (nodeId: string) => Promise<boolean>;
    getProfiles: () => Promise<AgentProfile[]>;
    getRoutingRules: () => Promise<ModelRoutingRule[]>;
    setRoutingRules: (rules: ModelRoutingRule[]) => Promise<{ success: boolean }>;
    createVotingSession: (payload: {
        taskId: string;
        stepIndex: number;
        question: string;
        options: string[];
    }) => Promise<VotingSession>;
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
    overrideVotingDecision: (payload: {
        sessionId: string;
        finalDecision: string;
        reason?: string;
    }) => Promise<VotingSession | null>;
    getVotingAnalytics: (taskId?: string) => Promise<import('@shared/types/project-agent').VotingAnalytics>;
    getVotingConfiguration: () => Promise<VotingConfiguration>;
    updateVotingConfiguration: (patch: Partial<VotingConfiguration>) => Promise<VotingConfiguration>;
    listVotingTemplates: () => Promise<VotingTemplate[]>;
    buildConsensus: (outputs: Array<{ modelId: string; provider: string; output: string }>) => Promise<ConsensusResult>;
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
    councilSendMessage: (payload: {
        taskId: string;
        stageId: string;
        fromAgentId: string;
        toAgentId?: string;
        intent: AgentCollaborationIntent;
        priority?: AgentCollaborationPriority;
        payload: Record<string, string | number | boolean | null>;
        expiresAt?: number;
    }) => Promise<AgentCollaborationMessage | null>;
    councilGetMessages: (payload: {
        taskId: string;
        stageId?: string;
        agentId?: string;
        includeExpired?: boolean;
    }) => Promise<AgentCollaborationMessage[]>;
    councilCleanupExpiredMessages: (taskId?: string) => Promise<{ success: boolean; removed: number }>;
    councilHandleQuotaInterrupt: (payload: {
        taskId: string;
        stageId?: string;
        provider: string;
        model: string;
        reason?: string;
        autoSwitch?: boolean;
    }) => Promise<{
        success: boolean;
        interruptId: string;
        checkpointId?: string;
        blockedByQuota: boolean;
        switched: boolean;
        selectedFallback?: { provider: string; model: string };
        availableFallbacks: Array<{ provider: string; model: string }>;
        message: string;
    } | null>;
    councilRegisterWorkerAvailability: (payload: {
        taskId: string;
        agentId: string;
        status: 'available' | 'busy' | 'offline';
        reason?: string;
        skills?: string[];
        contextReadiness?: number;
    }) => Promise<WorkerAvailabilityRecord | null>;
    councilListAvailableWorkers: (payload: {
        taskId: string;
    }) => Promise<WorkerAvailabilityRecord[]>;
    councilScoreHelperCandidates: (payload: {
        taskId: string;
        stageId: string;
        requiredSkills: string[];
        blockedAgentIds?: string[];
        contextReadinessOverrides?: Record<string, number>;
    }) => Promise<HelperCandidateScore[]>;
    councilGenerateHelperHandoff: (payload: {
        taskId: string;
        stageId: string;
        ownerAgentId: string;
        helperAgentId: string;
        stageGoal: string;
        acceptanceCriteria: string[];
        constraints: string[];
        contextNotes?: string;
    }) => Promise<HelperHandoffPackage | null>;
    councilReviewHelperMerge: (payload: {
        acceptanceCriteria: string[];
        constraints: string[];
        helperOutput: string;
        reviewerNotes?: string;
    }) => Promise<HelperMergeGateDecision>;
    getTemplates: (category?: AgentTemplateCategory) => Promise<AgentTemplate[]>;
    getTemplate: (id: string) => Promise<AgentTemplate | null>;
    saveTemplate: (template: AgentTemplate) => Promise<{ success: boolean; template: AgentTemplate }>;
    deleteTemplate: (id: string) => Promise<{ success: boolean }>;
    exportTemplate: (id: string) => Promise<AgentTemplateExport | null>;
    importTemplate: (exported: AgentTemplateExport) => Promise<{ success: boolean; template?: AgentTemplate; error?: string }>;
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
    onUpdate: (callback: (state: ProjectState) => void) => () => void;
    onQuotaInterrupt: (callback: (payload: Record<string, unknown>) => void) => () => void;
    saveCanvasNodes: (nodes: Record<string, unknown>[]) => Promise<void>;
    getCanvasNodes: () => Promise<Record<string, unknown>[]>;
    deleteCanvasNode: (id: string) => Promise<boolean>;
    saveCanvasEdges: (edges: Record<string, unknown>[]) => Promise<void>;
    getCanvasEdges: () => Promise<Record<string, unknown>[]>;
    deleteCanvasEdge: (id: string) => Promise<boolean>;
    health: () => Promise<Record<string, unknown>>;
    council: {
        generatePlan: (taskId: string, task: string) => Promise<{ success: boolean; error?: string }>;
        getProposal: (taskId: string) => Promise<{ success: boolean; plan: ProjectStep[]; error?: string }>;
        approveProposal: (taskId: string) => Promise<{ success: boolean; error?: string }>;
        rejectProposal: (taskId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
        startExecution: (taskId: string) => Promise<{ success: boolean; error?: string }>;
        pauseExecution: (taskId: string) => Promise<{ success: boolean; error?: string }>;
        resumeExecution: (taskId: string) => Promise<{ success: boolean; error?: string }>;
        getTimeline: (taskId: string) => Promise<{ success: boolean; events: AgentEventRecord[]; error?: string }>;
    };
}

export function createProjectAgentBridge(ipc: IpcRenderer): ProjectAgentBridge {
    return {
        start: options => ipc.invoke('project:start', options),
        generatePlan: options => ipc.invoke('project:plan', options),
        approvePlan: (plan, taskId) => ipc.invoke('project:approve', { plan, taskId }),
        stop: taskId => ipc.invoke('project:stop', { taskId }),
        pauseTask: taskId => ipc.invoke('project:pause-task', { taskId }),
        resumeTask: taskId => ipc.invoke('project:resume-task', { taskId }),
        saveSnapshot: taskId => ipc.invoke('project:save-snapshot', { taskId }),
        approveCurrentPlan: taskId => ipc.invoke('project:approve-current-plan', { taskId }),
        rejectCurrentPlan: (taskId, reason) =>
            ipc.invoke('project:reject-current-plan', { taskId, reason }),
        createPullRequest: taskId => ipc.invoke('project:create-pr', { taskId }),
        resetState: () => ipc.invoke('project:reset-state'),
        getStatus: taskId => ipc.invoke('project:get-status', { taskId }),
        getTaskMessages: taskId => ipc.invoke('project:get-messages', { taskId }),
        getTaskEvents: taskId => ipc.invoke('project:get-events', { taskId }),
        getTaskTelemetry: taskId => ipc.invoke('project:get-telemetry', { taskId }),
        getTaskHistory: projectId => ipc.invoke('project:get-task-history', { projectId }),
        deleteTask: taskId => ipc.invoke('project:delete-task', { taskId }),
        getAvailableModels: () => ipc.invoke('project:get-available-models'),
        retryStep: (index, taskId) => ipc.invoke('project:retry-step', { index, taskId }),
        selectModel: payload => ipc.invoke('project:select-model', payload),
        approveStep: (taskId, stepId) =>
            ipc.invoke('project:approve-step', { taskId, stepId }),
        skipStep: (taskId, stepId) =>
            ipc.invoke('project:skip-step', { taskId, stepId }),
        editStep: (taskId, stepId, text) =>
            ipc.invoke('project:edit-step', { taskId, stepId, text }),
        addStepComment: (taskId, stepId, comment) =>
            ipc.invoke('project:add-step-comment', { taskId, stepId, comment }),
        insertInterventionPoint: (taskId, afterStepId) =>
            ipc.invoke('project:insert-intervention', { taskId, afterStepId }),
        getCheckpoints: taskId => ipc.invoke('project:get-checkpoints', taskId),
        rollbackCheckpoint: checkpointId =>
            ipc.invoke('project:rollback-checkpoint', checkpointId),
        getPlanVersions: taskId =>
            ipc.invoke('project:get-plan-versions', taskId),
        deleteTaskByNodeId: nodeId =>
            ipc.invoke('project:delete-task-by-node', nodeId),
        getProfiles: () => ipc.invoke('project:get-profiles'),
        getRoutingRules: () => ipc.invoke('project:get-routing-rules'),
        setRoutingRules: rules => ipc.invoke('project:set-routing-rules', rules),
        createVotingSession: payload => ipc.invoke('project:create-voting-session', payload),
        submitVote: payload => ipc.invoke('project:submit-vote', payload),
        requestVotes: payload => ipc.invoke('project:request-votes', payload),
        resolveVoting: sessionId => ipc.invoke('project:resolve-voting', sessionId),
        getVotingSession: sessionId => ipc.invoke('project:get-voting-session', sessionId),
        listVotingSessions: taskId => ipc.invoke('project:list-voting-sessions', taskId),
        overrideVotingDecision: payload => ipc.invoke('project:override-voting', payload),
        getVotingAnalytics: taskId => ipc.invoke('project:get-voting-analytics', taskId),
        getVotingConfiguration: () => ipc.invoke('project:get-voting-config'),
        updateVotingConfiguration: patch => ipc.invoke('project:update-voting-config', patch),
        listVotingTemplates: () => ipc.invoke('project:list-voting-templates'),
        buildConsensus: outputs => ipc.invoke('project:build-consensus', outputs),
        createDebateSession: payload => ipc.invoke('project:create-debate-session', payload),
        submitDebateArgument: payload => ipc.invoke('project:submit-debate-argument', payload),
        resolveDebateSession: sessionId => ipc.invoke('project:resolve-debate-session', sessionId),
        overrideDebateSession: payload => ipc.invoke('project:override-debate-session', payload),
        getDebateSession: sessionId => ipc.invoke('project:get-debate-session', sessionId),
        listDebateHistory: taskId => ipc.invoke('project:list-debate-history', taskId),
        getDebateReplay: sessionId => ipc.invoke('project:get-debate-replay', sessionId),
        generateDebateSummary: sessionId => ipc.invoke('project:generate-debate-summary', sessionId),
        getTeamworkAnalytics: () => ipc.invoke('project:get-teamwork-analytics'),
        councilSendMessage: payload => ipc.invoke('project:council-send-message', payload),
        councilGetMessages: payload => ipc.invoke('project:council-get-messages', payload),
        councilCleanupExpiredMessages: taskId =>
            ipc.invoke('project:council-cleanup-expired-messages', { taskId }),
        councilHandleQuotaInterrupt: payload =>
            ipc.invoke('project:council-handle-quota-interrupt', payload),
        councilRegisterWorkerAvailability: payload =>
            ipc.invoke('project:council-register-worker-availability', payload),
        councilListAvailableWorkers: payload =>
            ipc.invoke('project:council-list-available-workers', payload),
        councilScoreHelperCandidates: payload =>
            ipc.invoke('project:council-score-helper-candidates', payload),
        councilGenerateHelperHandoff: payload =>
            ipc.invoke('project:council-generate-helper-handoff', payload),
        councilReviewHelperMerge: payload =>
            ipc.invoke('project:council-review-helper-merge', payload),
        council: {
            generatePlan: (taskId, task) => ipc.invoke('project:council-generate-plan', { taskId, task }),
            getProposal: taskId => ipc.invoke('project:council-get-proposal', { taskId }),
            approveProposal: taskId => ipc.invoke('project:council-approve-proposal', { taskId }),
            rejectProposal: (taskId, reason) => ipc.invoke('project:council-reject-proposal', { taskId, reason }),
            startExecution: taskId => ipc.invoke('project:council-start-execution', { taskId }),
            pauseExecution: taskId => ipc.invoke('project:council-pause-execution', { taskId }),
            resumeExecution: taskId => ipc.invoke('project:council-resume-execution', { taskId }),
            getTimeline: taskId => ipc.invoke('project:council-get-timeline', { taskId }),
        },
        getTemplates: category => ipc.invoke('project:get-templates', category),
        getTemplate: id => ipc.invoke('project:get-template', id),
        saveTemplate: template => ipc.invoke('project:save-template', template),
        deleteTemplate: id => ipc.invoke('project:delete-template', id),
        exportTemplate: id => ipc.invoke('project:export-template', id),
        importTemplate: exported => ipc.invoke('project:import-template', exported),
        applyTemplate: payload => ipc.invoke('project:apply-template', payload),
        onUpdate: callback => {
            const listener = (_event: IpcRendererEvent, state: IpcValue) => {
                if (isProjectState(state)) {
                    callback(state);
                }
            };
            ipc.on('project:update', listener);
            return () => ipc.removeListener('project:update', listener);
        },
        onQuotaInterrupt: callback => {
            const listener = (_event: IpcRendererEvent, payload: Record<string, unknown>) => callback(payload);
            ipc.on('project:quota-interrupt', listener);
            return () => ipc.removeListener('project:quota-interrupt', listener);
        },
        saveCanvasNodes: nodes => ipc.invoke('project:save-canvas-nodes', nodes),
        getCanvasNodes: () => ipc.invoke('project:get-canvas-nodes'),
        deleteCanvasNode: id => ipc.invoke('project:delete-canvas-node', id),
        saveCanvasEdges: edges => ipc.invoke('project:save-canvas-edges', edges),
        getCanvasEdges: () => ipc.invoke('project:get-canvas-edges'),
        deleteCanvasEdge: id => ipc.invoke('project:delete-canvas-edge', id),
        health: () => ipc.invoke('project:health'),
    };
}
