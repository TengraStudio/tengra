/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { PROMPT_TEMPLATES_CHANNELS } from '@shared/constants/ipc-channels';
import { PromptTemplate } from '@shared/types/templates';
import { IpcRenderer } from 'electron';

export interface PromptTemplatesBridge {
    getAll: () => Promise<PromptTemplate[]>;
    search: (query: string) => Promise<PromptTemplate[]>;
    get: (id: string) => Promise<PromptTemplate | null>;
    create: (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PromptTemplate>;
    update: (id: string, updates: Partial<Omit<PromptTemplate, 'id' | 'createdAt'>>) => Promise<PromptTemplate>;
    delete: (id: string) => Promise<{ success: boolean }>;
    getCategories: () => Promise<string[]>;
}

export function createPromptTemplatesBridge(ipc: IpcRenderer): { promptTemplates: PromptTemplatesBridge } {
    return {
        promptTemplates: {
            getAll: () => ipc.invoke(PROMPT_TEMPLATES_CHANNELS.GET_ALL),
            search: (query: string) => ipc.invoke(PROMPT_TEMPLATES_CHANNELS.SEARCH, query),
            get: (id: string) => ipc.invoke(PROMPT_TEMPLATES_CHANNELS.GET, id),
            create: (template) => ipc.invoke(PROMPT_TEMPLATES_CHANNELS.CREATE, template),
            update: (id, updates) => ipc.invoke(PROMPT_TEMPLATES_CHANNELS.UPDATE, id, updates),
            delete: (id: string) => ipc.invoke(PROMPT_TEMPLATES_CHANNELS.DELETE, id),
            getCategories: () => ipc.invoke(PROMPT_TEMPLATES_CHANNELS.GET_CATEGORIES),
        }
    };
}

