import type {
    InstallRequest,
    MarketplaceItem,
    MarketplaceLanguage,
    MarketplaceModel,
    MarketplaceRegistry,
    MarketplaceTheme,
} from '@shared/types/marketplace';
import { compareVersions } from '@shared/utils/extension.util';
import {
    ChevronLeft,
    ChevronRight,
    Download,
    Globe,
    MessageSquare,
    Package,
    Palette,
    RefreshCw,
    Search,
    Sparkles,
    Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useLanguage, useTranslation } from '@/i18n';
import { localeRegistry } from '@/i18n/locale-registry.service';
import { pushNotification } from '@/store/notification-center.store';

import { McpCard, type McpPlugin } from './McpCard';

type MarketplaceMode = 'mcp' | 'themes' | 'personas' | 'models' | 'prompts' | 'languages' | 'skills';
const PAGE_SIZE = 24;

export function McpMarketplace({ mode }: { mode: MarketplaceMode }): JSX.Element {
    const { t } = useTranslation();
    const { language: activeLanguage, setLanguage } = useLanguage();
    const [registry, setRegistry] = useState<MarketplaceRegistry | null>(null);
    const [localPlugins, setLocalPlugins] = useState<McpPlugin[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [installingId, setInstallingId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchRegistry = useCallback(async () => {
        try {
            const data = await window.electron.marketplace.fetch();
            setRegistry(data);
        } catch {
            pushNotification({ type: 'error', message: t('marketplace.loadError') });
        }
    }, [t]);

    const fetchLocalPlugins = useCallback(async () => {
        if (mode !== 'mcp') {
            setLocalPlugins([]);
            return;
        }
        try {
            const list = await window.electron.mcp.list();
            setLocalPlugins(list as unknown as McpPlugin[]);
        } catch {
            pushNotification({ type: 'error', message: t('marketplace.mcp.localLoadError') });
        }
    }, [mode, t]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([fetchRegistry(), fetchLocalPlugins()]);
        } finally {
            setLoading(false);
        }
    }, [fetchRegistry, fetchLocalPlugins]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    useEffect(() => {
        setCurrentPage(1);
    }, [mode, search]);

    const handleToggleMcp = useCallback(async (plugin: McpPlugin) => {
        try {
            await window.electron.mcp.toggle(plugin.id ?? plugin.name, !plugin.isEnabled);
            await fetchLocalPlugins();
        } catch {
            pushNotification({ type: 'error', message: t('marketplace.mcp.toggleError') });
        }
    }, [fetchLocalPlugins, t]);

    const handleUninstallMcp = useCallback(async (plugin: McpPlugin) => {
        try {
            await window.electron.mcp.uninstall(plugin.id ?? plugin.name);
            await fetchLocalPlugins();
            await fetchRegistry();
        } catch {
            pushNotification({ type: 'error', message: t('marketplace.mcp.uninstallError') });
        }
    }, [fetchLocalPlugins, fetchRegistry, t]);

    const handleInstall = useCallback(async (item: MarketplaceItem) => {
        if (installingId) { return; }
        setInstallingId(item.id);
        try {
            const baseRequest: InstallRequest = {
                id: item.id,
                type: item.itemType,
                downloadUrl: item.downloadUrl,
                name: item.name,
                description: item.description,
                author: item.author,
                version: item.version,
            };
            const modelRequest = item.itemType === 'model'
                ? {
                    provider: (item as MarketplaceModel).provider,
                    sourceUrl: (item as MarketplaceModel).sourceUrl,
                    category: (item as MarketplaceModel).category,
                    pipelineTag: (item as MarketplaceModel).pipelineTag,
                }
                : {};
            const result = await window.electron.marketplace.install({
                ...baseRequest,
                ...modelRequest,
            });
            if (result.success) {
                if (item.itemType === 'language') {
                    await localeRegistry.reloadLocales();
                }
                pushNotification({ type: 'success', message: t('marketplace.installSuccess', { name: item.name }) });
                void fetchData();
            } else {
                pushNotification({ type: 'error', message: t('marketplace.installFailure') });
            }
        } catch {
            pushNotification({ type: 'error', message: t('marketplace.networkError') });
        } finally {
            setInstallingId(null);
        }
    }, [fetchData, installingId, t]);

    const handleActivateLanguage = useCallback(async (item: MarketplaceLanguage) => {
        if (item.locale === activeLanguage) {
            return;
        }
        await setLanguage(item.locale);
        void fetchData();
    }, [activeLanguage, fetchData, setLanguage]);

    const getStoreItems = () => {
        if (!registry) { return []; }
        switch (mode) {
            case 'mcp': return registry.mcp || [];
            case 'themes': return registry.themes || [];
            case 'personas': return registry.personas || [];
            case 'prompts': return registry.prompts || [];
            case 'models': return registry.models || [];
            case 'languages': return registry.languages || [];
            default: return [];
        }
    };

    const storeItems = getStoreItems();
    const filteredStoreItems = storeItems.filter(i => {
        const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase()) || 
                              i.description.toLowerCase().includes(search.toLowerCase());
        if (!matchesSearch) {
            return false;
        }
        
        if (mode === 'mcp' && i.installed) {
            const installedVersion = typeof i.installedVersion === 'string' ? i.installedVersion : null;
            const hasUpd = Boolean(installedVersion && compareVersions(i.version, installedVersion) > 0);
            return hasUpd;
        }
        
        return true;
    });

    const filteredLocal = localPlugins.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        p.description?.toLowerCase().includes(search.toLowerCase())
    );

    const combinedItems = useMemo(() => {
        const localItems = filteredLocal.map((plugin, index) => ({ type: 'local' as const, plugin, key: `local-${plugin.id ?? plugin.name ?? index}` }));
        const remoteItems = filteredStoreItems.map(item => ({ type: 'store' as const, item, key: `store-${item.itemType}-${item.id}` }));
        return [...localItems, ...remoteItems];
    }, [filteredLocal, filteredStoreItems]);

    const totalCount = combinedItems.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const effectivePage = Math.min(currentPage, totalPages);
    const pageStart = (effectivePage - 1) * PAGE_SIZE;
    const pagedItems = combinedItems.slice(pageStart, pageStart + PAGE_SIZE);

    if (loading) { return <Loader t={t} />; }

    return (
        <div className="space-y-6">
            <Toolbar search={search} onSearch={setSearch} count={totalCount} t={t} />
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {pagedItems.map(entry => entry.type === 'local' ? (
                    <McpCard
                        key={entry.key}
                        plugin={entry.plugin}
                        t={t}
                        onToggle={(p) => void handleToggleMcp(p)}
                        onUninstall={(p) => void handleUninstallMcp(p)}
                    />
                ) : (
                    <MarketCard 
                        key={entry.key} 
                        item={entry.item} 
                        isActive={entry.item.itemType === 'language' && (entry.item as MarketplaceLanguage).locale === activeLanguage}
                        isInstalling={installingId === entry.item.id} 
                        onInstall={(it) => void handleInstall(it)} 
                        onActivateLanguage={(it) => void handleActivateLanguage(it)}
                    />
                ))}
                {totalCount === 0 && <EmptyState t={t} mode={mode} />}
            </div>
            {totalCount > PAGE_SIZE && (
                <Pagination
                    currentPage={effectivePage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    t={t}
                />
            )}
        </div>
    );
}

