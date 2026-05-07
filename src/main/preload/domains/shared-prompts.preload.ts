/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { SHARED_PROMPTS_CHANNELS } from '@shared/constants/ipc-channels';
import type { IpcRenderer } from 'electron';

export interface SharedPromptRecord {
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    author: string;
    createdAt: number;
    updatedAt: number;
}

export interface SharedPromptInput {
    title: string;
    content: string;
    category?: string;
    tags?: string[];
    author?: string;
}

export interface SharedPromptFilter {
    query?: string;
    category?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
}

export interface SharedPromptsBridge {
    list: (filter?: SharedPromptFilter) => Promise<SharedPromptRecord[]>;
    create: (input: SharedPromptInput) => Promise<SharedPromptRecord>;
    update: (id: string, input: Partial<SharedPromptInput>) => Promise<SharedPromptRecord | undefined>;
    delete: (id: string) => Promise<boolean>;
    export: (filePath?: string) => Promise<{ success: boolean; path?: string; data?: string }>;
    import: (filePathOrJson: string, isFilePath?: boolean) => Promise<{ success: boolean; imported: number }>;
}

export function createSharedPromptsBridge(ipc: IpcRenderer): { sharedPrompts: SharedPromptsBridge } {
    return {
        sharedPrompts: {
            list: filter => ipc.invoke(SHARED_PROMPTS_CHANNELS.LIST, filter),
            create: input => ipc.invoke(SHARED_PROMPTS_CHANNELS.CREATE, input),
            update: (id, input) => ipc.invoke(SHARED_PROMPTS_CHANNELS.UPDATE, id, input),
            delete: id => ipc.invoke(SHARED_PROMPTS_CHANNELS.DELETE, id),
            export: filePath => ipc.invoke(SHARED_PROMPTS_CHANNELS.EXPORT_TO_FILE, filePath),
            import: (filePathOrJson, isFilePath) => ipc.invoke(SHARED_PROMPTS_CHANNELS.IMPORT_FROM_FILE, filePathOrJson, isFilePath),
        },
    };
}

