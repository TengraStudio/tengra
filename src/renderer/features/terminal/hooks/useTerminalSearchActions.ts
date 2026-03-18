import { type Terminal as XTerm } from '@xterm/xterm';
import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback } from 'react';

import { TERMINAL_SEARCH_HISTORY_LIMIT } from '../constants/terminal-panel-constants';
import { TerminalSemanticIssue } from '../utils/terminal-panel-types';
import {
    collectTerminalSearchMatches,
    type TerminalSearchMatch,
} from '../utils/terminal-search';

interface UseTerminalSearchActionsParams {
    activeTabIdRef: MutableRefObject<string | null>;
    searchQuery: string;
    searchUseRegex: boolean;
    searchMatches: TerminalSearchMatch[];
    searchActiveMatchIndex: number;
    searchHistory: string[];
    searchHistoryIndex: number;
    searchCursorRef: MutableRefObject<Record<string, { row: number; col: number }>>;
    searchInputRef: MutableRefObject<HTMLInputElement | null>;
    hasActiveSession: boolean;
    getActiveTerminalInstance: () => XTerm | null;
    setSearchQuery: (query: string) => void;
    setSearchUseRegex: (useRegex: boolean) => void;
    setSearchStatus: Dispatch<SetStateAction<'idle' | 'found' | 'not-found' | 'invalid-regex'>>;
    setSearchMatches: (matches: TerminalSearchMatch[]) => void;
    setSearchActiveMatchIndex: (index: number) => void;
    setSearchHistory: (fn: (prev: string[]) => string[]) => void;
    setSearchHistoryIndex: (index: number) => void;
    setIsSearchOpen: (open: boolean) => void;
    setIsGalleryView: (open: boolean) => void;
    setIsSemanticPanelOpen: (open: boolean) => void;
    setIsCommandHistoryOpen: (open: boolean) => void;
    setIsTaskRunnerOpen: (open: boolean) => void;
    setIsMultiplexerOpen: (open: boolean) => void;
    setIsRecordingPanelOpen: (open: boolean) => void;
    setTerminalContextMenu: (menu: { x: number; y: number } | null) => void;
}

