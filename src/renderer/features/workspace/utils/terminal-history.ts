/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { safeJsonParse } from '@shared/utils/sanitize.util';

import { appLogger } from '@/utils/renderer-logger';

const HISTORY_KEY_PREFIX = 'Tengra_terminal_history_';
const MAX_HISTORY_SIZE = 500;

export const getHistoryKey = (workspaceId?: string): string => {
    return `${HISTORY_KEY_PREFIX}${workspaceId ?? 'global'}`;
};

export const loadHistory = (workspaceId?: string): string[] => {
    try {
        const stored = localStorage.getItem(getHistoryKey(workspaceId));
        if (stored) {
            return safeJsonParse<string[]>(stored, []);
        }
    } catch (error) {
        appLogger.warn('TerminalHistory', 'Failed to load terminal history', error as Error);
    }
    return [];
};

export const saveHistory = (history: string[], workspaceId?: string): void => {
    try {
        const trimmed = history.slice(-MAX_HISTORY_SIZE);
        localStorage.setItem(getHistoryKey(workspaceId), JSON.stringify(trimmed));
    } catch (error) {
        appLogger.warn('TerminalHistory', 'Failed to save terminal history', error as Error);
    }
};


