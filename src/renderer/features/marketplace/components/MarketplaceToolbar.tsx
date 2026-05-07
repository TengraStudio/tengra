import { IconLayoutGrid, IconList, IconSearch, IconX } from '@tabler/icons-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import type { MarketplaceFilterValue, MarketplaceQueryState, MarketplaceSortValue, MarketplaceViewMode, ModelTab } from '../marketplace-query.types';

/* Batch-02: Extracted Long Classes */
const C_MARKETPLACETOOLBAR_1 = "w-full bg-muted/30 rounded-xl px-12 py-2.5 text-sm focus:outline-none transition-all font-medium border border-transparent focus:border-primary/20 placeholder:text-muted-foreground/20";
const C_MARKETPLACETOOLBAR_2 = "flex items-center gap-2 px-3 py-2 rounded-lg text-warning/60 hover:text-warning hover:bg-warning/5 text-sm font-semibold transition-all";


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
    const { search, filter, sort, author, category, modelFit, modelTarget, viewMode, modelTab } = query;

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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-1">
                <div className="flex items-center gap-4 flex-1 w-full max-w-2xl">
                    <div className="relative flex-1">
                        <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/20" />
                        <input
                            type="text"
                            placeholder={t('frontend.marketplace.search')}
                            value={search}
                            onChange={(e) => onQueryChange(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                            className={C_MARKETPLACETOOLBAR_1}
                        />
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-muted/20 rounded-xl shrink-0">
                        <button
                            onClick={() => onQueryChange(prev => ({ ...prev, viewMode: 'list' }))}
                            className={cn(
                                'p-2 rounded-lg transition-all',
                                viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30'
                            )}
                        >
                            <IconList className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onQueryChange(prev => ({ ...prev, viewMode: 'grid' }))}
                            className={cn(
                                'p-2 rounded-lg transition-all',
                                viewMode === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30'
                            )}
                        >
                            <IconLayoutGrid className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-5">
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className={C_MARKETPLACETOOLBAR_2}
                        >
                            <IconX className="w-3.5 h-3.5" />
                            {t('common.clear')}
                        </button>
                    )}

                    <div className="h-1 w-1 rounded-full bg-muted/20" />
                    <div className="text-sm font-bold uppercase  text-muted-foreground/20">
                        {totalCount} {t('frontend.marketplace.results')}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 px-1">
                {mode === 'models' && (
                    <div className="flex items-center gap-1.5 p-1 bg-muted/20 rounded-xl mr-2">
                        {(['ollama', 'huggingface', 'community'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => onQueryChange(prev => ({ ...prev, modelTab: tab, page: 1, selectedItemId: null }))}
                                className={cn(
                                    'px-4 py-1.5 rounded-lg text-sm font-semibold transition-all',
                                    modelTab === tab
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/30'
                                )}
                            >
                                {t(`frontend.marketplace.tabs.${tab}`)}
                            </button>
                        ))}
                    </div>
                )}

                {mode === 'mcp' ? (
                    <>
                        <div className="flex items-center gap-1.5 p-1 bg-muted/20 rounded-xl">
                            <button
                                type="button"
                                onClick={() => onQueryChange(prev => ({ ...prev, mcpView: 'all', page: 1 }))}
                                className={cn(
                                    'rounded-lg px-4 py-1.5 text-sm font-semibold transition-all',
                                    mcpView === 'all'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/40'
                                )}
                            >
                                {t('frontend.marketplace.mcp.filters.all')}
                            </button>
                            <button
                                type="button"
                                onClick={() => onQueryChange(prev => ({ ...prev, mcpView: 'installed', page: 1 }))}
                                className={cn(
                                    'rounded-lg px-4 py-1.5 text-sm font-semibold transition-all',
                                    mcpView === 'installed'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/40'
                                )}
                            >
                                {t('frontend.modelExplorer.installed')}
                            </button>
                            <button
                                type="button"
                                onClick={() => onQueryChange(prev => ({ ...prev, mcpView: 'external', page: 1 }))}
                                className={cn(
                                    'rounded-lg px-4 py-1.5 text-sm font-semibold transition-all',
                                    mcpView === 'external'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/40'
                                )}
                            >
                                {t('frontend.marketplace.mcp.filters.user')}
                            </button>
                        </div>
                        <Select
                            value={sort}
                            onValueChange={value => onQueryChange(prev => ({ ...prev, sort: value as MarketplaceSortValue, page: 1 }))}
                        >
                            <SelectTrigger className="h-9 w-44 text-sm font-semibold bg-muted/30 border-none rounded-xl text-muted-foreground/50 hover:bg-muted/40 transition-colors">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-border/10 bg-background/95 backdrop-blur-xl shadow-2xl rounded-xl">
                                <SelectItem value="name_asc">{t('frontend.modelExplorer.name')} ↑</SelectItem>
                                <SelectItem value="name_desc">{t('frontend.modelExplorer.name')} ↓</SelectItem>
                                <SelectItem value="version_desc">{t('frontend.mcp.version')} ↓</SelectItem>
                            </SelectContent>
                        </Select>
                    </>
                ) : (
                    <>
                        <Select
                            value={filter}
                            onValueChange={value => onQueryChange(prev => ({ ...prev, filter: value as MarketplaceFilterValue, page: 1 }))}
                        >
                            <SelectTrigger className="h-9 w-44 text-sm font-semibold bg-muted/30 border-none rounded-xl text-muted-foreground/50 hover:bg-muted/40 transition-colors">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-border/10 bg-background/95 backdrop-blur-xl shadow-2xl rounded-xl">
                                <SelectItem value="all">{t('frontend.marketplace.mcp.filters.all')}</SelectItem>
                                <SelectItem value="installed">{t('frontend.modelExplorer.installed')}</SelectItem>
                                <SelectItem value="not_installed">{t('frontend.marketplace.install')}</SelectItem>
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
                                <SelectTrigger className="h-9 w-44 text-sm font-semibold bg-muted/30 border-none rounded-xl text-muted-foreground/50 hover:bg-muted/40 transition-colors">
                                    <SelectValue placeholder={t('frontend.marketplace.author')} />
                                </SelectTrigger>
                                <SelectContent className="border-border/10 bg-background/95 backdrop-blur-xl shadow-2xl rounded-xl">
                                    <SelectItem value="all">{t('frontend.marketplace.mcp.filters.all authors')}</SelectItem>
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
                            <SelectTrigger className="h-9 w-52 text-sm font-semibold bg-muted/30 border-none rounded-xl text-muted-foreground/50 hover:bg-muted/40 transition-colors">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-border/10 bg-background/95 backdrop-blur-xl shadow-2xl rounded-xl">
                                <SelectItem value="name_asc">{t('frontend.modelExplorer.name')} ↑</SelectItem>
                                <SelectItem value="name_desc">{t('frontend.modelExplorer.name')} ↓</SelectItem>
                                <SelectItem value="downloads_desc">{t('frontend.marketplace.mcp.filters.popularity')} ↓</SelectItem>
                                <SelectItem value="version_desc">{t('frontend.mcp.version')} ↓</SelectItem>
                            </SelectContent>
                        </Select>

                        {mode === 'models' && (
                            <>
                                <Select
                                    value={modelFit ?? 'all'}
                                    onValueChange={value => onQueryChange(prev => ({ ...prev, modelFit: value as MarketplaceQueryState['modelFit'], page: 1 }))}
                                >
                                    <SelectTrigger className="h-9 w-44 text-sm font-semibold bg-muted/30 border-none rounded-xl text-muted-foreground/50 hover:bg-muted/40 transition-colors">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="border-border/10 bg-background/95 backdrop-blur-xl shadow-2xl rounded-xl">
                                        <SelectItem value="all">{t('frontend.marketplace.modelFit.all')}</SelectItem>
                                        <SelectItem value="recommended">{t('frontend.marketplace.modelFit.recommended')}</SelectItem>
                                        <SelectItem value="workable">{t('frontend.marketplace.modelFit.workable')}</SelectItem>
                                        <SelectItem value="limited">{t('frontend.marketplace.modelFit.limited')}</SelectItem>
                                        <SelectItem value="blocked">{t('frontend.marketplace.modelFit.blocked')}</SelectItem>
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

