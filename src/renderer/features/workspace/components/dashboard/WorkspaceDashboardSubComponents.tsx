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
import { IconTrash } from '@tabler/icons-react';
import { Virtuoso } from 'react-virtuoso';

/* Batch-02: Extracted Long Classes */
const C_WORKSPACEDASHBOARDSUBCOMPONENTS_1 = "px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg border border-destructive/20 transition-colors text-sm font-medium";


interface SearchResultsProps {
    results: FileSearchResult[];
    workspaceRoot: string;
    searchQuery: string;
    onSelect: (path: string, line?: number) => void;
    t: (key: string) => string;
}

function renderHighlightedSnippet(text: string, query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return text;
    }

    const normalizedText = text.toLowerCase();
    const fragments: Array<string | JSX.Element> = [];
    let startIndex = 0;
    let matchCount = 0;

    while (startIndex < text.length) {
        const matchIndex = normalizedText.indexOf(normalizedQuery, startIndex);
        if (matchIndex === -1) {
            fragments.push(text.slice(startIndex));
            break;
        }

        if (matchIndex > startIndex) {
            fragments.push(text.slice(startIndex, matchIndex));
        }

        fragments.push(
            <mark key={`match-${matchCount}`} className="bg-primary/20 text-foreground rounded px-0.5">
                {text.slice(matchIndex, matchIndex + normalizedQuery.length)}
            </mark>
        );
        startIndex = matchIndex + normalizedQuery.length;
        matchCount += 1;
    }

    return fragments.length > 0 ? fragments : text;
}

export function SearchResults({ results, workspaceRoot, searchQuery, onSelect, t }: SearchResultsProps) {
    if (results.length === 0) {
        return (
            <div className="text-center text-muted-foreground mt-10">
                {t('workspaceDashboard.noResults')}
            </div>
        );
    }

    return (
        <Virtuoso
            className="h-full"
            data={results}
            itemContent={(_index, res) => (
                <div
                    onClick={() => onSelect(res.file, res.line)}
                    className="p-2 hover:bg-muted/20 rounded cursor-pointer group mb-2 mx-1"
                >
                    <div className="flex items-center gap-2 typo-caption text-primary mb-0.5">
                        <span className="font-mono">
                            {res.file.replace(workspaceRoot, '')}:{res.line}
                        </span>
                        {res.type && (
                            <span className="px-1.5 py-0.5 bg-primary/10 rounded-full text-sm">
                                {res.type}
                            </span>
                        )}
                    </div>
                    <div className="text-sm text-muted-foreground font-mono line-clamp-1 opacity-80 group-hover:opacity-100">
                        {renderHighlightedSnippet(res.text.trim(), searchQuery)}
                    </div>
                </div>
            )}
        />
    );
}

interface DangerZoneProps {
    onDelete: () => void;
    t: (key: string) => string;
}

export function DangerZone({ onDelete, t }: DangerZoneProps) {
    return (
        <div className="mt-12 pt-8 border-t border-destructive/20">
            <h3 className="text-lg font-bold text-destructive mb-4 flex items-center gap-2">
                <IconTrash className="w-5 h-5" />
                {t('workspace.dangerZone')}
            </h3>
            <div className="bg-destructive/5 border border-destructive/10 rounded-xl p-6 flex items-center justify-between">
                <div>
                    <h4 className="text-foreground font-medium mb-1">
                        {t('workspaces.deleteWorkspace')}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                        {t('workspaces.deleteWarning').trim()}
                    </p>
                </div>
                <button
                    onClick={onDelete}
                    className={C_WORKSPACEDASHBOARDSUBCOMPONENTS_1}
                >
                    {t('common.delete')}
                </button>
            </div>
        </div>
    );
}

export const WorkspaceSearchResults = SearchResults;
export const WorkspaceDangerZone = DangerZone;