function MarketCard({ item, isActive, onInstall, onActivateLanguage, isInstalling }: {
    item: MarketplaceItem;
    isActive: boolean;
    onInstall: (item: MarketplaceItem) => void;
    onActivateLanguage: (item: MarketplaceLanguage) => void;
    isInstalling: boolean;
}) {
    const { t } = useTranslation();
    const themeItem = item.itemType === 'theme' ? (item as MarketplaceTheme) : null;
    const languageItem = item.itemType === 'language' ? item as MarketplaceLanguage : null;
    const installedVersion = typeof item.installedVersion === 'string' ? item.installedVersion : null;
    const hasUpdate = Boolean(
        item.installed
        && installedVersion
        && compareVersions(item.version, installedVersion) > 0
    );

    const Icon = (({
        theme: Palette,
        mcp: Package,
        persona: Sparkles,
        model: Zap,
        prompt: MessageSquare,
        language: Globe,
        skill: Sparkles,
    } as Record<string, React.ElementType>)[item.itemType] || Package);

    const primaryActionLabel = isInstalling
        ? t('marketplace.installing')
        : hasUpdate
            ? t('common.update')
            : item.installed
                ? t('modelExplorer.installed')
                : t('marketplace.install');

    return (
        <div className="group flex flex-col bg-card border border-border/40 rounded-lg p-5 hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-md">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded bg-muted/40 text-muted-foreground group-hover:text-primary transition-colors">
                        <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground leading-none mb-1">{item.name}</h3>
                        <p className="text-xs text-muted-foreground font-medium">{t('marketplace.authorBy', { author: item.author })}</p>
                    </div>
                </div>
                <button
                    onClick={() => onInstall(item)}
                    disabled={isInstalling || (Boolean(item.installed) && !hasUpdate)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary text-xs font-bold transition-all hover:text-primary-foreground group/btn disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isInstalling || hasUpdate
                        ? <RefreshCw className={`w-3.5 h-3.5 ${isInstalling ? 'animate-spin' : ''}`} />
                        : <Download className="w-3.5 h-3.5" />}
                    {primaryActionLabel}
                </button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>
            {installedVersion && (
                <div className="mt-4 flex items-center gap-2 text-[10px] font-semibold text-muted-foreground">
                    <span>{item.version}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 normal-case tracking-normal">
                        {`v${installedVersion}`}
                    </span>
                    {hasUpdate && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                            {t('common.update')}
                        </span>
                    )}
                </div>
            )}
            {themeItem?.previewColor && (
                <div className="mt-4 flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full border border-border/20 shadow-sm" style={{ backgroundColor: themeItem.previewColor }} />
                    <span className="text-xs text-muted-foreground font-bold">{t('marketplace.preview')}</span>
                </div>
            )}
            {languageItem && (
                <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <span>{languageItem.nativeName}</span>
                        {item.installed && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{t('modelExplorer.installed')}</span>}
                        {hasUpdate && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{t('common.update')}</span>}
                        {isActive && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{t('common.active')}</span>}
                    </div>
                    {item.installed && !isActive && (
                        <button
                            onClick={() => onActivateLanguage(languageItem)}
                            className="rounded bg-secondary px-3 py-1.5 text-[10px] font-bold text-secondary-foreground transition-colors hover:bg-secondary/80"
                        >
                            {t('common.select')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function Toolbar({ search, onSearch, count, t }: { search: string; onSearch: (v: string) => void; count: number; t: (key: string) => string }) {
    return (
        <div className="flex items-center justify-between gap-4 bg-muted/10 p-3 rounded-xl border border-border/40">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                <input 
                    type="text" 
                    placeholder={t('marketplace.search')} 
                    value={search} 
                    onChange={(e) => onSearch(e.target.value)} 
                    className="w-full bg-background border border-border/30 rounded px-10 py-2 text-sm focus:outline-none focus:border-primary/40 transition-all font-medium" 
                />
            </div>
            <div className="hidden sm:flex items-center gap-2">
                <div className="px-3 py-1 rounded-full bg-muted/30 text-xs font-bold text-muted-foreground">
                    {count} {t('marketplace.results')}
                </div>
            </div>
        </div>
    );
}

function EmptyState({
    t,
    mode,
}: {
    t: (key: string, options?: Record<string, string | number>) => string;
    mode: MarketplaceMode;
}) {
    const modeKeyByMode: Record<MarketplaceMode, string> = {
        mcp: 'marketplace.tabs.mcp',
        themes: 'marketplace.tabs.themes',
        personas: 'marketplace.tabs.personas',
        models: 'marketplace.tabs.models',
        prompts: 'marketplace.tabs.prompts',
        languages: 'marketplace.tabs.languages',
        skills: 'marketplace.tabs.skills',
    };

    return (
        <div className="col-span-full py-20 text-center border border-dashed border-border/40 rounded-xl bg-muted/5">
            <Package className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground font-bold">{t('marketplace.emptyState', { mode: t(modeKeyByMode[mode]) })}</p>
        </div>
    );
}

function Loader({ t }: { t: (key: string) => string }) {
    return (
        <div className="flex flex-col items-center justify-center py-32 space-y-5">
            <RefreshCw className="w-8 h-8 text-primary animate-spin opacity-40" />
            <p className="text-xs font-bold text-muted-foreground animate-pulse">{t('marketplace.syncing')}</p>
        </div>
    );
}

function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    t,
}: {
    currentPage: number;
    totalPages: number;
    onPageChange: (nextPage: number) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}) {
    return (
        <div className="flex items-center justify-center gap-3 pt-2">
            <button
                type="button"
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 rounded-md border border-border/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
                <ChevronLeft className="h-3.5 w-3.5" />
                {t('common.previous')}
            </button>
            <span className="text-xs font-semibold text-muted-foreground">
                {t('common.pageOf', { current: currentPage, total: totalPages })}
            </span>
            <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex items-center gap-1 rounded-md border border-border/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
                {t('common.next')}
                <ChevronRight className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}
