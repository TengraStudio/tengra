/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { SearchResults } from '@renderer/features/workspace/components/SearchResults';
import { FileSearchResult } from '@shared/types/common';
import {
    CaseSensitive,
    ChevronDown,
    ChevronRight,
    Regex,
    Search,
    WholeWord,
    X,
} from 'lucide-react';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_WORKSPACESEARCHTAB_1 = "flex flex-1 items-center gap-2 rounded-sm border border-border/60 bg-input/30 px-2 py-1 transition-colors focus-within:border-info/50";
const C_WORKSPACESEARCHTAB_2 = "flex items-center gap-1 self-start rounded-sm px-1 py-0.5 text-xxs text-muted-foreground transition-colors hover:text-foreground";
const C_WORKSPACESEARCHTAB_3 = "rounded-sm border border-border/40 bg-input/30 px-2 py-0.5 typo-caption text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-info/40";


interface WorkspaceSearchTabProps {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    handleSearch: () => Promise<void>;
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
    handleSearch,
    isSearching,
    searchResults,
    workspaceRoot,
    handleFileSelect,
    t
}: WorkspaceSearchTabProps) => {
    const normalizedResults = Array.isArray(searchResults) ? searchResults : [];
    const deferredResults = useDeferredValue(normalizedResults);
    const trimmedQuery = searchQuery.trim();

    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [includeGlob, setIncludeGlob] = useState('');
    const [excludeGlob, setExcludeGlob] = useState('');

    const groupedFileCount = useMemo(
        () => new Set(deferredResults.map(r => r.file)).size,
        [deferredResults]
    );

    const filteredResults = useMemo(() => {
        if (!includeGlob.trim() && !excludeGlob.trim()) {
            return deferredResults;
        }
        return deferredResults.filter(result => {
            const relativePath = result.file.replace(workspaceRoot, '').replace(/\\/g, '/');
            if (includeGlob.trim()) {
                const includePatterns = includeGlob.split(',').map(p => p.trim()).filter(Boolean);
                const matchesInclude = includePatterns.some(pattern => simpleGlobMatch(relativePath, pattern));
                if (!matchesInclude) {
                    return false;
                }
            }
            if (excludeGlob.trim()) {
                const excludePatterns = excludeGlob.split(',').map(p => p.trim()).filter(Boolean);
                const matchesExclude = excludePatterns.some(pattern => simpleGlobMatch(relativePath, pattern));
                if (matchesExclude) {
                    return false;
                }
            }
            return true;
        });
    }, [deferredResults, includeGlob, excludeGlob, workspaceRoot]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            void handleSearch();
        }
    }, [handleSearch]);

    const handleClear = useCallback(() => {
        setSearchQuery('');
        setIncludeGlob('');
        setExcludeGlob('');
    }, [setSearchQuery]);

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background">
            {/* Search Input Area */}
            <div className="flex flex-col gap-1 border-b border-border/50 px-3 pb-2 pt-2.5">
                {/* Primary search row */}
                <div className="flex items-center gap-1">
                    <div className={C_WORKSPACESEARCHTAB_1}>
                        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder={t('workspaceDashboard.searchInWorkspace')}
                            className="min-w-0 flex-1 bg-transparent typo-caption text-foreground outline-none placeholder:text-muted-foreground/60"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        {trimmedQuery.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                title={t('common.clear')}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    {/* Toggle buttons (decorative — VS Code-style) */}
                    <div className="flex items-center gap-0.5">
                        <SearchToggleButton icon={<CaseSensitive className="h-4 w-4" />} title={t('workspaceDashboard.searchMatchCaseTitle')} />
                        <SearchToggleButton icon={<WholeWord className="h-4 w-4" />} title={t('workspaceDashboard.searchMatchWholeWordTitle')} />
                        <SearchToggleButton icon={<Regex className="h-4 w-4" />} title={t('workspaceDashboard.searchUseRegexTitle')} />
                    </div>
                </div>

                {/* Files to include/exclude toggle */}
                <button
                    type="button"
                    onClick={() => setFiltersExpanded(prev => !prev)}
                    className={C_WORKSPACESEARCHTAB_2}
                >
                    {filtersExpanded
                        ? <ChevronDown className="h-3 w-3" />
                        : <ChevronRight className="h-3 w-3" />
                    }
                    {t('workspaceDashboard.files')}
                </button>

                {filtersExpanded && (
                    <div className="flex flex-col gap-1 pl-4">
                        <FilterInput
                            placeholder={t('workspaceDashboard.searchIncludePatternPlaceholder')}
                            value={includeGlob}
                            onChange={setIncludeGlob}
                        />
                        <FilterInput
                            placeholder={t('workspaceDashboard.searchExcludePatternPlaceholder')}
                            value={excludeGlob}
                            onChange={setExcludeGlob}
                        />
                    </div>
                )}
            </div>

            {/* Results summary */}
            {trimmedQuery.length >= 2 && (
                <div className="flex items-center gap-2 border-b border-border/30 px-3 py-1.5">
                    {isSearching ? (
                        <span className="text-xxs text-muted-foreground">
                            {t('common.searching')}
                        </span>
                    ) : (
                        <span className="text-xxs text-muted-foreground">
                            {filteredResults.length} {t('semanticSearch.results').toLowerCase()} — {groupedFileCount} {t('workspaceDashboard.files').toLowerCase()}
                        </span>
                    )}
                </div>
            )}

            {/* Results area */}
            <div className="min-h-0 flex-1 overflow-hidden">
                {trimmedQuery.length < 2 && !isSearching ? (
                    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                        <Search className="mb-3 h-8 w-8 text-muted-foreground/30" />
                        <p className="typo-caption text-muted-foreground/60">
                            {t('workspaceDashboard.searchInWorkspace')}
                        </p>
                    </div>
                ) : (
                    <SearchResults
                        results={filteredResults}
                        workspaceRoot={workspaceRoot}
                        searchQuery={searchQuery}
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
}

/**
 * Small toggle button used for search mode options
 * (case-sensitive, whole word, regex).
 */
const SearchToggleButton = ({ icon, title }: SearchToggleButtonProps) => {
    const [active, setActive] = useState(false);
    return (
        <button
            type="button"
            title={title}
            onClick={() => setActive(prev => !prev)}
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

/**
 * Simple glob matching for include/exclude filters.
 * Supports `*` (any chars) and basic extension matching.
 */
function simpleGlobMatch(path: string, pattern: string): boolean {
    const normalized = path.toLowerCase();
    const pat = pattern.toLowerCase().trim();

    if (!pat) {
        return true;
    }
    // Direct substring match
    if (normalized.includes(pat)) {
        return true;
    }
    // *.ext style
    if (pat.startsWith('*.')) {
        return normalized.endsWith(pat.slice(1));
    }
    // **/ prefix
    if (pat.startsWith('**/')) {
        return normalized.includes(pat.slice(3));
    }
    return false;
}

