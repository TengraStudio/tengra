import { Search, X } from 'lucide-react';
import React from 'react';

interface SettingsSearchProps {
    searchQuery: string
    setSearchQuery: (s: string) => void
    t: (key: string, options?: Record<string, string | number>) => string
    filteredTabsCount: number
}

export const SettingsSearch: React.FC<SettingsSearchProps> = ({
    searchQuery, setSearchQuery, t, filteredTabsCount
}) => {
    return (
        <div className="mb-6 sticky top-0 z-10 bg-background pb-4 border-b border-border/50">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder={t('settings.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-muted/20 border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    aria-label={t('settings.searchPlaceholder')}
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted/30 rounded-md transition-colors"
                        aria-label={t('common.clear')}
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                )}
            </div>
            {searchQuery && (
                <div className="mt-3 text-xs text-muted-foreground">
                    {filteredTabsCount > 0 ? (
                        <span>{t('settings.searchResults', { count: filteredTabsCount })}</span>
                    ) : (
                        <span>{t('settings.noResults')}</span>
                    )}
                </div>
            )}
        </div>
    );
};
