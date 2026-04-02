import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Search, X } from 'lucide-react';
import React from 'react';

interface SettingsSearchProps {
    searchQuery: string;
    setSearchQuery: (s: string) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
    filteredTabsCount: number;
}

export const SettingsSearch: React.FC<SettingsSearchProps> = ({
    searchQuery,
    setSearchQuery,
    t,
    filteredTabsCount,
}) => {
    return (
        <div className="mb-6 sticky top-0 z-20 bg-background/95 backdrop-blur-md pb-6 pt-2 border-b border-border/40 transition-all duration-300">
            <div className="relative group max-w-2xl mx-auto">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-colors group-focus-within:text-primary text-muted-foreground/60">
                    <Search className="w-4.5 h-4.5" />
                </div>
                <Input
                    type="text"
                    placeholder={t('settings.searchPlaceholder')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-11 py-6 bg-muted/30 border-border/40 rounded-2xl text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/20 focus-visible:border-primary/40 transition-all shadow-sm hover:bg-muted/40"
                    aria-label={t('settings.searchPlaceholder')}
                    autoComplete="off"
                    autoFocus
                />
                {searchQuery && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 rounded-xl transition-all"
                        aria-label={t('common.clear')}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>
            {searchQuery && (
                <div className="mt-4 text-center animate-in fade-in slide-in-from-top-1 duration-200">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-xxs font-bold text-primary/80 shadow-xs">
                        {filteredTabsCount > 0
                            ? t('settings.searchResults', { count: filteredTabsCount })
                            : t('settings.noResults')}
                    </span>
                </div>
            )}
        </div>
    );
};
