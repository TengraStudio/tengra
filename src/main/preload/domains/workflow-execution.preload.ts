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
    VotingConfiguration,
    VotingSession,
    VotingTemplate,
    WorkspaceState,
    WorkspaceStep,
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
} from '@shared/types/automation-workflow';
import { isWorkspaceState } from '@shared/utils/type-guards.util';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface WorkflowAgentBridge {
    start: (options: AgentStartOptions) => Promise<{ taskId: string }>;
    generatePlan: (options: AgentStartOptions) => Promise<void>;
    approvePlan: (plan: string[] | WorkspaceStep[], taskId?: string) => Promise<void>;
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
    getStatus: (taskId?: string) => Promise<WorkspaceState>;
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
        workspaceId?: string
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
            plan: WorkspaceStep[];
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
    getVotingAnalytics: (taskId?: string) => Promise<import('@shared/types/automation-workflow').VotingAnalytics>;
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
    onUpdate: (callback: (state: WorkspaceState) => void) => () => void;
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
        getProposal: (taskId: string) => Promise<{ success: boolean; plan: WorkspaceStep[]; error?: string }>;
        approveProposal: (taskId: string) => Promise<{ success: boolean; error?: string }>;
        rejectProposal: (taskId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
        startExecution: (taskId: string) => Promise<{ success: boolean; error?: string }>;
        pauseExecution: (taskId: string) => Promise<{ success: boolean; error?: string }>;
        resumeExecution: (taskId: string) => Promise<{ success: boolean; error?: string }>;
        getTimeline: (taskId: string) => Promise<{ success: boolean; events: AgentEventRecord[]; error?: string }>;
    };
}

