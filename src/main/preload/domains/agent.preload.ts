/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { AGENT_CHANNELS } from '@shared/constants/ipc-channels';
import { AgentDefinition } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface AgentBridge {
    getAll: () => Promise<AgentDefinition[]>;
    get: (id: string) => Promise<AgentDefinition | null>;
    create: (payload: {
        agent: {
            id?: string;
            name: string;
            description?: string;
            systemPrompt: string;
            tools?: string[];
            parentModel?: string;
            color?: string;
        };
        options?: { cloneFromId?: string; createWorkspace?: boolean };
    }) => Promise<{ success: boolean; id?: string; workspacePath?: string; error?: string }>;
    delete: (
        id: string,
        options?: { confirm?: boolean; softDelete?: boolean; backupBeforeDelete?: boolean }
    ) => Promise<{ success: boolean; archivedId?: string; recoveryToken?: string; error?: string }>;
    clone: (id: string, newName?: string) => Promise<{ success: boolean; id?: string; error?: string }>;
    exportAgent: (id: string) => Promise<string | null>;
    importAgent: (payload: string) => Promise<{ success: boolean; id?: string; workspacePath?: string; error?: string }>;
    getTemplatesLibrary: () => Promise<Array<{
        id?: string;
        name: string;
        description: string;
        systemPrompt: string;
        tools: string[];
        parentModel?: string;
        color?: string;
        category?: string;
    }>>;
    validateTemplate: (template: {
        name?: string;
        description?: string;
        systemPrompt?: string;
        tools?: string[];
        parentModel?: string;
        color?: string;
    }) => Promise<{ valid: boolean; errors: string[] }>;
    recover: (archiveId: string) => Promise<{ success: boolean; id?: string; error?: string }>;
}

export function createAgentBridge(ipc: IpcRenderer): AgentBridge {
    return {
        getAll: () => ipc.invoke(AGENT_CHANNELS.GET_ALL),
        get: id => ipc.invoke(AGENT_CHANNELS.GET, id),
        create: payload => ipc.invoke(AGENT_CHANNELS.CREATE, payload),
        delete: (id, options) => ipc.invoke(AGENT_CHANNELS.DELETE, { id, options }),
        clone: (id, newName) => ipc.invoke(AGENT_CHANNELS.CLONE, { id, newName }),
        exportAgent: id => ipc.invoke(AGENT_CHANNELS.EXPORT, id),
        importAgent: payload => ipc.invoke(AGENT_CHANNELS.IMPORT, payload),
        getTemplatesLibrary: () => ipc.invoke(AGENT_CHANNELS.GET_TEMPLATES_LIBRARY),
        validateTemplate: template => ipc.invoke(AGENT_CHANNELS.VALIDATE_TEMPLATE, template),
        recover: archiveId => ipc.invoke(AGENT_CHANNELS.RECOVER, archiveId),
    };
}

