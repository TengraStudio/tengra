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
import { IconChevronDown, IconFileCode2 } from '@tabler/icons-react';
import React from 'react';
import { Virtuoso } from 'react-virtuoso';

import { useTranslation } from '@/i18n';

interface SearchResultsProps {
    results: FileSearchResult[];
    workspaceRoot: string;
    searchQuery: string;
    onSelect: (path: string, line?: number) => void;
    searchOptions?: {
        isRegex?: boolean;
        matchCase?: boolean;
        matchWholeWord?: boolean;
    };
}

interface GroupedSearchResults {
    file: string;
    items: FileSearchResult[];
}

function isFileResult(result: FileSearchResult): boolean {
    return result.type === 'file';
}

/**
 * Highlights matching substrings in a snippet using regex for accuracy.
 * Handles isRegex, matchCase, and matchWholeWord options.
 */
const renderHighlightedSnippet = (
    text: string, 
    query: string, 
    options?: SearchResultsProps['searchOptions']
): React.ReactNode => {
    if (!query.trim()) {
        return <span className="text-foreground/80">{text}</span>;
    }

    try {
        const { isRegex = false, matchCase = false, matchWholeWord = false } = options || {};
        let pattern = query;
        if (!isRegex) {
            pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        
        if (matchWholeWord && !isRegex) {
            pattern = `\\b${pattern}\\b`;
        }

        const regex = new RegExp(pattern, matchCase ? 'g' : 'gi');
        const fragments: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;
        let matchCount = 0;
        const MAX_MATCHES = 50;

        while ((match = regex.exec(text)) !== null && matchCount < MAX_MATCHES) {
            if (match.index > lastIndex) {
                fragments.push(<span key={`f-${lastIndex}`} className="text-foreground/80">{text.slice(lastIndex, match.index)}</span>);
            }

            fragments.push(
                <mark
                    key={`m-${matchCount}`}
                    className="rounded-sm bg-primary/15 text-primary font-medium px-0.5"
                >
                    {match[0]}
                </mark>
            );

            lastIndex = regex.lastIndex;
            matchCount++;
            
            if (match[0].length === 0) {
                regex.lastIndex++;
            }
        }

        if (lastIndex < text.length) {
            fragments.push(<span key={`f-${lastIndex}`} className="text-foreground/80">{text.slice(lastIndex)}</span>);
        }

        return fragments.length > 0 ? fragments : <span className="text-foreground/80">{text}</span>;
    } catch (e) {
        return <span className="text-foreground/80">{text}</span>;
    }
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
    searchOptions,
}: {
    group: GroupedSearchResults;
    workspaceRoot: string;
    searchQuery: string;
    onSelect: (path: string, line?: number) => void;
    searchOptions?: SearchResultsProps['searchOptions'];
}) => {
    const [collapsed, setCollapsed] = React.useState(false);
    const relativePath = group.file.replace(workspaceRoot, '').replace(/^[\\/]+/, '') || group.file;
    const fileName = relativePath.split(/[\\/]/).pop() ?? relativePath;
    const dirPath = relativePath.slice(0, Math.max(0, relativePath.length - fileName.length - 1)).replace(/\\/g, '/');

    return (
        <div className="group/file flex flex-col border-b border-border/5 last:border-0">
            {/* File header */}
            <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center gap-1.5 px-3 py-1 hover:bg-accent/30 transition-colors text-left group"
            >
                <span className="text-muted-foreground/40 transition-transform duration-150" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none' }}>
                    <IconChevronDown className="h-3.5 w-3.5" />
                </span>
                <IconFileCode2 className="h-4 w-4 text-info/60 shrink-0" />
                <span className="typo-caption font-semibold text-foreground/90 truncate">{fileName}</span>
                {dirPath && (
                    <span className="typo-caption text-[11px] text-muted-foreground/40 truncate ml-1">
                        {dirPath}
                    </span>
                )}
                <span className="ml-auto text-[10px] tabular-nums bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                    {group.items.length}
                </span>
            </button>

            {/* Match items */}
            {!collapsed && (
                <div className="flex flex-col">
                    {group.items.map((item, idx) => (
                        <button
                            key={`${item.file}-${item.line}-${idx}`}
                            type="button"
                            onClick={() => onSelect(item.file, item.line)}
                            className="flex items-start gap-3 pl-10 pr-3 py-0.5 hover:bg-accent/40 transition-colors text-left group/item"
                        >
                            <span className="typo-caption text-[11px] font-mono text-muted-foreground/30 min-w-[24px] text-right group-hover/item:text-muted-foreground/60 transition-colors pt-0.5">
                                {isFileResult(item) ? '' : item.line}
                            </span>
                            <div className="typo-caption text-foreground/75 font-mono whitespace-pre overflow-hidden text-ellipsis leading-5">
                                {renderHighlightedSnippet(item.text.trim(), searchQuery, searchOptions)}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});
FileGroup.displayName = 'FileGroup';

export const SearchResults: React.FC<SearchResultsProps> = ({
    results,
    workspaceRoot,
    searchQuery,
    onSelect,
    searchOptions,
}) => {
    const { t } = useTranslation();
    const VIRTUALIZATION_THRESHOLD = 100;

    const groupedResults = React.useMemo(() => {
        if (!results || !Array.isArray(results)) {return [];}
        
        const groupedMap = new Map<string, FileSearchResult[]>();
        results.forEach(r => {
            const items = groupedMap.get(r.file) || [];
            items.push(r);
            groupedMap.set(r.file, items);
        });

        return Array.from(groupedMap.entries()).map(([file, items]) => ({
            file,
            items: items.sort((a, b) => a.line - b.line)
        }));
    }, [results]);

    if (groupedResults.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center opacity-40">
                <span className="typo-caption text-foreground">{t('frontend.workspaceDashboard.noResults')}</span>
            </div>
        );
    }

    if (groupedResults.length > VIRTUALIZATION_THRESHOLD) {
        return (
            <div className="flex-1 overflow-hidden h-full">
                <Virtuoso
                    style={{ height: '100%' }}
                    data={groupedResults}
                    itemContent={(_, group) => (
                        <FileGroup
                            key={group.file}
                            group={group}
                            workspaceRoot={workspaceRoot}
                            searchQuery={searchQuery}
                            onSelect={onSelect}
                            searchOptions={searchOptions}
                        />
                    )}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-y-auto pb-4 custom-scrollbar">
            {groupedResults.map(group => (
                <FileGroup
                    key={group.file}
                    group={group}
                    workspaceRoot={workspaceRoot}
                    searchQuery={searchQuery}
                    onSelect={onSelect}
                    searchOptions={searchOptions}
                />
            ))}
        </div>
    );
};
