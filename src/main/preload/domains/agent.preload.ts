/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
        getAll: () => ipc.invoke('agent:get-all'),
        get: id => ipc.invoke('agent:get', id),
        create: payload => ipc.invoke('agent:create', payload),
        delete: (id, options) => ipc.invoke('agent:delete', { id, options }),
        clone: (id, newName) => ipc.invoke('agent:clone', { id, newName }),
        exportAgent: id => ipc.invoke('agent:export', id),
        importAgent: payload => ipc.invoke('agent:import', payload),
        getTemplatesLibrary: () => ipc.invoke('agent:get-templates'),
        validateTemplate: template => ipc.invoke('agent:validate-template', template),
        recover: archiveId => ipc.invoke('agent:recover', archiveId),
    };
}
