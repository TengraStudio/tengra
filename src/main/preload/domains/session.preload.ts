import { toSessionConversationGenerationStatus } from '@main/preload/domains/session-conversation-event.util';
import {
    SESSION_AUTOMATION_CHANNELS,
    SESSION_CHANNELS,
    SESSION_CONVERSATION_CHANNELS,
    SESSION_COUNCIL_CHANNELS,
    SESSION_WORKSPACE_CHANNELS,
} from '@shared/constants/ipc-channels';
import type { SessionConversationApi } from '@shared/types/session-conversation';
import type {
    SessionAutomationApi,
    SessionCouncilApi,
    SessionWorkspaceApi,
} from '@shared/types/session-domain-apis';
import type {
    SessionCapabilityDescriptor,
    SessionCouncilQuotaInterruptEvent,
    SessionEventEnvelope,
    SessionRecoverySnapshot,
    SessionState,
} from '@shared/types/session-engine';
import type { IpcRenderer, IpcRendererEvent } from 'electron';

export interface SessionBridge {
    conversation: SessionConversationApi;
    automation: SessionAutomationApi;
    workspace: SessionWorkspaceApi;
    council: SessionCouncilApi;
    getState: (sessionId: string) => Promise<SessionState | null>;
    list: () => Promise<SessionRecoverySnapshot[]>;
    listCapabilities: () => Promise<SessionCapabilityDescriptor[]>;
    health: () => Promise<{ status: 'ready'; activeSessions: number }>;
    onEvent: (callback: (event: SessionEventEnvelope) => void) => () => void;
}

