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
import { IconChevronDown, IconChevronRight, IconFileCode2 } from '@tabler/icons-react';
import React from 'react';
import { Virtuoso } from 'react-virtuoso';

import { useTranslation } from '@/i18n';

interface SearchResultsProps {
    results: FileSearchResult[];
    workspaceRoot: string;
    searchQuery: string;
    onSelect: (path: string, line?: number) => void;
}

interface GroupedSearchResults {
    file: string;
    items: FileSearchResult[];
}

function getSearchResultBadge(result: FileSearchResult): string {
    if (result.type === 'file') {
        return 'FILE';
    }
    if (result.type === 'content') {
        return 'TEXT';
    }
    return (result.type ?? 'SYMBOL').slice(0, 12).toUpperCase();
}

function isFileResult(result: FileSearchResult): boolean {
    return result.type === 'file';
}

/**
 * Highlights matching substrings in a snippet.
 * Returns React nodes with `<mark>` around matches.
 */
const renderHighlightedSnippet = (text: string, query: string): React.ReactNode => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return text;
    }

    const normalizedText = text.toLowerCase();
    const fragments: React.ReactNode[] = [];
    let startIndex = 0;
    let matchCount = 0;
    const MAX_MATCHES = 200;

    while (startIndex < text.length && matchCount < MAX_MATCHES) {
        const matchIndex = normalizedText.indexOf(normalizedQuery, startIndex);
        if (matchIndex === -1) {
            fragments.push(text.slice(startIndex));
            break;
        }

        if (matchIndex > startIndex) {
            fragments.push(text.slice(startIndex, matchIndex));
        }

        fragments.push(
            <mark
                key={`m-${matchCount}`}
                className="rounded-sm bg-warning/25 text-foreground"
            >
                {text.slice(matchIndex, matchIndex + normalizedQuery.length)}
            </mark>
        );
        startIndex = matchIndex + normalizedQuery.length;
        matchCount += 1;
    }

    return fragments.length > 0 ? fragments : text;
};

/**
 * Renders a single collapsible file group with match lines beneath.
 * Mimics VS Code's search results tree.
 */
const FileGroup = React.memo(({
    group,
    workspaceRoot,
    searchQuery,
    onSelect,
}: {
    group: GroupedSearchResults;
    workspaceRoot: string;
    searchQuery: string;
    onSelect: (path: string, line?: number) => void;
}) => {
    const [collapsed, setCollapsed] = React.useState(false);
    const relativePath = group.file.replace(workspaceRoot, '').replace(/^[\\/]+/, '') || group.file;
    const fileName = relativePath.split(/[\\/]/).pop() ?? relativePath;
    const dirPath = relativePath.slice(0, Math.max(0, relativePath.length - fileName.length - 1));

    return (
        <div className="border-b border-border/20">
            {/* File header */}
            <button
                type="button"
                onClick={() => setCollapsed(prev => !prev)}
                className="flex w-full items-center gap-1.5 px-2 py-1 text-left transition-colors hover:bg-accent/40"
            >
                {collapsed
                    ? <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                    : <IconChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                }
                <IconFileCode2 className="h-3.5 w-3.5 shrink-0 text-info/70" />
                <span className="truncate typo-caption font-medium text-foreground">
                    {fileName}
                </span>
                {dirPath && (
                    <span className="truncate text-sm text-muted-foreground/60">
                        {dirPath}
                    </span>
                )}
                <span className="ml-auto shrink-0 rounded-full bg-muted/50 px-1.5 py-0.5 text-sm font-medium tabular-nums text-muted-foreground">
                    {group.items.length}
                </span>
            </button>

            {/* Match lines */}
            {!collapsed && (
                <div>
                    {group.items.map((result, idx) => (
                        <button
                            key={`${result.file}:${result.line}:${idx}`}
                            type="button"
                            onClick={() => onSelect(result.file, result.line)}
                            className="flex w-full items-start gap-2 py-0.5 pl-8 pr-2 text-left transition-colors hover:bg-accent/40"
                        >
                            <span className="mt-px w-8 shrink-0 text-right font-mono text-sm tabular-nums text-muted-foreground/50">
                                {isFileResult(result) ? '' : result.line}
                            </span>
                            <span className="mt-px shrink-0 rounded bg-muted/50 px-1.5 py-0.5 text-sm font-semibold text-muted-foreground/80">
                                {getSearchResultBadge(result)}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-mono typo-caption leading-5 text-foreground/85">
                                {renderHighlightedSnippet(
                                    (isFileResult(result) ? result.name : result.text)?.trim() || result.text.trim(),
                                    searchQuery
                                )}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});
FileGroup.displayName = 'FileGroup';

/**
 * VS Code-style search results component.
 * Renders results grouped by file with collapsible sections.
 * Uses Virtuoso for large result sets.
 */
export const SearchResults: React.FC<SearchResultsProps> = ({
    results,
    workspaceRoot,
    searchQuery,
    onSelect,
}) => {
    const { t } = useTranslation();
    const VIRTUALIZATION_THRESHOLD = 120;

    const normalizedResults = React.useMemo(
        () => (Array.isArray(results) ? results : []),
        [results]
    );

    const groupedResults = React.useMemo(() => {
        const groups = new Map<string, FileSearchResult[]>();
        for (const result of normalizedResults) {
            const fileResults = groups.get(result.file) ?? [];
            fileResults.push(result);
            groups.set(result.file, fileResults);
        }
        return Array.from(groups.entries()).map(([file, items]) => ({ file, items }));
    }, [normalizedResults]);

    if (normalizedResults.length === 0) {
        return (
            <div className="flex items-center justify-center p-6 typo-caption text-muted-foreground/60">
                {t('workspaceDashboard.noResults')}
            </div>
        );
    }

    if (normalizedResults.length >= VIRTUALIZATION_THRESHOLD) {
        return (
            <Virtuoso
                className="h-full"
                data={groupedResults}
                itemContent={(_index, group) => (
                    <FileGroup
                        key={group.file}
                        group={group}
                        workspaceRoot={workspaceRoot}
                        searchQuery={searchQuery}
                        onSelect={onSelect}
                    />
                )}
            />
        );
    }

    return (
        <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/15">
            {groupedResults.map(group => (
                <FileGroup
                    key={group.file}
                    group={group}
                    workspaceRoot={workspaceRoot}
                    searchQuery={searchQuery}
                    onSelect={onSelect}
                />
            ))}
        </div>
    );
};

