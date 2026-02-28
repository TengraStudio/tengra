import { EntityKnowledge, EpisodicMemory, SemanticFragment } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface MemoryBridge {
    addEpisodic: (memory: EpisodicMemory) => Promise<{ success: boolean }>;
    queryEpisodic: (query: string, options?: { limit?: number; minScore?: number }) => Promise<EpisodicMemory[]>;
    addSemantic: (fragment: SemanticFragment) => Promise<{ success: boolean }>;
    querySemantic: (query: string, options?: { limit?: number; minScore?: number }) => Promise<SemanticFragment[]>;
    getKnowledge: (entityName: string) => Promise<EntityKnowledge | null>;
    updateKnowledge: (entityName: string, updates: Partial<EntityKnowledge>) => Promise<{ success: boolean }>;
}

export function createMemoryBridge(ipc: IpcRenderer): MemoryBridge {
    return {
        addEpisodic: memory => ipc.invoke('memory:add-episodic', memory),
        queryEpisodic: (query, options) => ipc.invoke('memory:query-episodic', { query, options }),
        addSemantic: fragment => ipc.invoke('memory:add-semantic', fragment),
        querySemantic: (query, options) => ipc.invoke('memory:query-semantic', { query, options }),
        getKnowledge: entityName => ipc.invoke('memory:get-knowledge', entityName),
        updateKnowledge: (entityName, updates) => ipc.invoke('memory:update-knowledge', { entityName, updates }),
    };
}
