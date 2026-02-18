import { FileSearchResult } from '@shared/types/common';
import React from 'react';
import { Virtuoso } from 'react-virtuoso';

import { useTranslation } from '@/i18n';

interface SearchResultsProps {
    results: FileSearchResult[];
    projectRoot: string;
    searchQuery: string;
    onSelect: (path: string, line?: number) => void;
}

const renderHighlightedSnippet = (text: string, query: string): React.ReactNode => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return text;
    }

    const normalizedText = text.toLowerCase();
    const fragments: React.ReactNode[] = [];
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
};

export const SearchResults: React.FC<SearchResultsProps> = ({
    results,
    projectRoot,
    searchQuery,
    onSelect,
}) => {
    const { t } = useTranslation();
    const VIRTUALIZATION_THRESHOLD = 120;

    const renderResult = (res: FileSearchResult, index: number) => (
        <div
            key={`${res.file}:${res.line}:${index}`}
            onClick={() => {
                void onSelect(res.file, res.line);
            }}
            className="p-2 hover:bg-muted/20 rounded cursor-pointer group"
        >
            <div className="flex items-center gap-2 text-xs text-primary mb-0.5">
                <span className="font-mono">
                    {res.file.replace(projectRoot, '')}:{res.line}
                </span>
                {res.type && (
                    <span className="px-1.5 py-0.5 bg-primary/10 rounded-full text-xxs uppercase tracking-wider">
                        {res.type}
                    </span>
                )}
            </div>
            <div className="text-sm text-muted-foreground font-mono line-clamp-1 opacity-80 group-hover:opacity-100">
                {renderHighlightedSnippet(res.text.trim(), searchQuery)}
            </div>
        </div>
    );

    if (results.length === 0) {
        return (
            <div className="text-center text-muted-foreground mt-10">
                {t('projectDashboard.noResults')}
            </div>
        );
    }

    if (results.length >= VIRTUALIZATION_THRESHOLD) {
        return (
            <Virtuoso
                style={{ height: '100%' }}
                data={results}
                itemContent={(index, result) => renderResult(result, index)}
            />
        );
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 space-y-2">
            {results.map((result, index) => renderResult(result, index))}
        </div>
    );
};