export function useTerminalSearchActions({
    activeTabIdRef,
    searchQuery,
    searchUseRegex,
    searchMatches,
    searchActiveMatchIndex,
    searchHistory,
    searchHistoryIndex,
    searchCursorRef,
    hasActiveSession,
    getActiveTerminalInstance,
    setSearchQuery,
    setSearchStatus,
    setSearchMatches,
    setSearchActiveMatchIndex,
    setSearchHistory,
    setSearchHistoryIndex,
    setIsSearchOpen,
    setIsGalleryView,
    setIsSemanticPanelOpen,
    setIsCommandHistoryOpen,
    setIsTaskRunnerOpen,
    setIsMultiplexerOpen,
    setIsRecordingPanelOpen,
    setTerminalContextMenu,
}: UseTerminalSearchActionsParams) {
    const resetActiveSearchCursor = useCallback(() => {
        if (!activeTabIdRef.current) {
            return;
        }
        delete searchCursorRef.current[activeTabIdRef.current];
        setSearchActiveMatchIndex(-1);
    }, [activeTabIdRef, searchCursorRef, setSearchActiveMatchIndex]);

    const pushSearchHistory = useCallback((query: string) => {
        const normalized = query.trim();
        if (!normalized) {
            return;
        }
        setSearchHistory(prev => {
            const next = [normalized, ...prev.filter(item => item !== normalized)];
            return next.slice(0, TERMINAL_SEARCH_HISTORY_LIMIT);
        });
        setSearchHistoryIndex(-1);
    }, [setSearchHistory, setSearchHistoryIndex]);

    const collectActiveSearchMatches = useCallback(() => {
        const terminal = getActiveTerminalInstance();
        const rawQuery = searchQuery.trim();
        if (!terminal || !rawQuery) {
            return { terminal, matches: [] as TerminalSearchMatch[], invalidRegex: false as const };
        }

        const buffer = terminal.buffer.active;
        const lines: string[] = [];
        for (let row = 0; row < buffer.length; row += 1) {
            lines.push(buffer.getLine(row)?.translateToString(true) ?? '');
        }

        const collected = collectTerminalSearchMatches(lines, rawQuery, {
            useRegex: searchUseRegex,
            caseSensitive: false,
            maxMatches: 400,
        });
        return {
            terminal,
            matches: collected.matches,
            invalidRegex: collected.invalidRegex,
        };
    }, [getActiveTerminalInstance, searchQuery, searchUseRegex]);

    const jumpToSearchMatch = useCallback(
        (index: number, matchesOverride?: TerminalSearchMatch[]) => {
            const terminal = getActiveTerminalInstance();
            const matches = matchesOverride ?? searchMatches;
            if (!terminal || matches.length === 0) {
                return;
            }
            const safeIndex = Math.max(0, Math.min(matches.length - 1, index));
            const target = matches[safeIndex];
            if (!target) {
                return;
            }
            terminal.select(target.col, target.row, target.length);
            terminal.scrollToLine(Math.max(0, target.row - Math.floor(terminal.rows / 2)));
            if (activeTabIdRef.current) {
                searchCursorRef.current[activeTabIdRef.current] = { row: target.row, col: target.col };
            }
            setSearchStatus('found');
            setSearchActiveMatchIndex(safeIndex);
        },
        [getActiveTerminalInstance, searchMatches, activeTabIdRef, searchCursorRef, setSearchStatus, setSearchActiveMatchIndex]
    );

    const runTerminalSearch = useCallback(
        (direction: 'next' | 'prev') => {
            const activeId = activeTabIdRef.current;
            if (!activeId) {
                setSearchStatus('idle');
                return false;
            }
            const rawQuery = searchQuery.trim();
            if (!rawQuery) {
                setSearchStatus('idle');
                setSearchMatches([]);
                setSearchActiveMatchIndex(-1);
                return false;
            }

            pushSearchHistory(rawQuery);
            const { terminal, matches, invalidRegex } = collectActiveSearchMatches();
            if (!terminal) {
                setSearchStatus('idle');
                return false;
            }
            if (invalidRegex) {
                setSearchStatus('invalid-regex');
                setSearchMatches([]);
                setSearchActiveMatchIndex(-1);
                return false;
            }

            setSearchMatches(matches);
            if (matches.length === 0) {
                setSearchStatus('not-found');
                setSearchActiveMatchIndex(-1);
                return false;
            }

            const nextIndex =
                searchActiveMatchIndex < 0
                    ? direction === 'next'
                        ? 0
                        : matches.length - 1
                    : direction === 'next'
                        ? (searchActiveMatchIndex + 1) % matches.length
                        : (searchActiveMatchIndex - 1 + matches.length) % matches.length;

            jumpToSearchMatch(nextIndex, matches);
            return true;
        },
        [collectActiveSearchMatches, jumpToSearchMatch, pushSearchHistory, searchActiveMatchIndex, searchQuery, activeTabIdRef, setSearchStatus, setSearchMatches, setSearchActiveMatchIndex]
    );

    const getSearchMatchLabel = useCallback(
        (match: TerminalSearchMatch): string => {
            const terminal = getActiveTerminalInstance();
            const line =
                terminal?.buffer.active.getLine(match.row)?.translateToString(true)?.trim() ?? '';
            if (!line) {
                return `Line ${match.row + 1}`;
            }
            return line.length > 72 ? `${line.slice(0, 72)}...` : line;
        },
        [getActiveTerminalInstance]
    );

    const applySearchHistoryAt = useCallback(
        (index: number) => {
            const candidate = searchHistory[index];
            if (!candidate) {
                return;
            }
            setSearchQuery(candidate);
            setSearchStatus('idle');
            setSearchMatches([]);
            setSearchActiveMatchIndex(-1);
            resetActiveSearchCursor();
            setSearchHistoryIndex(index);
        },
        [resetActiveSearchCursor, searchHistory, setSearchQuery, setSearchStatus, setSearchMatches, setSearchActiveMatchIndex, setSearchHistoryIndex]
    );

    const stepSearchHistory = useCallback(
        (direction: 'older' | 'newer') => {
            if (searchHistory.length === 0) {
                return;
            }

            if (direction === 'older') {
                const nextIndex = Math.min(searchHistoryIndex + 1, searchHistory.length - 1);
                applySearchHistoryAt(nextIndex);
                return;
            }

            const nextIndex = searchHistoryIndex - 1;
            if (nextIndex < 0) {
                setSearchHistoryIndex(-1);
                return;
            }
            applySearchHistoryAt(nextIndex);
        },
        [applySearchHistoryAt, searchHistory.length, searchHistoryIndex, setSearchHistoryIndex]
    );

    const openTerminalSearch = useCallback(() => {
        if (!hasActiveSession) {
            return;
        }
        setTerminalContextMenu(null);
        setIsGalleryView(false);
        setIsSemanticPanelOpen(false);
        setIsCommandHistoryOpen(false);
        setIsTaskRunnerOpen(false);
        setIsMultiplexerOpen(false);
        setIsRecordingPanelOpen(false);
        setIsSearchOpen(true);
        setSearchStatus('idle');
        setSearchMatches([]);
        setSearchActiveMatchIndex(-1);
        setSearchHistoryIndex(-1);
        resetActiveSearchCursor();
    }, [hasActiveSession, resetActiveSearchCursor, setIsCommandHistoryOpen, setIsTaskRunnerOpen, setTerminalContextMenu, setIsGalleryView, setIsSemanticPanelOpen, setIsMultiplexerOpen, setIsRecordingPanelOpen, setIsSearchOpen, setSearchStatus, setSearchMatches, setSearchActiveMatchIndex, setSearchHistoryIndex]);

    const closeTerminalSearch = useCallback(() => {
        setIsSearchOpen(false);
        setSearchStatus('idle');
        setSearchMatches([]);
        setSearchActiveMatchIndex(-1);
        setSearchHistoryIndex(-1);
        const terminal = getActiveTerminalInstance();
        terminal?.clearSelection();
        resetActiveSearchCursor();
    }, [getActiveTerminalInstance, resetActiveSearchCursor, setIsSearchOpen, setSearchStatus, setSearchMatches, setSearchActiveMatchIndex, setSearchHistoryIndex]);

    const revealSemanticIssue = useCallback(
        (issue: TerminalSemanticIssue) => {
            setIsSemanticPanelOpen(false);
            setSearchQuery(issue.message);
            setSearchStatus('idle');
            setSearchHistoryIndex(-1);
            setIsSearchOpen(true);
            resetActiveSearchCursor();
            window.setTimeout(() => {
                runTerminalSearch('next');
            }, 0);
        },
        [resetActiveSearchCursor, runTerminalSearch, setIsSemanticPanelOpen, setSearchQuery, setSearchStatus, setSearchHistoryIndex, setIsSearchOpen]
    );

    return {
        resetActiveSearchCursor,
        pushSearchHistory,
        collectActiveSearchMatches,
        jumpToSearchMatch,
        runTerminalSearch,
        getSearchMatchLabel,
        applySearchHistoryAt,
        stepSearchHistory,
        openTerminalSearch,
        closeTerminalSearch,
        revealSemanticIssue,
    };
}
