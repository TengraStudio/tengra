/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { EntityKnowledge, EpisodicMemory, SemanticFragment } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface MemoryBridge {
    getAll: () => Promise<{
        facts: SemanticFragment[];
        episodes: EpisodicMemory[];
        entities: EntityKnowledge[];
    }>;
    addFact: (content: string, tags?: string[]) => Promise<{ success: boolean; id?: string; error?: string }>;
    deleteFact: (id: string) => Promise<{ success: boolean; error?: string }>;
    deleteEntity: (id: string) => Promise<{ success: boolean; error?: string }>;
    setEntityFact: (
        entityType: string,
        entityName: string,
        key: string,
        value: string
    ) => Promise<{ success: boolean; id?: string; error?: string }>;
    search: (query: string) => Promise<{ facts: SemanticFragment[]; episodes: EpisodicMemory[] }>;
}

export function createMemoryBridge(ipc: IpcRenderer): MemoryBridge {
    return {
        getAll: () => ipc.invoke('memory:getAll'),
        addFact: (content, tags) => ipc.invoke('memory:addFact', content, tags),
        deleteFact: id => ipc.invoke('memory:deleteFact', id),
        deleteEntity: id => ipc.invoke('memory:deleteEntity', id),
        setEntityFact: (entityType, entityName, key, value) =>
            ipc.invoke('memory:setEntityFact', entityType, entityName, key, value),
        search: query => ipc.invoke('memory:search', query),
    };
}
