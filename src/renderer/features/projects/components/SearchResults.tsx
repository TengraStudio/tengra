import { FileSearchResult } from '@shared/types/common';
import React from 'react';

import { useTranslation } from '@/i18n';

interface SearchResultsProps {
    results: FileSearchResult[];
    projectRoot: string;
    onSelect: (path: string, line?: number) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({ results, projectRoot, onSelect }) => {
    const { t } = useTranslation();

    if (results.length === 0) {
        return <div className="text-center text-muted-foreground mt-10">{t('projectDashboard.noResults')}</div>;
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 space-y-2">
            {results.map((res, i) => (
                <div
                    key={i}
                    onClick={() => { void onSelect(res.file, res.line); }}
                    className="p-2 hover:bg-muted/20 rounded cursor-pointer group"
                >
                    <div className="flex items-center gap-2 text-xs text-primary mb-0.5">
                        <span className="font-mono">{res.file.replace(projectRoot, '')}:{res.line}</span>
                        {res.type && (
                            <span className="px-1.5 py-0.5 bg-primary/10 rounded-full text-xxs uppercase tracking-wider">
                                {res.type}
                            </span>
                        )}
                    </div>
                    <div className="text-sm text-gray-300 font-mono line-clamp-1 opacity-80 group-hover:opacity-100">
                        {res.text.trim()}
                    </div>
                </div>
            ))}
        </div>
    );
};
