import { IpcValue, Message, OrchestratorState, WorkspaceStep } from '@shared/types';
import { IpcRenderer, IpcRendererEvent } from 'electron';

export interface OrchestratorBridge {
    start: (task: string, workspaceId?: string) => Promise<void>;
    approve: (plan: WorkspaceStep[]) => Promise<void>;
    getState: () => Promise<OrchestratorState>;
    stop: () => Promise<void>;
    onUpdate: (callback: (state: OrchestratorState) => void) => () => void;
}

function normalizeOrchestratorPlan(plan: unknown[]): WorkspaceStep[] {
    return plan.map(item => {
        const step = item as Record<string, unknown>;
        return {
            id: typeof step['id'] === 'string' ? step['id'] : String(Math.random()),
            text: (typeof step['text'] === 'string' ? step['text'] : (typeof step['description'] === 'string' ? step['description'] : '')),
            status: (typeof step['status'] === 'string' ? step['status'] : 'pending') as WorkspaceStep['status'],
        };
    });
}

function normalizeOrchestratorHistory(history: unknown[]): Message[] {
    return history.map(item => {
        const msg = item as Record<string, unknown>;
        return {
            id: typeof msg['id'] === 'string' ? msg['id'] : String(Math.random()),
            role: (typeof msg['role'] === 'string' ? msg['role'] : 'user') as Message['role'],
            content: typeof msg['content'] === 'string' ? msg['content'] : '',
            timestamp: new Date(typeof msg['timestamp'] === 'number' ? msg['timestamp'] : Date.now()),
        };
    });
}

export function createOrchestratorBridge(ipc: IpcRenderer): OrchestratorBridge {
    return {
        start: (task, workspaceId) => ipc.invoke('orchestrator:start', task, workspaceId),
        approve: plan => ipc.invoke('orchestrator:approve', plan),
        getState: () => ipc.invoke('orchestrator:get-state'),
        stop: () => ipc.invoke('orchestrator:stop'),
        onUpdate: callback => {
            const listener = (_event: IpcRendererEvent, state: IpcValue) => {
                if (typeof state === 'object' && state !== null && !Array.isArray(state)) {
                    const candidate = state as Record<string, unknown>;
                    const hasShape =
                        typeof candidate['status'] === 'string' &&
                        typeof candidate['currentTask'] === 'string' &&
                        Array.isArray(candidate['plan']) &&
                        Array.isArray(candidate['history']) &&
                        typeof candidate['assignments'] === 'object' &&
                        candidate['assignments'] !== null &&
                        !Array.isArray(candidate['assignments']);
                    if (hasShape) {
                        const nextState: OrchestratorState = {
                            status: candidate['status'] as OrchestratorState['status'],
                            currentTask: candidate['currentTask'] as string,
                            plan: normalizeOrchestratorPlan(candidate['plan'] as unknown[]),
                            history: normalizeOrchestratorHistory(candidate['history'] as unknown[]),
                            assignments: candidate['assignments'] as Record<string, string>,
                        };
                        callback(nextState);
                    }
                }
            };
            ipc.on('orchestrator:update', listener);
            return () => ipc.removeListener('orchestrator:update', listener);
        },
    };
}
