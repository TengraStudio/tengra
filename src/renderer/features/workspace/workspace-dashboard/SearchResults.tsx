import { FileSearchResult } from '@shared/types/common';
import { ChevronDown, ChevronRight, FileCode2 } from 'lucide-react';
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
                className="rounded-sm bg-amber-400/25 text-foreground"
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
                className="flex w-full items-center gap-1.5 px-2 py-[5px] text-left transition-colors hover:bg-white/[0.04]"
            >
                {collapsed
                    ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                    : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                }
                <FileCode2 className="h-3.5 w-3.5 shrink-0 text-cyan-300/70" />
                <span className="truncate text-[13px] font-medium text-foreground">
                    {fileName}
                </span>
                {dirPath && (
                    <span className="truncate text-[11px] text-muted-foreground/60">
                        {dirPath}
                    </span>
                )}
                <span className="ml-auto shrink-0 rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
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
                            className="flex w-full items-start gap-2 py-[3px] pl-8 pr-2 text-left transition-colors hover:bg-white/[0.04]"
                        >
                            <span className="mt-px w-8 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground/50">
                                {result.line}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-mono text-[12px] leading-[18px] text-foreground/85">
                                {renderHighlightedSnippet(result.text.trim(), searchQuery)}
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
            <div className="flex items-center justify-center p-6 text-[13px] text-muted-foreground/60">
                {t('workspaceDashboard.noResults')}
            </div>
        );
    }

    if (normalizedResults.length >= VIRTUALIZATION_THRESHOLD) {
        return (
            <Virtuoso
                style={{ height: '100%' }}
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
