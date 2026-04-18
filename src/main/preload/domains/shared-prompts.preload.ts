/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
            list: filter => ipc.invoke('prompts:shared-list', filter),
            create: input => ipc.invoke('prompts:shared-create', input),
            update: (id, input) => ipc.invoke('prompts:shared-update', id, input),
            delete: id => ipc.invoke('prompts:shared-delete', id),
            export: filePath => ipc.invoke('prompts:shared-export', filePath),
            import: (filePathOrJson, isFilePath) => ipc.invoke('prompts:shared-import', filePathOrJson, isFilePath),
        },
    };
}
