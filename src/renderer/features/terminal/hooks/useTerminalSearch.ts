/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useEffect, useRef, useState } from 'react';

import type { TerminalSearchMatch } from '../utils/terminal-search';

interface UseTerminalSearchOptions {
    storageKey: string;
    historyLimit: number;
}

function loadSearchHistory(storageKey: string, historyLimit: number): string[] {
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

export function useTerminalSearch({ storageKey, historyLimit }: UseTerminalSearchOptions) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchUseRegex, setSearchUseRegex] = useState(false);
    const [searchStatus, setSearchStatus] = useState<'idle' | 'found' | 'not-found' | 'invalid-regex'>(
        'idle'
    );
    const [searchMatches, setSearchMatches] = useState<TerminalSearchMatch[]>([]);
    const [searchActiveMatchIndex, setSearchActiveMatchIndex] = useState(-1);
    const [searchHistory, setSearchHistory] = useState<string[]>(() =>
        loadSearchHistory(storageKey, historyLimit)
    );
    const [searchHistoryIndex, setSearchHistoryIndex] = useState(-1);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchCursorRef = useRef<Record<string, { row: number; col: number }>>({});

    useEffect(() => {
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(searchHistory.slice(0, historyLimit)));
        } catch {
            // Ignore localStorage failures in restricted environments.
        }
    }, [historyLimit, searchHistory, storageKey]);

    return {
        searchQuery,
        setSearchQuery,
        searchUseRegex,
        setSearchUseRegex,
        searchStatus,
        setSearchStatus,
        searchMatches,
        setSearchMatches,
        searchActiveMatchIndex,
        setSearchActiveMatchIndex,
        searchHistory,
        setSearchHistory,
        searchHistoryIndex,
        setSearchHistoryIndex,
        searchInputRef,
        searchCursorRef,
    };
}