export function createSessionBridge(ipc: IpcRenderer): SessionBridge {
    return {
        conversation: {
            complete: request => ipc.invoke(SESSION_CONVERSATION_CHANNELS.COMPLETE, request),
            stream: request => ipc.invoke(SESSION_CONVERSATION_CHANNELS.STREAM, request),
            abort: chatId => ipc.send(SESSION_CONVERSATION_CHANNELS.CANCEL, { chatId }),
            onStreamChunk: callback => {
                const listener = (_event: IpcRendererEvent, chunk: unknown) => {
                    callback(chunk as Parameters<Parameters<SessionBridge['conversation']['onStreamChunk']>[0]>[0]);
                };
                ipc.on(SESSION_CONVERSATION_CHANNELS.STREAM_CHUNK, listener);
                return () => ipc.removeListener(SESSION_CONVERSATION_CHANNELS.STREAM_CHUNK, listener);
            },
            onGenerationStatus: callback => {
                const listener = (_event: IpcRendererEvent, data: unknown) => {
                    const status = toSessionConversationGenerationStatus(data);
                    if (!status) {
                        return;
                    }
                    callback(status);
                };
                ipc.on(SESSION_CHANNELS.EVENT, listener);
                return () => ipc.removeListener(SESSION_CHANNELS.EVENT, listener);
            },
        },
        automation: {
            start: options => ipc.invoke(SESSION_AUTOMATION_CHANNELS.START, options),
            generatePlan: options => ipc.invoke(SESSION_AUTOMATION_CHANNELS.PLAN, options),
            approvePlan: (plan, taskId) => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.APPROVE_PLAN,
                taskId ? { plan, taskId } : plan
            ),
            stop: taskId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.STOP,
                taskId ? { taskId } : undefined
            ),
            pauseTask: taskId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.PAUSE_TASK,
                { taskId }
            ),
            resumeTask: taskId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.RESUME_TASK,
                { taskId }
            ),
            saveSnapshot: taskId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.SAVE_SNAPSHOT,
                { taskId }
            ),
            approveCurrentPlan: taskId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.APPROVE_CURRENT_PLAN,
                { taskId }
            ),
            rejectCurrentPlan: (taskId, reason) => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.REJECT_CURRENT_PLAN,
                { taskId, reason }
            ),
            resetState: taskId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.RESET_STATE,
                taskId ? { taskId } : undefined
            ),
            getStatus: taskId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.GET_STATUS,
                taskId ? { taskId } : undefined
            ),
            getTaskMessages: taskId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.GET_TASK_MESSAGES,
                { taskId }
            ),
            getTaskEvents: taskId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.GET_TASK_EVENTS,
                { taskId }
            ),
            getTaskTelemetry: taskId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.GET_TASK_TELEMETRY,
                { taskId }
            ),
            getTaskHistory: workspaceId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.GET_TASK_HISTORY,
                workspaceId ? { workspaceId } : undefined
            ),
            deleteTask: taskId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.DELETE_TASK,
                { taskId }
            ),
            getAvailableModels: () => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.GET_AVAILABLE_MODELS
            ),
            retryStep: (index, taskId) => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.RETRY_STEP,
                taskId ? { index, taskId } : index
            ),
            selectModel: payload => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.SELECT_MODEL,
                payload
            ),
            approveStep: (taskId, stepId) => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.APPROVE_STEP,
                { taskId, stepId }
            ),
            skipStep: (taskId, stepId) => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.SKIP_STEP,
                { taskId, stepId }
            ),
            editStep: (taskId, stepId, text) => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.EDIT_STEP,
                { taskId, stepId, text }
            ),
            addStepComment: (taskId, stepId, comment) => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.ADD_STEP_COMMENT,
                { taskId, stepId, comment }
            ),
            insertInterventionPoint: (taskId, afterStepId) => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.INSERT_INTERVENTION_POINT,
                { taskId, afterStepId }
            ),
            getCheckpoints: taskId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.GET_CHECKPOINTS,
                taskId
            ),
            resumeCheckpoint: checkpointId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.RESUME_CHECKPOINT,
                checkpointId
            ),
            rollbackCheckpoint: checkpointId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.ROLLBACK_CHECKPOINT,
                checkpointId
            ),
            getPlanVersions: taskId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.GET_PLAN_VERSIONS,
                taskId
            ),
            deleteTaskByNodeId: nodeId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.DELETE_TASK_BY_NODE_ID,
                nodeId
            ),
            createPullRequest: taskId => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.CREATE_PULL_REQUEST,
                taskId ? { taskId } : undefined
            ),
            getProfiles: () => ipc.invoke(SESSION_AUTOMATION_CHANNELS.GET_PROFILES),
            getRoutingRules: () => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.GET_ROUTING_RULES
            ),
            setRoutingRules: rules => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.SET_ROUTING_RULES,
                rules
            ),
            getTemplates: category => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.GET_TEMPLATES,
                category
            ),
            getTemplate: id => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.GET_TEMPLATE,
                id
            ),
            saveTemplate: template => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.SAVE_TEMPLATE,
                template
            ),
            deleteTemplate: id => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.DELETE_TEMPLATE,
                id
            ),
            exportTemplate: id => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.EXPORT_TEMPLATE,
                id
            ),
            importTemplate: exported => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.IMPORT_TEMPLATE,
                exported
            ),
            applyTemplate: payload => ipc.invoke(
                SESSION_AUTOMATION_CHANNELS.APPLY_TEMPLATE,
                payload
            ),
        },
        workspace: {
            saveCanvasNodes: nodes => ipc.invoke(
                SESSION_WORKSPACE_CHANNELS.SAVE_CANVAS_NODES,
                nodes
            ),
            getCanvasNodes: () => ipc.invoke(
                SESSION_WORKSPACE_CHANNELS.GET_CANVAS_NODES
            ),
            deleteCanvasNode: id => ipc.invoke(
                SESSION_WORKSPACE_CHANNELS.DELETE_CANVAS_NODE,
                id
            ),
            saveCanvasEdges: edges => ipc.invoke(
                SESSION_WORKSPACE_CHANNELS.SAVE_CANVAS_EDGES,
                edges
            ),
            getCanvasEdges: () => ipc.invoke(
                SESSION_WORKSPACE_CHANNELS.GET_CANVAS_EDGES
            ),
            deleteCanvasEdge: id => ipc.invoke(
                SESSION_WORKSPACE_CHANNELS.DELETE_CANVAS_EDGE,
                id
            ),
        },
        council: {
            generatePlan: (taskId, task) => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.GENERATE_PLAN,
                { taskId, task }
            ),
            getProposal: taskId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.GET_PROPOSAL,
                { taskId }
            ),
            approveProposal: taskId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.APPROVE_PROPOSAL,
                { taskId }
            ),
            rejectProposal: (taskId, reason) => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.REJECT_PROPOSAL,
                { taskId, reason }
            ),
            startExecution: taskId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.START_EXECUTION,
                { taskId }
            ),
            pauseExecution: taskId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.PAUSE_EXECUTION,
                { taskId }
            ),
            resumeExecution: taskId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.RESUME_EXECUTION,
                { taskId }
            ),
            getTimeline: taskId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.GET_TIMELINE,
                { taskId }
            ),
            createVotingSession: payload => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.CREATE_VOTING_SESSION,
                payload
            ),
            submitVote: payload => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.SUBMIT_VOTE,
                payload
            ),
            requestVotes: payload => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.REQUEST_VOTES,
                payload
            ),
            resolveVoting: sessionId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.RESOLVE_VOTING,
                sessionId
            ),
            getVotingSession: sessionId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.GET_VOTING_SESSION,
                sessionId
            ),
            listVotingSessions: taskId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.LIST_VOTING_SESSIONS,
                taskId ? { taskId } : undefined
            ),
            getVotingAnalytics: taskId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.GET_VOTING_ANALYTICS,
                taskId ? { taskId } : undefined
            ),
            getVotingConfiguration: () => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.GET_VOTING_CONFIGURATION
            ),
            updateVotingConfiguration: patch => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.UPDATE_VOTING_CONFIGURATION,
                patch
            ),
            listVotingTemplates: () => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.LIST_VOTING_TEMPLATES
            ),
            buildConsensus: outputs => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.BUILD_CONSENSUS,
                outputs
            ),
            overrideVotingDecision: payload => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.OVERRIDE_VOTING_DECISION,
                payload
            ),
            createDebateSession: payload => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.CREATE_DEBATE_SESSION,
                payload
            ),
            submitDebateArgument: payload => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.SUBMIT_DEBATE_ARGUMENT,
                payload
            ),
            resolveDebateSession: sessionId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.RESOLVE_DEBATE_SESSION,
                sessionId
            ),
            overrideDebateSession: payload => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.OVERRIDE_DEBATE_SESSION,
                payload
            ),
            getDebateSession: sessionId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.GET_DEBATE_SESSION,
                sessionId
            ),
            listDebateHistory: taskId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.LIST_DEBATE_HISTORY,
                taskId ? { taskId } : undefined
            ),
            getDebateReplay: sessionId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.GET_DEBATE_REPLAY,
                sessionId
            ),
            generateDebateSummary: sessionId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.GENERATE_DEBATE_SUMMARY,
                sessionId
            ),
            getTeamworkAnalytics: () => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.GET_TEAMWORK_ANALYTICS,
                undefined
            ),
            sendMessage: payload => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.SEND_MESSAGE,
                payload
            ),
            getMessages: payload => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.GET_MESSAGES,
                payload
            ),
            cleanupExpiredMessages: taskId => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.CLEANUP_EXPIRED_MESSAGES,
                taskId ? { taskId } : undefined
            ),
            handleQuotaInterrupt: payload => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.HANDLE_QUOTA_INTERRUPT,
                payload
            ),
            registerWorkerAvailability: payload => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.REGISTER_WORKER_AVAILABILITY,
                payload
            ),
            listAvailableWorkers: payload => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.LIST_AVAILABLE_WORKERS,
                payload
            ),
            scoreHelperCandidates: payload => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.SCORE_HELPER_CANDIDATES,
                payload
            ),
            generateHelperHandoff: payload => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.GENERATE_HELPER_HANDOFF,
                payload
            ),
            reviewHelperMerge: payload => ipc.invoke(
                SESSION_COUNCIL_CHANNELS.REVIEW_HELPER_MERGE,
                payload
            ),
            onQuotaInterrupt: callback => {
                const listener = (
                    _event: IpcRendererEvent,
                    payload: SessionCouncilQuotaInterruptEvent
                ) => {
                    callback(payload);
                };
                ipc.on(SESSION_COUNCIL_CHANNELS.QUOTA_INTERRUPT_EVENT, listener);
                return () => {
                    ipc.removeListener(SESSION_COUNCIL_CHANNELS.QUOTA_INTERRUPT_EVENT, listener);
                };
            },
        },
        getState: sessionId => ipc.invoke(SESSION_CHANNELS.GET_STATE, sessionId),
        list: () => ipc.invoke(SESSION_CHANNELS.LIST),
        listCapabilities: () => ipc.invoke(SESSION_CHANNELS.LIST_CAPABILITIES),
        health: () => ipc.invoke(SESSION_CHANNELS.HEALTH),
        onEvent: callback => {
            const listener = (_event: IpcRendererEvent, payload: SessionEventEnvelope) => {
                callback(payload);
            };
            ipc.on(SESSION_CHANNELS.EVENT, listener);
            return () => ipc.removeListener(SESSION_CHANNELS.EVENT, listener);
        },
    };
}
