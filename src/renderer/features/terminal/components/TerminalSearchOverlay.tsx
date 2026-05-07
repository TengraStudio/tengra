/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconChevronDown, IconChevronUp, IconSearch, IconX } from '@tabler/icons-react';
import { type Dispatch, type RefObject, type SetStateAction } from 'react';

import { cn } from '@/lib/utils';

import type { TerminalSearchMatch } from '../utils/terminal-search';

interface TerminalSearchOverlayProps {
    t: (key: string, options?: Record<string, string | number>) => string;
    searchInputRef: RefObject<HTMLInputElement>;
    searchQuery: string;
    searchUseRegex: boolean;
    searchStatus: 'idle' | 'found' | 'not-found' | 'invalid-regex';
    searchMatches: TerminalSearchMatch[];
    searchActiveMatchIndex: number;
    searchHistory: string[];
    setSearchQuery: (value: string) => void;
    setSearchUseRegex: (value: boolean | ((prev: boolean) => boolean)) => void;
    setSearchStatus: Dispatch<SetStateAction<'idle' | 'found' | 'not-found' | 'invalid-regex'>>;
    setSearchMatches: (value: TerminalSearchMatch[]) => void;
    setSearchActiveMatchIndex: (value: number) => void;
    setSearchHistoryIndex: (value: number) => void;
    resetActiveSearchCursor: () => void;
    runTerminalSearch: (direction: 'next' | 'prev') => void;
    closeTerminalSearch: () => void;
    stepSearchHistory: (direction: 'older' | 'newer') => void;
    jumpToSearchMatch: (index: number) => void;
    getSearchMatchLabel: (match: TerminalSearchMatch) => string;
}

export function TerminalSearchOverlay({
    t,
    searchInputRef,
    searchQuery,
    searchUseRegex,
    searchStatus,
    searchMatches,
    searchActiveMatchIndex,
    searchHistory,
    setSearchQuery,
    setSearchUseRegex,
    setSearchStatus,
    setSearchMatches,
    setSearchActiveMatchIndex,
    setSearchHistoryIndex,
    resetActiveSearchCursor,
    runTerminalSearch,
    closeTerminalSearch,
    stepSearchHistory,
    jumpToSearchMatch,
    getSearchMatchLabel,
}: TerminalSearchOverlayProps) {
    return (
        <div className="absolute top-2 right-2 z-20 rounded-md border border-border/70 bg-popover/95 backdrop-blur px-2 py-1 min-w-300">
            <div className="flex items-center gap-1">
                <IconSearch className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={event => {
                        setSearchQuery(event.target.value);
                        setSearchStatus('idle');
                        setSearchMatches([]);
                        setSearchActiveMatchIndex(-1);
                        setSearchHistoryIndex(-1);
                        resetActiveSearchCursor();
                    }}
                    onKeyDown={event => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            runTerminalSearch(event.shiftKey ? 'prev' : 'next');
                        } else if (event.key === 'Escape') {
                            event.preventDefault();
                            closeTerminalSearch();
                        } else if (event.key === 'ArrowUp') {
                            event.preventDefault();
                            stepSearchHistory('older');
                        } else if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            stepSearchHistory('newer');
                        }
                    }}
                    placeholder={t('common.search')}
                    className="h-6 w-44 bg-transparent typo-caption outline-none text-foreground placeholder:text-muted-foreground"
                />
                <button
                    onClick={() => {
                        setSearchUseRegex(prev => !prev);
                        setSearchStatus('idle');
                        setSearchActiveMatchIndex(-1);
                    }}
                    className={cn(
                        'h-6 px-1.5 typo-overline rounded border transition-colors',
                        searchUseRegex
                            ? 'border-primary/70 text-primary bg-primary/10'
                            : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent/40'
                    )}
                    aria-label={t('frontend.terminal.searchRegex')}
                    title={t('frontend.terminal.searchRegex')}
                >
                    .*
                </button>
                <button
                    onClick={() => {
                        runTerminalSearch('prev');
                    }}
                    className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={t('frontend.aria.findPrevious')}
                >
                    <IconChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={() => {
                        runTerminalSearch('next');
                    }}
                    className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={t('frontend.aria.findNext')}
                >
                    <IconChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={closeTerminalSearch}
                    className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={t('common.close')}
                >
                    <IconX className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
                <span
                    className={cn(
                        'typo-overline',
                        searchStatus === 'invalid-regex' || searchStatus === 'not-found'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                    )}
                >
                    {searchStatus === 'invalid-regex'
                        ? t('frontend.terminal.invalidRegex')
                        : searchMatches.length > 0
                            ? `${searchActiveMatchIndex >= 0 ? searchActiveMatchIndex + 1 : 0}/${searchMatches.length}`
                            : searchStatus === 'not-found'
                                ? '0/0'
                                : ''}
                </span>
                {searchHistory.length > 0 && (
                    <div className="flex items-center gap-1 max-w-180 overflow-hidden">
                        {searchHistory.slice(0, 3).map(entry => (
                            <button
                                key={entry}
                                onClick={() => {
                                    setSearchQuery(entry);
                                    setSearchStatus('idle');
                                    setSearchMatches([]);
                                    setSearchActiveMatchIndex(-1);
                                    setSearchHistoryIndex(-1);
                                    resetActiveSearchCursor();
                                }}
                                className="px-1.5 py-0.5 rounded typo-overline text-muted-foreground hover:text-foreground hover:bg-accent/40 truncate max-w-56"
                                title={entry}
                            >
                                {entry}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {searchMatches.length > 0 && (
                <div className="mt-1 max-h-24 overflow-y-auto custom-scrollbar space-y-1 border-t border-border/50 pt-1">
                    {searchMatches.slice(0, 6).map((match, index) => (
                        <button
                            key={`${match.row}-${match.col}-${index}`}
                            onClick={() => {
                                jumpToSearchMatch(index);
                            }}
                            className={cn(
                                'w-full text-left px-1.5 py-1 rounded typo-overline transition-colors',
                                index === searchActiveMatchIndex
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                            )}
                            title={`${match.row + 1}:${match.col + 1}`}
                        >
                            {match.row + 1}:{match.col + 1} {getSearchMatchLabel(match)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

