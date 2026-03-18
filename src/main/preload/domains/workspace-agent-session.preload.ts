import { WORKSPACE_AGENT_SESSION_CHANNELS } from '@shared/constants/ipc-channels';
import type { SessionWorkspaceAgentApi } from '@shared/types/session-domain-apis';
import type { IpcRenderer } from 'electron';

export function createWorkspaceAgentSessionBridge(
    ipc: IpcRenderer
): SessionWorkspaceAgentApi {
    return {
        listByWorkspace: workspaceId =>
            ipc.invoke(
                WORKSPACE_AGENT_SESSION_CHANNELS.LIST_BY_WORKSPACE,
                workspaceId
            ),
        create: payload =>
            ipc.invoke(WORKSPACE_AGENT_SESSION_CHANNELS.CREATE, payload),
        rename: payload =>
            ipc.invoke(WORKSPACE_AGENT_SESSION_CHANNELS.RENAME, payload),
        select: payload =>
            ipc.invoke(WORKSPACE_AGENT_SESSION_CHANNELS.SELECT, payload),
        updatePersistence: payload =>
            ipc.invoke(
                WORKSPACE_AGENT_SESSION_CHANNELS.UPDATE_PERSISTENCE,
                payload
            ),
        updateModes: payload =>
            ipc.invoke(WORKSPACE_AGENT_SESSION_CHANNELS.UPDATE_MODES, payload),
        updatePermissions: payload =>
            ipc.invoke(
                WORKSPACE_AGENT_SESSION_CHANNELS.UPDATE_PERMISSIONS,
                payload
            ),
        updateStrategy: payload =>
            ipc.invoke(
                WORKSPACE_AGENT_SESSION_CHANNELS.UPDATE_STRATEGY,
                payload
            ),
        getContextTelemetry: payload =>
            ipc.invoke(
                WORKSPACE_AGENT_SESSION_CHANNELS.GET_CONTEXT_TELEMETRY,
                payload
            ),
        archive: payload =>
            ipc.invoke(WORKSPACE_AGENT_SESSION_CHANNELS.ARCHIVE, payload),
        resumeBackgroundState: payload =>
            ipc.invoke(
                WORKSPACE_AGENT_SESSION_CHANNELS.RESUME_BACKGROUND_STATE,
                payload
            ),
    };
}
