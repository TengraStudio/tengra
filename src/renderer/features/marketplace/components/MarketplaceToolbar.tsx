import { Search, X } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n';

import type { MarketplaceFilterValue, MarketplaceQueryState, MarketplaceSortValue } from '../marketplace-query.types';

interface MarketplaceToolbarProps {
    mode: string;
    query: MarketplaceQueryState;
    onQueryChange: (updater: (prev: MarketplaceQueryState) => MarketplaceQueryState) => void;
    totalCount: number;
    authors: string[];
    categories: string[];
    mcpView?: string;
}

export function MarketplaceToolbar({
    mode,
    query,
    onQueryChange,
    totalCount,
    authors,
    mcpView
}: MarketplaceToolbarProps) {
    const { t } = useTranslation();
    const { search, filter, sort, author, category, modelFit, modelTarget } = query;

    const hasActiveFilters = search || filter !== 'all' || author || category || (mode === 'mcp' && mcpView !== 'all') || (mode === 'models' && (modelFit !== 'all' || modelTarget !== 'all'));

    const clearFilters = () => {
        onQueryChange(prev => ({
            ...prev,
            search: '',
            filter: 'all',
            author: undefined,
            category: undefined,
            mcpView: 'all',
            modelFit: 'all',
            modelTarget: 'all',
            page: 1
        }));
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-1">
                <div className="relative flex-1 w-full max-w-lg">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                    <input
                        type="text"
                        placeholder={t('marketplace.search')}
                        value={search}
                        onChange={(e) => onQueryChange(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                        className="w-full bg-muted/40 rounded-lg px-12 py-2.5 text-sm focus:outline-none transition-all font-medium placeholder:text-muted-foreground/30"
                    />
                </div>

                <div className="flex items-center gap-3">
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-orange-500 hover:bg-orange-500/10 text-[10px] font-black transition-all uppercase tracking-widest"
                        >
                            <X className="w-3.5 h-3.5" />
                            {t('common.clear')}
                        </button>
                    )}
                    
                    <div className="h-1 w-1 rounded-full bg-muted/20" />
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">
                        {totalCount} {t('marketplace.results')}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-1">
                {mode === 'mcp' ? (
                    <>
                        <div className="flex items-center gap-1 p-1 bg-muted/20 rounded-lg">
                            <button
                                type="button"
                                onClick={() => onQueryChange(prev => ({ ...prev, mcpView: 'all', page: 1 }))}
                                className={`rounded-md px-4 py-1.5 text-[10px] font-black transition-all uppercase tracking-widest ${mcpView === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/40'}`}
                            >
                                {t('marketplace.mcp.filters.all')}
                            </button>
                            <button
                                type="button"
                                onClick={() => onQueryChange(prev => ({ ...prev, mcpView: 'installed', page: 1 }))}
                                className={`rounded-md px-4 py-1.5 text-[10px] font-black transition-all uppercase tracking-widest ${mcpView === 'installed' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/40'}`}
                            >
                                {t('modelExplorer.installed')}
                            </button>
                            <button
                                type="button"
                                onClick={() => onQueryChange(prev => ({ ...prev, mcpView: 'external', page: 1 }))}
                                className={`rounded-md px-4 py-1.5 text-[10px] font-black transition-all uppercase tracking-widest ${mcpView === 'external' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/40'}`}
                            >
                                {t('marketplace.mcp.filters.user')}
                            </button>
                        </div>
                        <Select
                            value={sort}
                            onValueChange={value => onQueryChange(prev => ({ ...prev, sort: value as MarketplaceSortValue, page: 1 }))}
                        >
                            <SelectTrigger className="h-9 w-40 text-[10px] font-black bg-muted/20 border-none rounded-lg uppercase tracking-widest text-muted-foreground/60">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-none shadow-2xl">
                                <SelectItem value="name_asc">{t('modelExplorer.name')} ↑</SelectItem>
                                <SelectItem value="name_desc">{t('modelExplorer.name')} ↓</SelectItem>
                                <SelectItem value="version_desc">{t('mcp.version')} ↓</SelectItem>
                            </SelectContent>
                        </Select>
                    </>
                ) : (
                    <>
                        <Select
                            value={filter}
                            onValueChange={value => onQueryChange(prev => ({ ...prev, filter: value as MarketplaceFilterValue, page: 1 }))}
                        >
                            <SelectTrigger className="h-9 w-40 text-[10px] font-black bg-muted/20 border-none rounded-lg uppercase tracking-widest text-muted-foreground/60">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-none shadow-2xl">
                                <SelectItem value="all">{t('marketplace.mcp.filters.all')}</SelectItem>
                                <SelectItem value="installed">{t('modelExplorer.installed')}</SelectItem>
                                <SelectItem value="not_installed">{t('marketplace.install')}</SelectItem>
                            </SelectContent>
                        </Select>

                        {authors.length > 0 && authors.length < 100 && (
                            <Select
                                value={query.author ?? 'all'}
                                onValueChange={value => {
                                    onQueryChange(prev => ({
                                        ...prev,
                                        author: value === 'all' ? undefined : value,
                                        page: 1,
                                    }));
                                }}
                            >
                                <SelectTrigger className="h-9 w-40 text-[10px] font-black bg-muted/20 border-none rounded-lg uppercase tracking-widest text-muted-foreground/60">
                                    <SelectValue placeholder={t('marketplace.author')} />
                                </SelectTrigger>
                                <SelectContent className="border-none shadow-2xl">
                                    <SelectItem value="all">{t('marketplace.mcp.filters.all authors')}</SelectItem>
                                    {authors.map(a => (
                                        <SelectItem key={a} value={a}>{a}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        <Select
                            value={sort as string}
                            onValueChange={value => onQueryChange(prev => ({ ...prev, sort: value as MarketplaceSortValue, page: 1 }))}
                        >
                            <SelectTrigger className="h-9 w-48 text-[10px] font-black bg-muted/20 border-none rounded-lg uppercase tracking-widest text-muted-foreground/60">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-none shadow-2xl">
                                <SelectItem value="name_asc">{t('modelExplorer.name')} ↑</SelectItem>
                                <SelectItem value="name_desc">{t('modelExplorer.name')} ↓</SelectItem>
                                <SelectItem value="downloads_desc">{t('marketplace.mcp.filters.popularity')} ↓</SelectItem>
                                <SelectItem value="version_desc">{t('mcp.version')} ↓</SelectItem>
                            </SelectContent>
                        </Select>

                        {mode === 'models' && (
                            <>
                                <Select
                                    value={modelFit ?? 'all'}
                                    onValueChange={value => onQueryChange(prev => ({ ...prev, modelFit: value as MarketplaceQueryState['modelFit'], page: 1 }))}
                                >
                                    <SelectTrigger className="h-9 w-40 text-[10px] font-black bg-muted/20 border-none rounded-lg uppercase tracking-widest text-muted-foreground/60">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="border-none shadow-2xl">
                                        <SelectItem value="all">{t('marketplace.modelFit.all')}</SelectItem>
                                        <SelectItem value="recommended">{t('marketplace.modelFit.recommended')}</SelectItem>
                                        <SelectItem value="workable">{t('marketplace.modelFit.workable')}</SelectItem>
                                        <SelectItem value="limited">{t('marketplace.modelFit.limited')}</SelectItem>
                                        <SelectItem value="blocked">{t('marketplace.modelFit.blocked')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
