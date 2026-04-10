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
    categories,
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/10 p-4 rounded-xl border border-border/40 backdrop-blur-md">
                <div className="relative flex-1 w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                    <input
                        type="text"
                        placeholder={t('marketplace.search')}
                        value={search}
                        onChange={(e) => onQueryChange(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                        className="w-full bg-background/50 border border-border/30 rounded-lg px-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all font-medium"
                    />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="px-3 py-1.5 rounded-lg bg-primary/5 typo-caption font-bold text-primary border border-primary/10">
                        {totalCount.toLocaleString()} {t('marketplace.results')}
                    </div>
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white typo-body font-bold transition-all"
                        >
                            <X className="w-3 h-3" />
                            {t('common.clear')}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                {mode === 'mcp' ? (
                    <>
                        <div className="flex p-1 bg-muted/20 rounded-lg border border-border/30">
                            <button
                                type="button"
                                onClick={() => onQueryChange(prev => ({ ...prev, mcpView: 'all', page: 1 }))}
                                className={`rounded-md px-4 py-1.5 typo-caption font-bold transition-all ${mcpView === 'all' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-muted/50'}`}
                            >
                                {t('marketplace.mcp.filters.all')}
                            </button>
                            <button
                                type="button"
                                onClick={() => onQueryChange(prev => ({ ...prev, mcpView: 'installed', page: 1 }))}
                                className={`rounded-md px-4 py-1.5 typo-caption font-bold transition-all ${mcpView === 'installed' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-muted/50'}`}
                            >
                                {t('modelExplorer.installed')}
                            </button>
                            <button
                                type="button"
                                onClick={() => onQueryChange(prev => ({ ...prev, mcpView: 'external', page: 1 }))}
                                className={`rounded-md px-4 py-1.5 typo-caption font-bold transition-all ${mcpView === 'external' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-muted/50'}`}
                            >
                                {t('marketplace.mcp.filters.user')}
                            </button>
                        </div>
                        <Select
                            value={sort}
                            onValueChange={value => onQueryChange(prev => ({ ...prev, sort: value as MarketplaceSortValue, page: 1 }))}
                        >
                            <SelectTrigger className="h-9 w-44 typo-caption font-bold border-border/30 bg-background/50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
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
                            <SelectTrigger className="h-9 w-36 typo-caption font-bold border-border/30 bg-background/50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
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
                                <SelectTrigger className="h-9 w-40 typo-caption font-bold border-border/30 bg-background/50">
                                    <SelectValue placeholder={t('marketplace.author')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('marketplace.mcp.filters.all authors')}</SelectItem>
                                    {authors.map(a => (
                                        <SelectItem key={a} value={a}>{a}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        {categories.length > 0 && (
                            <Select
                                value={query.category ?? 'all'}
                                onValueChange={value => {
                                    onQueryChange(prev => ({
                                        ...prev,
                                        category: value === 'all' ? undefined : value,
                                        page: 1,
                                    }));
                                }}
                            >
                                <SelectTrigger className="h-9 w-44 typo-caption font-bold border-border/30 bg-background/50">
                                    <SelectValue placeholder={t('marketplace.category')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('marketplace.mcp.filters.all categories')}</SelectItem>
                                    {categories.map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        <Select
                            value={sort as string}
                            onValueChange={value => onQueryChange(prev => ({ ...prev, sort: value as MarketplaceSortValue, page: 1 }))}
                        >
                            <SelectTrigger className="h-9 w-44 typo-caption font-bold border-border/30 bg-background/50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="name_asc">{t('modelExplorer.name')} ↑</SelectItem>
                                <SelectItem value="name_desc">{t('modelExplorer.name')} ↓</SelectItem>
                                <SelectItem value="downloads_desc">{t('marketplace.mcp.filters.popularity')} ↓</SelectItem>
                                {mode === 'models' && (
                                    <>
                                        <SelectItem value="performance_desc">{t('marketplace.performanceScore')}</SelectItem>
                                        <SelectItem value="tokens_desc">{t('marketplace.tokensPerSecond')}</SelectItem>
                                        <SelectItem value="memory_asc">{t('marketplace.memoryRequirement')}</SelectItem>
                                        <SelectItem value="storage_asc">{t('marketplace.storageRequirement')}</SelectItem>
                                    </>
                                )}
                                <SelectItem value="version_desc">{t('mcp.version')} ↓</SelectItem>
                            </SelectContent>
                        </Select>

                        {mode === 'models' && (
                            <>
                                <Select
                                    value={modelFit ?? 'all'}
                                    onValueChange={value => onQueryChange(prev => ({ ...prev, modelFit: value as MarketplaceQueryState['modelFit'], page: 1 }))}
                                >
                                    <SelectTrigger className="h-9 w-44 typo-caption font-bold border-border/30 bg-background/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t('marketplace.modelFit.all')}</SelectItem>
                                        <SelectItem value="recommended">{t('marketplace.modelFit.recommended')}</SelectItem>
                                        <SelectItem value="workable">{t('marketplace.modelFit.workable')}</SelectItem>
                                        <SelectItem value="limited">{t('marketplace.modelFit.limited')}</SelectItem>
                                        <SelectItem value="blocked">{t('marketplace.modelFit.blocked')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={modelTarget ?? 'all'}
                                    onValueChange={value => onQueryChange(prev => ({ ...prev, modelTarget: value as MarketplaceQueryState['modelTarget'], page: 1 }))}
                                >
                                    <SelectTrigger className="h-9 w-36 typo-caption font-bold border-border/30 bg-background/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t('marketplace.target.all')}</SelectItem>
                                        <SelectItem value="gpu">{t('marketplace.target.gpu')}</SelectItem>
                                        <SelectItem value="cpu">{t('marketplace.target.cpu')}</SelectItem>
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