export function createWorkflowAgentBridge(ipc: IpcRenderer): WorkflowAgentBridge {
    return {
        start: options => ipc.invoke('agent:start', options),
        generatePlan: options => ipc.invoke('agent:plan', options),
        approvePlan: (plan, taskId) => ipc.invoke('agent:approve', { plan, taskId }),
        stop: taskId => ipc.invoke('agent:stop', { taskId }),
        pauseTask: taskId => ipc.invoke('agent:pause-task', { taskId }),
        resumeTask: taskId => ipc.invoke('agent:resume-task', { taskId }),
        saveSnapshot: taskId => ipc.invoke('agent:save-snapshot', { taskId }),
        approveCurrentPlan: taskId => ipc.invoke('agent:approve-current-plan', { taskId }),
        rejectCurrentPlan: (taskId, reason) =>
            ipc.invoke('agent:reject-current-plan', { taskId, reason }),
        createPullRequest: taskId => ipc.invoke('agent:create-pr', { taskId }),
        resetState: () => ipc.invoke('agent:reset-state'),
        getStatus: taskId => ipc.invoke('agent:get-status', { taskId }),
        getTaskMessages: taskId => ipc.invoke('agent:get-messages', { taskId }),
        getTaskEvents: taskId => ipc.invoke('agent:get-events', { taskId }),
        getTaskTelemetry: taskId => ipc.invoke('agent:get-telemetry', { taskId }),
        getTaskHistory: workspaceId => ipc.invoke('agent:get-task-history', { workspaceId }),
        deleteTask: taskId => ipc.invoke('agent:delete-task', { taskId }),
        getAvailableModels: () => ipc.invoke('agent:get-available-models'),
        retryStep: (index, taskId) => ipc.invoke('agent:retry-step', { index, taskId }),
        selectModel: payload => ipc.invoke('agent:select-model', payload),
        approveStep: (taskId, stepId) =>
            ipc.invoke('agent:approve-step', { taskId, stepId }),
        skipStep: (taskId, stepId) =>
            ipc.invoke('agent:skip-step', { taskId, stepId }),
        editStep: (taskId, stepId, text) =>
            ipc.invoke('agent:edit-step', { taskId, stepId, text }),
        addStepComment: (taskId, stepId, comment) =>
            ipc.invoke('agent:add-step-comment', { taskId, stepId, comment }),
        insertInterventionPoint: (taskId, afterStepId) =>
            ipc.invoke('agent:insert-intervention', { taskId, afterStepId }),
        getCheckpoints: taskId => ipc.invoke('agent:get-checkpoints', taskId),
        rollbackCheckpoint: checkpointId =>
            ipc.invoke('agent:rollback-checkpoint', checkpointId),
        getPlanVersions: taskId =>
            ipc.invoke('agent:get-plan-versions', taskId),
        deleteTaskByNodeId: nodeId =>
            ipc.invoke('agent:delete-task-by-node', nodeId),
        getProfiles: () => ipc.invoke('agent:get-profiles'),
        getRoutingRules: () => ipc.invoke('agent:get-routing-rules'),
        setRoutingRules: rules => ipc.invoke('agent:set-routing-rules', rules),
        createVotingSession: payload => ipc.invoke('agent:create-voting-session', payload),
        submitVote: payload => ipc.invoke('agent:submit-vote', payload),
        requestVotes: payload => ipc.invoke('agent:request-votes', payload),
        resolveVoting: sessionId => ipc.invoke('agent:resolve-voting', sessionId),
        getVotingSession: sessionId => ipc.invoke('agent:get-voting-session', sessionId),
        listVotingSessions: taskId => ipc.invoke('agent:list-voting-sessions', taskId),
        overrideVotingDecision: payload => ipc.invoke('agent:override-voting', payload),
        getVotingAnalytics: taskId => ipc.invoke('agent:get-voting-analytics', taskId),
        getVotingConfiguration: () => ipc.invoke('agent:get-voting-config'),
        updateVotingConfiguration: patch => ipc.invoke('agent:update-voting-config', patch),
        listVotingTemplates: () => ipc.invoke('agent:list-voting-templates'),
        buildConsensus: outputs => ipc.invoke('agent:build-consensus', outputs),
        createDebateSession: payload => ipc.invoke('agent:create-debate-session', payload),
        submitDebateArgument: payload => ipc.invoke('agent:submit-debate-argument', payload),
        resolveDebateSession: sessionId => ipc.invoke('agent:resolve-debate-session', sessionId),
        overrideDebateSession: payload => ipc.invoke('agent:override-debate-session', payload),
        getDebateSession: sessionId => ipc.invoke('agent:get-debate-session', sessionId),
        listDebateHistory: taskId => ipc.invoke('agent:list-debate-history', taskId),
        getDebateReplay: sessionId => ipc.invoke('agent:get-debate-replay', sessionId),
        generateDebateSummary: sessionId => ipc.invoke('agent:generate-debate-summary', sessionId),
        getTeamworkAnalytics: () => ipc.invoke('agent:get-teamwork-analytics'),
        councilSendMessage: payload => ipc.invoke('agent:council-send-message', payload),
        councilGetMessages: payload => ipc.invoke('agent:council-get-messages', payload),
        councilCleanupExpiredMessages: taskId =>
            ipc.invoke('agent:council-cleanup-expired-messages', { taskId }),
        councilHandleQuotaInterrupt: payload =>
            ipc.invoke('agent:council-handle-quota-interrupt', payload),
        councilRegisterWorkerAvailability: payload =>
            ipc.invoke('agent:council-register-worker-availability', payload),
        councilListAvailableWorkers: payload =>
            ipc.invoke('agent:council-list-available-workers', payload),
        councilScoreHelperCandidates: payload =>
            ipc.invoke('agent:council-score-helper-candidates', payload),
        councilGenerateHelperHandoff: payload =>
            ipc.invoke('agent:council-generate-helper-handoff', payload),
        councilReviewHelperMerge: payload =>
            ipc.invoke('agent:council-review-helper-merge', payload),
        council: {
            generatePlan: (taskId, task) => ipc.invoke('agent:council-generate-plan', { taskId, task }),
            getProposal: taskId => ipc.invoke('agent:council-get-proposal', { taskId }),
            approveProposal: taskId => ipc.invoke('agent:council-approve-proposal', { taskId }),
            rejectProposal: (taskId, reason) => ipc.invoke('agent:council-reject-proposal', { taskId, reason }),
            startExecution: taskId => ipc.invoke('agent:council-start-execution', { taskId }),
            pauseExecution: taskId => ipc.invoke('agent:council-pause-execution', { taskId }),
            resumeExecution: taskId => ipc.invoke('agent:council-resume-execution', { taskId }),
            getTimeline: taskId => ipc.invoke('agent:council-get-timeline', { taskId }),
        },
        getTemplates: category => ipc.invoke('agent:get-templates', category),
        getTemplate: id => ipc.invoke('agent:get-template', id),
        saveTemplate: template => ipc.invoke('agent:save-template', template),
        deleteTemplate: id => ipc.invoke('agent:delete-template', id),
        exportTemplate: id => ipc.invoke('agent:export-template', id),
        importTemplate: exported => ipc.invoke('agent:import-template', exported),
        applyTemplate: payload => ipc.invoke('agent:apply-template', payload),
        onUpdate: callback => {
            const listener = (_event: IpcRendererEvent, state: IpcValue) => {
                if (isWorkspaceState(state)) {
                    callback(state);
                }
            };
            ipc.on('agent:update', listener);
            return () => ipc.removeListener('agent:update', listener);
        },
        onQuotaInterrupt: callback => {
            const listener = (_event: IpcRendererEvent, payload: Record<string, unknown>) => callback(payload);
            ipc.on('agent:quota-interrupt', listener);
            return () => ipc.removeListener('agent:quota-interrupt', listener);
        },
        saveCanvasNodes: nodes => ipc.invoke('agent:save-canvas-nodes', nodes),
        getCanvasNodes: () => ipc.invoke('agent:get-canvas-nodes'),
        deleteCanvasNode: id => ipc.invoke('agent:delete-canvas-node', id),
        saveCanvasEdges: edges => ipc.invoke('agent:save-canvas-edges', edges),
        getCanvasEdges: () => ipc.invoke('agent:get-canvas-edges'),
        deleteCanvasEdge: id => ipc.invoke('agent:delete-canvas-edge', id),
        health: () => ipc.invoke('agent:health'),
    };
}
