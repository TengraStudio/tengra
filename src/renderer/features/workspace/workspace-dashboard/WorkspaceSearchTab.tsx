/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { FileSearchResult } from '@shared/types/common';
import { IconArrowRightBar,IconChevronDown, IconChevronRight, IconFold, IconRefresh, IconRegex, IconSearch, IconSquareRoundedLetterW, IconX } from '@tabler/icons-react';
import { KeyboardEvent, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { SearchResults } from '@/features/workspace/components/SearchResults';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_WORKSPACESEARCHTAB_1 = "flex flex-1 items-center gap-2 rounded-sm border border-border/60 bg-input/30 px-2 py-1 transition-colors focus-within:border-info/50";
const C_WORKSPACESEARCHTAB_2 = "flex items-center gap-1 self-start rounded-sm px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground";
const C_WORKSPACESEARCHTAB_3 = "rounded-sm border border-border/40 bg-input/30 px-2 py-0.5 typo-caption text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-info/40";


interface WorkspaceSearchTabProps {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    replaceQuery: string;
    setReplaceQuery: (q: string) => void;
    isRegex: boolean;
    setIsRegex: (v: boolean) => void;
    matchCase: boolean;
    setMatchCase: (v: boolean) => void;
    matchWholeWord: boolean;
    setMatchWholeWord: (v: boolean) => void;
    includeGlob: string;
    setIncludeGlob: (v: string) => void;
    excludeGlob: string;
    setExcludeGlob: (v: string) => void;
    replaceExpanded: boolean;
    setReplaceExpanded: (v: boolean) => void;
    filtersExpanded: boolean;
    setFiltersExpanded: (v: boolean) => void;
    handleSearch: (options?: { isRegex?: boolean; matchCase?: boolean; matchWholeWord?: boolean }) => Promise<void>;
    handleReplaceAll: (options?: { isRegex?: boolean; matchCase?: boolean; matchWholeWord?: boolean }) => Promise<void>;
    isSearching: boolean;
    searchResults: FileSearchResult[];
    workspaceRoot: string;
    handleFileSelect: (path: string, line?: number) => void;
    t: (key: string) => string;
}

/**
 * VS Code-inspired workspace search panel.
 * Displays a compact search input with optional filters
 * and file-grouped collapsible results below.
 */
export const WorkspaceSearchTab = ({
    searchQuery,
    setSearchQuery,
    replaceQuery,
    setReplaceQuery,
    isRegex,
    setIsRegex,
    matchCase,
    setMatchCase,
    matchWholeWord,
    setMatchWholeWord,
    includeGlob,
    setIncludeGlob,
    excludeGlob,
    setExcludeGlob,
    replaceExpanded,
    setReplaceExpanded,
    filtersExpanded,
    setFiltersExpanded,
    handleSearch,
    handleReplaceAll,
    isSearching,
    searchResults,
    workspaceRoot,
    handleFileSelect,
    t
}: WorkspaceSearchTabProps) => {
    const normalizedResults = Array.isArray(searchResults) ? searchResults : [];
    const deferredResults = useDeferredValue(normalizedResults);
    const trimmedQuery = searchQuery.trim();

    const groupedFileCount = useMemo(
        () => new Set(deferredResults.map(r => r.file)).size,
        [deferredResults]
    );

    const filteredResults = deferredResults;



    const handleClear = useCallback(() => {
        setSearchQuery('');
        setIncludeGlob('');
        setExcludeGlob('');
    }, [setSearchQuery, setIncludeGlob, setExcludeGlob]);

    const [resultsVersion, setResultsVersion] = useState(0);

    const lastSearchRef = useRef<{ query: string; isRegex: boolean; matchCase: boolean; matchWholeWord: boolean } | null>(null);

    const onSearch = useCallback(() => {
        const searchOptions = { isRegex, matchCase, matchWholeWord };
        lastSearchRef.current = { query: searchQuery, ...searchOptions };
        void handleSearch(searchOptions);
    }, [handleSearch, searchQuery, isRegex, matchCase, matchWholeWord]);

    useEffect(() => {
        const trimmed = searchQuery.trim();
        if (trimmed.length < 2) {return;}

        // Skip if this query/options set was just searched
        const last = lastSearchRef.current;
        if (last?.query === searchQuery && 
            last.isRegex === isRegex && 
            last.matchCase === matchCase && 
            last.matchWholeWord === matchWholeWord &&
            searchResults.length > 0) {
            return;
        }

        const timer = setTimeout(() => {
            onSearch();
        }, 150);
        return () => clearTimeout(timer);
    }, [searchQuery, isRegex, matchCase, matchWholeWord, onSearch, searchResults.length]);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            onSearch();
        }
    };

    const handleCollapseAll = () => {
        setResultsVersion(v => v + 1);
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background">
            {/* Search Input Area */}
            <div className="flex flex-col gap-1 border-b border-border/50 px-3 pb-2 pt-2.5">
                {/* Primary search row */}
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setReplaceExpanded(!replaceExpanded)}
                        className="p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
                        title={t('frontend.workspaceDashboard.toggleReplace')}
                    >
                        {replaceExpanded ? <IconChevronDown className="h-3.5 w-3.5" /> : <IconChevronRight className="h-3.5 w-3.5" />}
                    </button>
                    <div className={C_WORKSPACESEARCHTAB_1}>
                        <input
                            type="text"
                            placeholder={t('frontend.workspaceDashboard.searchInWorkspace')}
                            className="min-w-0 flex-1 bg-transparent typo-caption text-foreground outline-none placeholder:text-muted-foreground/60"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        {searchQuery.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                title={t('common.clear')}
                            >
                                <IconX className="h-3.5 w-3.5" />
                            </button>
                        )}
                        <div className="flex items-center gap-0.5">
                            <SearchToggleButton 
                                active={matchCase}
                                onClick={() => setMatchCase(!matchCase)}
                                icon={<span className="text-[10px] font-bold">Aa</span>} 
                                title={t('frontend.workspaceDashboard.searchMatchCaseTitle')} 
                            />
                            <SearchToggleButton 
                                active={matchWholeWord}
                                onClick={() => setMatchWholeWord(!matchWholeWord)}
                                icon={<IconSquareRoundedLetterW className="h-4 w-4" />} 
                                title={t('frontend.workspaceDashboard.searchMatchWholeWordTitle')} 
                            />
                            <SearchToggleButton 
                                active={isRegex}
                                onClick={() => setIsRegex(!isRegex)}
                                icon={<IconRegex className="h-4 w-4" />} 
                                title={t('frontend.workspaceDashboard.searchUseRegexTitle')} 
                            />
                        </div>
                    </div>
                </div>

                {/* Replace row */}
                {replaceExpanded && (
                    <div className="flex items-center gap-1 pl-5">
                        <div className={C_WORKSPACESEARCHTAB_1}>
                            <input
                                type="text"
                                placeholder={t('frontend.workspaceDashboard.replace')}
                                className="min-w-0 flex-1 bg-transparent typo-caption text-foreground outline-none placeholder:text-muted-foreground/60"
                                value={replaceQuery}
                                onChange={e => setReplaceQuery(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => void handleReplaceAll({ isRegex, matchCase, matchWholeWord })}
                                disabled={!searchQuery || !replaceQuery || searchResults.length === 0}
                                className="p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-30"
                                title={t('frontend.workspaceDashboard.replaceAll')}
                            >
                                <IconArrowRightBar className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Files to include/exclude toggle */}
                <button
                    type="button"
                    onClick={() => setFiltersExpanded(!filtersExpanded)}
                    className={C_WORKSPACESEARCHTAB_2}
                >
                    {filtersExpanded
                        ? <IconChevronDown className="h-3 w-3" />
                        : <IconChevronRight className="h-3 w-3" />
                    }
                    {t('frontend.workspaceDashboard.files')}
                </button>

                {filtersExpanded && (
                    <div className="flex flex-col gap-1 pl-4">
                        <FilterInput
                            placeholder={t('frontend.workspaceDashboard.searchIncludePatternPlaceholder')}
                            value={includeGlob}
                            onChange={setIncludeGlob}
                        />
                        <FilterInput
                            placeholder={t('frontend.workspaceDashboard.searchExcludePatternPlaceholder')}
                            value={excludeGlob}
                            onChange={setExcludeGlob}
                        />
                    </div>
                )}
            </div>

            {/* Results summary */}
            {trimmedQuery.length >= 2 && (
                <div className="flex items-center justify-between border-b border-border/30 px-3 py-1.5">
                    {isSearching ? (
                        <span className="text-sm text-muted-foreground animate-pulse">
                            {t('common.searching')}
                        </span>
                    ) : (
                        <span className="text-sm text-muted-foreground">
                            {filteredResults.length} {t('frontend.semanticSearch.results').toLowerCase()} — {groupedFileCount} {t('frontend.workspaceDashboard.files').toLowerCase()}
                        </span>
                    )}
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={onSearch}
                            className="p-1 text-muted-foreground/60 hover:text-foreground transition-colors"
                            title={t('common.refresh')}
                        >
                            <IconRefresh className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={handleCollapseAll}
                            className="p-1 text-muted-foreground/60 hover:text-foreground transition-colors"
                            title={t('common.collapseAll')}
                        >
                            <IconFold className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Results area */}
            <div className="min-h-0 flex-1 overflow-hidden">
                {trimmedQuery.length < 2 && !isSearching ? (
                    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                        <IconSearch className="mb-3 h-8 w-8 text-muted-foreground/30" />
                        <p className="typo-caption text-muted-foreground/60">
                            {t('frontend.workspaceDashboard.searchInWorkspace')}
                        </p>
                    </div>
                ) : (
                    <SearchResults
                        key={resultsVersion}
                        results={filteredResults}
                        workspaceRoot={workspaceRoot}
                        searchQuery={searchQuery}
                        searchOptions={{ isRegex, matchCase, matchWholeWord }}
                        onSelect={(path, line) => { void handleFileSelect(path, line); }}
                    />
                )}
            </div>
        </div>
    );
};

/* ---------- Sub-components ---------- */

interface SearchToggleButtonProps {
    icon: JSX.Element;
    title: string;
    active?: boolean;
    onClick?: () => void;
}

/**
 * Small toggle button used for search mode options
 * (case-sensitive, whole word, regex).
 */
const SearchToggleButton = ({ icon, title, active = false, onClick }: SearchToggleButtonProps) => {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className={cn(
                'rounded-sm p-1 transition-colors',
                active
                    ? 'bg-info/15 text-info'
                    : 'text-muted-foreground/60 hover:bg-accent/60 hover:text-muted-foreground'
            )}
        >
            {icon}
        </button>
    );
};

interface FilterInputProps {
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
}

/** Compact filter input for include/exclude glob patterns. */
const FilterInput = ({ placeholder, value, onChange }: FilterInputProps) => (
    <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={C_WORKSPACESEARCHTAB_3}
    />
);



