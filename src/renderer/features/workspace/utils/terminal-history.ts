import { safeJsonParse } from '@shared/utils/sanitize.util';

const HISTORY_KEY_PREFIX = 'Tengra_terminal_history_';
const MAX_HISTORY_SIZE = 500;

export const getHistoryKey = (workspaceId?: string) => {
    return `${HISTORY_KEY_PREFIX}${workspaceId ?? 'global'}`;
};

export const loadHistory = (workspaceId?: string): string[] => {
    try {
        const stored = localStorage.getItem(getHistoryKey(workspaceId));
        if (stored) {
            return safeJsonParse<string[]>(stored, []);
        }
    } catch (error) {
        window.electron.log.warn('Failed to load terminal history:', error);
    }
    return [];
};

export const saveHistory = (history: string[], workspaceId?: string) => {
    try {
        const trimmed = history.slice(-MAX_HISTORY_SIZE);
        localStorage.setItem(getHistoryKey(workspaceId), JSON.stringify(trimmed));
    } catch (error) {
        window.electron.log.warn('Failed to save terminal history:', error);
    }
};


