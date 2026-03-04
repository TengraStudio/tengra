
import { SearchResults } from '@renderer/features/workspace/components/SearchResults';
import { FileSearchResult } from '@shared/types/common';

interface ProjectSearchTabProps {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    handleSearch: () => Promise<void>;
    isSearching: boolean;
    searchResults: FileSearchResult[];
    projectRoot: string;
    handleFileSelect: (path: string, line?: number) => void;
    t: (key: string) => string;
}

export const ProjectSearchTab = ({
    searchQuery,
    setSearchQuery,
    handleSearch,
    isSearching,
    searchResults,
    projectRoot,
    handleFileSelect,
    t
}: ProjectSearchTabProps) => {
    return (
        <div className="h-full flex flex-col space-y-4">
            <div className="flex gap-2 bg-card p-4 rounded-xl border border-border">
                <input
                    type="text"
                    placeholder={t('projectDashboard.searchInProject')}
                    className="flex-1 bg-muted/20 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { void handleSearch(); } }}
                />
                <button
                    onClick={() => { void handleSearch(); }}
                    disabled={isSearching || searchQuery.trim().length < 2}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    {isSearching ? t('common.searching') : t('common.search')}
                </button>
            </div>
            <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden flex flex-col p-2">
                <div className="px-2 py-1 text-xxs text-muted-foreground">
                    {searchResults.length} {t('projectDashboard.results') || 'results'}
                </div>
                <SearchResults
                    results={searchResults}
                    projectRoot={projectRoot}
                    searchQuery={searchQuery}
                    onSelect={(path, line) => { void handleFileSelect(path, line); }}
                />
            </div>
        </div>
    );
};
