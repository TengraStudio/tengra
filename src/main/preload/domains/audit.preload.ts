/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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
