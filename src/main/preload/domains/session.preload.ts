import { toSessionConversationGenerationStatus } from '@main/preload/domains/session-conversation-event.util';
import {
    SESSION_CHANNELS,
    SESSION_CONVERSATION_CHANNELS,
    SESSION_COUNCIL_CHANNELS,
    SESSION_WORKSPACE_CHANNELS,
} from '@shared/constants/ipc-channels';
import type { SessionConversationApi } from '@shared/types/session-conversation';
import type {
    SessionCouncilApi,
    SessionWorkspaceAgentApi,
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

import { createWorkspaceAgentSessionBridge } from './workspace-agent-session.preload';

export interface SessionBridge {
    conversation: SessionConversationApi;
    workspace: SessionWorkspaceApi;
    council: SessionCouncilApi;
    workspaceAgent: SessionWorkspaceAgentApi;
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
                const listener = (_event: IpcRendererEvent, chunk: RuntimeValue) => {
                    callback(chunk as Parameters<Parameters<SessionBridge['conversation']['onStreamChunk']>[0]>[0]);
                };
                ipc.on(SESSION_CONVERSATION_CHANNELS.STREAM_CHUNK, listener);
                return () => ipc.removeListener(SESSION_CONVERSATION_CHANNELS.STREAM_CHUNK, listener);
            },
            onGenerationStatus: callback => {
                const listener = (_event: IpcRendererEvent, data: RuntimeValue) => {
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
            generatePlan: (taskId, task) => ipc.invoke(SESSION_COUNCIL_CHANNELS.GENERATE_PLAN, { taskId, task }),
            getProposal: taskId => ipc.invoke(SESSION_COUNCIL_CHANNELS.GET_PROPOSAL, { taskId }),
            approveProposal: taskId => ipc.invoke(SESSION_COUNCIL_CHANNELS.APPROVE_PROPOSAL, { taskId }),
            rejectProposal: (taskId, reason) => ipc.invoke(SESSION_COUNCIL_CHANNELS.REJECT_PROPOSAL, { taskId, reason }),
            startExecution: taskId => ipc.invoke(SESSION_COUNCIL_CHANNELS.START_EXECUTION, { taskId }),
            pauseExecution: taskId => ipc.invoke(SESSION_COUNCIL_CHANNELS.PAUSE_EXECUTION, { taskId }),
            resumeExecution: taskId => ipc.invoke(SESSION_COUNCIL_CHANNELS.RESUME_EXECUTION, { taskId }),
            getTimeline: taskId => ipc.invoke(SESSION_COUNCIL_CHANNELS.GET_TIMELINE, { taskId }),
            onQuotaInterrupt: callback => {
                const listener = (_event: IpcRendererEvent, payload: SessionCouncilQuotaInterruptEvent) => {
                    callback(payload);
                };
                ipc.on(SESSION_COUNCIL_CHANNELS.QUOTA_INTERRUPT_EVENT, listener);
                return () => {
                    ipc.removeListener(SESSION_COUNCIL_CHANNELS.QUOTA_INTERRUPT_EVENT, listener);
                };
            },
        },
        workspaceAgent: createWorkspaceAgentSessionBridge(ipc),
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
