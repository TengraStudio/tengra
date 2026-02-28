import { IpcValue } from '@shared/types';
import { IpcRenderer } from 'electron';

export interface AuditBridge {
    getLogs: (
        startDate?: string,
        endDate?: string,
        category?: string
    ) => Promise<
        Array<{
            timestamp: number;
            action: string;
            category: string;
            details?: Record<string, IpcValue>;
            success: boolean;
            error?: string;
        }>
    >;
}

export function createAuditBridge(ipc: IpcRenderer): AuditBridge {
    return {
        getLogs: (startDate, endDate, category) =>
            ipc.invoke('audit:get-logs', { startDate, endDate, category }),
    };
}
