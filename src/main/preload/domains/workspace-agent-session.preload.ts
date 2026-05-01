/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
        delete: payload =>
            ipc.invoke(WORKSPACE_AGENT_SESSION_CHANNELS.DELETE, payload),
        resumeBackgroundState: payload =>
            ipc.invoke(
                WORKSPACE_AGENT_SESSION_CHANNELS.RESUME_BACKGROUND_STATE,
                payload
            ),
    };
}
