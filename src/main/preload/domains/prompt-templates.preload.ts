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
            getAll: () => ipc.invoke('prompt-templates:getAll'),
            search: (query: string) => ipc.invoke('prompt-templates:search', query),
            get: (id: string) => ipc.invoke('prompt-templates:get', id),
            create: (template) => ipc.invoke('prompt-templates:create', template),
            update: (id, updates) => ipc.invoke('prompt-templates:update', id, updates),
            delete: (id: string) => ipc.invoke('prompt-templates:delete', id),
            getCategories: () => ipc.invoke('prompt-templates:getCategories'),
        }
    };
}
