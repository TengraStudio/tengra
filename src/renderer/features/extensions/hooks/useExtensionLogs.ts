/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useCallback, useEffect, useState } from 'react';

export interface ExtensionLogEntry {
    extensionId: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    timestamp: number;
}

/**
 * Hook for listening to extension log updates
 */
export function useExtensionLogs(extensionId?: string) {
    const [logs, setLogs] = useState<ExtensionLogEntry[]>([]);

    useEffect(() => {
        const removeListener = window.electron.ipcRenderer.on(
            'extension:log-update',
            (_event, log: ExtensionLogEntry) => {
                if (extensionId && log.extensionId !== extensionId) {
                    return;
                }
                setLogs((prev) => [...prev.slice(-1000), log]); // Keep last 1000 logs
            }
        );

        return () => {
            if (typeof removeListener === 'function') {
                removeListener();
            }
        };
    }, [extensionId]);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    return { logs, clearLogs };
}
