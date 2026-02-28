import { Workflow, WorkflowExecutionResult } from '@shared/types/workflow.types';
import { IpcRenderer } from 'electron';

export interface WorkflowBridge {
    getAll: () => Promise<Workflow[]>;
    get: (id: string) => Promise<Workflow | null>;
    create: (workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Workflow>;
    update: (id: string, updates: Partial<Workflow>) => Promise<Workflow>;
    delete: (id: string) => Promise<boolean>;
    execute: (id: string, context?: Record<string, unknown>) => Promise<WorkflowExecutionResult>;
    triggerManual: (triggerId: string, context?: Record<string, unknown>) => Promise<WorkflowExecutionResult>;
}


export function createWorkflowBridge(ipc: IpcRenderer): WorkflowBridge {
    return {
        getAll: () => ipc.invoke('workflow:getAll'),
        get: id => ipc.invoke('workflow:get', id),
        create: workflow => ipc.invoke('workflow:create', workflow),
        update: (id, updates) => ipc.invoke('workflow:update', id, updates),
        delete: id => ipc.invoke('workflow:delete', id),
        execute: (id, context) => ipc.invoke('workflow:execute', id, context),
        triggerManual: (triggerId, context) =>
            ipc.invoke('workflow:triggerManual', triggerId, context),
    };
}
