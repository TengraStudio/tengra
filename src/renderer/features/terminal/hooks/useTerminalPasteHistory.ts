import { useEffect, useState } from 'react';

interface UseTerminalPasteHistoryOptions {
    storageKey: string;
    historyLimit: number;
}

function loadPasteHistory(storageKey: string, historyLimit: number): string[] {
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .filter((item): item is string => typeof item === 'string')
            .map(item => item.trim())
            .filter(Boolean)
            .slice(0, historyLimit);
    } catch {
        return [];
    }
}

export function useTerminalPasteHistory({ storageKey, historyLimit }: UseTerminalPasteHistoryOptions) {
    const [pasteHistory, setPasteHistory] = useState<string[]>(() =>
        loadPasteHistory(storageKey, historyLimit)
    );

    useEffect(() => {
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(pasteHistory.slice(0, historyLimit)));
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [historyLimit, pasteHistory, storageKey]);

    return { pasteHistory, setPasteHistory };
}
