import { safeJsonParse } from '@shared/utils/sanitize.util';
import { Check, Download, Plug, Search, Settings, Shield, Star, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { mcpMarketplaceClient,McpServerLike } from '@/lib/mcp-marketplace-client';
import { cn } from '@/lib/utils';

type McpMarketplaceServer = McpServerLike;
type MCPServerConfig = McpServerLike;

const CATEGORIES = [
    { id: 'all', labelKey: 'mcp.categories.all', icon: Plug },
    { id: 'Web', labelKey: 'mcp.categories.web', icon: Plug },
    { id: 'Database', labelKey: 'mcp.categories.database', icon: Plug },
    { id: 'Developer Tools', labelKey: 'mcp.categories.devTools', icon: Plug },
    { id: 'Cloud', labelKey: 'mcp.categories.cloud', icon: Plug },
    { id: 'Productivity', labelKey: 'mcp.categories.productivity', icon: Plug },
    { id: 'AI', labelKey: 'mcp.categories.ai', icon: Plug },
    { id: 'DevOps', labelKey: 'mcp.categories.devops', icon: Plug },
    { id: 'Utility', labelKey: 'mcp.categories.utility', icon: Plug },
];

const ToolCard = React.memo(({
    tool,
    isInstalled,
    onSelect,
    onInstall,
    onUninstall,
    onConfigure,
    t,
}: {
    tool: McpMarketplaceServer;
    isInstalled: boolean;
    onSelect: (t: McpMarketplaceServer) => void;
    onInstall?: (id: string) => void;
    onUninstall?: (id: string) => void;
    onConfigure?: (id: string) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}) => (
    <div
        onClick={() => onSelect(tool)}
        className={cn(
            'group p-4 rounded-xl border transition-all cursor-pointer',
            isInstalled
                ? 'border-primary/30 bg-primary/5'
                : 'border-border/30 hover:border-border/60 bg-card/30'
        )}
    >
        <div className="flex items-start gap-3">
            <div
                className={cn(
                    'p-2.5 rounded-lg',
                    isInstalled ? 'bg-primary/20 text-primary' : 'bg-muted/50 text-muted-foreground'
                )}
            >
                <Plug className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm truncate">{tool.name}</h3>
                    {tool.isOfficial && <Shield className="w-3.5 h-3.5 text-primary" />}
                    {isInstalled && <Check className="w-3.5 h-3.5 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {tool.description}
                </p>
                <div className="flex items-center gap-3 text-xxs text-muted-foreground/60">
                    {tool.rating && (
                        <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-warning fill-warning" />
                            {tool.rating.toFixed(1)}
                        </span>
                    )}
                    {tool.downloads && (
                        <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            {tool.downloads.toLocaleString()}
                        </span>
                    )}
                    {tool.version && <span>v{tool.version}</span>}
                </div>
            </div>
        </div>
        <div className="flex gap-2 mt-3 pt-3 border-t border-border/20">
            {isInstalled ? (
                <>
                    <button
                        onClick={e => {
                            e.stopPropagation();
                            onConfigure?.(tool.id);
                        }}
                        className="flex-1 py-1.5 text-xs font-medium bg-muted/50 hover:bg-muted text-foreground rounded-md transition-colors flex items-center justify-center gap-1"
                    >
                        <Settings className="w-3 h-3" /> {t('mcp.configure')}
                    </button>
                    <button
                        onClick={e => {
                            e.stopPropagation();
                            onUninstall?.(tool.id);
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-md transition-colors"
                    >
                        {t('mcp.remove')}
                    </button>
                </>
            ) : (
                <button
                    onClick={e => {
                        e.stopPropagation();
                        onInstall?.(tool.id);
                    }}
                    className="flex-1 py-1.5 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors flex items-center justify-center gap-1"
                >
                    <Download className="w-4 h-4" /> {t('mcp.install')}
                </button>
            )}
        </div>
    </div>
));

const ToolDetailModal = ({
    tool,
    isInstalled,
    onInstall,
    onUninstall,
    onConfigure,
    onClose,
    t,
}: {
    tool: McpMarketplaceServer;
    isInstalled: boolean;
    onInstall?: (id: string) => void;
    onUninstall?: (id: string) => void;
    onConfigure?: (id: string) => void;
    onClose: () => void;
    t: (key: string, options?: Record<string, string | number>) => string;
}) => (
    <div
        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        onClick={onClose}
    >
        <div
            onClick={e => e.stopPropagation()}
            className="bg-card rounded-xl max-w-lg w-full overflow-hidden shadow-2xl"
        >
            <div className="p-4 border-b border-border/30 flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                    <Plug className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold">{tool.name}</h2>
                        {tool.isOfficial && (
                            <span className="px-2 py-0.5 bg-primary/10 text-primary text-xxs font-bold rounded-full">
                                {t('mcp.official')}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t('mcp.byAuthor', {
                            author: tool.publisher ?? 'Unknown',
                            version: tool.version ?? '1.0.0',
                        })}
                    </p>
                </div>
            </div>
            <div className="p-4">
                <p className="text-sm mb-4">{tool.description}</p>
                {tool.categories && tool.categories.length > 0 && (
                    <>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            {t('mcp.categories.title')}
                        </h3>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {tool.categories.map((cat, i) => (
                                <span key={i} className="px-2 py-1 bg-muted/50 text-xs rounded-md">
                                    {cat}
                                </span>
                            ))}
                        </div>
                    </>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    {tool.rating && (
                        <span className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-warning fill-warning" />
                            {tool.rating.toFixed(1)}
                        </span>
                    )}
                    {tool.downloads && (
                        <span className="flex items-center gap-1">
                            <Download className="w-4 h-4" />
                            {tool.downloads.toLocaleString()}
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    {isInstalled ? (
                        <>
                            <button
                                onClick={() => {
                                    onConfigure?.(tool.id);
                                    onClose();
                                }}
                                className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2"
                            >
                                <Settings className="w-4 h-4" /> {t('mcp.configure')}
                            </button>
                            <button
                                onClick={() => {
                                    onUninstall?.(tool.id);
                                    onClose();
                                }}
                                className="px-4 py-2 bg-destructive/10 text-destructive rounded-lg font-medium text-sm hover:bg-destructive/20"
                            >
                                {t('mcp.uninstall')}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => {
                                onInstall?.(tool.id);
                                onClose();
                            }}
                            className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2"
                        >
                            <Download className="w-4 h-4" /> {t('mcp.installTool')}
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-muted text-muted-foreground rounded-lg font-medium text-sm hover:bg-muted/80"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div>
    </div>
);

const ITEMS_PER_PAGE = 24;
const SEARCH_HISTORY_STORAGE_KEY = 'mcp-marketplace-search-history';
const MAX_SEARCH_HISTORY = 8;

export const MCPStore: React.FC<{
    onInstall?: (id: string) => void;
    onUninstall?: (id: string) => void;
    onConfigure?: (id: string) => void;
}> = ({ onInstall, onUninstall, onConfigure }) => {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedTool, setSelectedTool] = useState<McpMarketplaceServer | null>(null);
    const [marketplaceServers, setMarketplaceServers] = useState<McpMarketplaceServer[]>([]);
    const [installedServers, setInstalledServers] = useState<MCPServerConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);

    // Load marketplace servers
    const loadMarketplace = useCallback(async () => {
        try {
            setLoading(true);
            const result = await mcpMarketplaceClient.list();
            if (result.success && result.servers) {
                setMarketplaceServers(result.servers);
            }
        } catch (error) {
            window.electron.log.error('Failed to load marketplace', error as Error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load installed servers
    const loadInstalled = useCallback(async () => {
        try {
            const result = await mcpMarketplaceClient.installed();
            if (result.success && result.servers) {
                setInstalledServers(result.servers);
            }
        } catch (error) {
            window.electron.log.error('Failed to load installed servers', error as Error);
        }
    }, []);

    useEffect(() => {
        void loadMarketplace();
        void loadInstalled();
    }, [loadMarketplace, loadInstalled]);

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
            if (!stored) {
                return;
            }
            const parsed = safeJsonParse<string[]>(stored, []);
            const normalized = parsed
                .filter((value): value is string => typeof value === 'string')
                .slice(0, MAX_SEARCH_HISTORY);
            setSearchHistory(normalized);
        } catch (error) {
            window.electron.log.error('Failed to read marketplace search history', error as Error);
        }
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(searchHistory));
        } catch (error) {
            window.electron.log.error('Failed to persist marketplace search history', error as Error);
        }
    }, [searchHistory]);

    const handleInstall = useCallback(
        async (serverId: string) => {
            try {
                const result = await mcpMarketplaceClient.install(serverId);
                if (result.success) {
                    await loadInstalled();
                    onInstall?.(serverId);
                }
            } catch (error) {
                window.electron.log.error('Failed to install server', error as Error);
            }
        },
        [loadInstalled, onInstall]
    );

    const handleUninstall = useCallback(
        async (serverId: string) => {
            try {
                const result = await mcpMarketplaceClient.uninstall(serverId);
                if (result.success) {
                    await loadInstalled();
                    onUninstall?.(serverId);
                }
            } catch (error) {
                window.electron.log.error('Failed to uninstall server', error as Error);
            }
        },
        [loadInstalled, onUninstall]
    );

    const addSearchHistoryEntry = useCallback((query: string) => {
        const normalizedQuery = query.trim();
        if (normalizedQuery.length < 2) {
            return;
        }
        setSearchHistory(previous => {
            const deduped = previous.filter(
                entry => entry.toLowerCase() !== normalizedQuery.toLowerCase()
            );
            return [normalizedQuery, ...deduped].slice(0, MAX_SEARCH_HISTORY);
        });
    }, []);

    const clearSearchHistory = useCallback(() => {
        setSearchHistory([]);
    }, []);

    const installedIds = useMemo(
        () => new Set(installedServers.map(s => s.id)),
        [installedServers]
    );

    const filteredTools = useMemo(() => {
        let filtered = marketplaceServers;

        // Filter by category
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(server => server.categories?.includes(selectedCategory));
        }

        // Filter by search query
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(
                server =>
                    server.name?.toLowerCase().includes(q) ||
                    server.description?.toLowerCase().includes(q) ||
                    server.publisher?.toLowerCase().includes(q) ||
                    server.categories?.some(cat => cat.toLowerCase().includes(q))
            );
        }

        return filtered;
    }, [marketplaceServers, selectedCategory, searchQuery]);

    // Paginated tools
    const paginatedTools = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filteredTools.slice(startIndex, endIndex);
    }, [filteredTools, currentPage]);

    const totalPages = Math.ceil(filteredTools.length / ITEMS_PER_PAGE);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedCategory]);

    const installedCount = installedServers.length;

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border/30">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Plug className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold">{t('mcp.storeTitle')}</h1>
                        <p className="text-xs text-muted-foreground">
                            {t('mcp.storeSubtitle', { count: installedCount })}
                        </p>
                    </div>
                </div>
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <input
                        type="text"
                        placeholder={t('mcp.searchTools')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={event => {
                            if (event.key === 'Enter') {
                                addSearchHistoryEntry(searchQuery);
                            }
                        }}
                        onBlur={() => addSearchHistoryEntry(searchQuery)}
                        className="w-full bg-muted/30 border border-border/30 rounded-lg pl-9 pr-3 py-2 text-sm outline-none"
                    />
                </div>
                {searchHistory.length > 0 && (
                    <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
                        {searchHistory.map(entry => (
                            <button
                                key={entry}
                                onClick={() => setSearchQuery(entry)}
                                className="rounded-full border border-border/40 bg-muted/20 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                            >
                                {entry}
                            </button>
                        ))}
                        <button
                            onClick={clearSearchHistory}
                            title={t('common.clear')}
                            aria-label={t('common.clear')}
                            className="rounded-full border border-border/40 bg-muted/20 p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                )}
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {CATEGORIES.map(({ id, labelKey, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setSelectedCategory(id)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                                selectedCategory === id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                            )}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {t(labelKey)}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {paginatedTools.map(tool => (
                                <ToolCard
                                    key={tool.id}
                                    tool={tool}
                                    isInstalled={installedIds.has(tool.id)}
                                    onSelect={setSelectedTool}
                                    onInstall={id => {
                                        void handleInstall(id);
                                    }}
                                    onUninstall={id => {
                                        void handleUninstall(id);
                                    }}
                                    onConfigure={onConfigure}
                                    t={t}
                                />
                            ))}
                        </div>
                        {filteredTools.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                                <Plug className="w-12 h-12 mb-3 opacity-30" />
                                <p className="text-sm">{t('mcp.noToolsFound')}</p>
                            </div>
                        )}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-6 pb-4">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className={cn(
                                        'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                                        currentPage === 1
                                            ? 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
                                            : 'bg-muted/50 text-foreground hover:bg-muted'
                                    )}
                                >
                                    {t('common.previous')}
                                </button>
                                <span className="text-sm text-muted-foreground px-3">
                                    {t('common.pageOf', {
                                        current: currentPage,
                                        total: totalPages,
                                    })}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className={cn(
                                        'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                                        currentPage === totalPages
                                            ? 'bg-muted/30 text-muted-foreground/50 cursor-not-allowed'
                                            : 'bg-muted/50 text-foreground hover:bg-muted'
                                    )}
                                >
                                    {t('common.next')}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
            {selectedTool && (
                <ToolDetailModal
                    tool={selectedTool}
                    isInstalled={installedIds.has(selectedTool.id)}
                    onInstall={id => {
                        void handleInstall(id);
                    }}
                    onUninstall={id => {
                        void handleUninstall(id);
                    }}
                    onConfigure={onConfigure}
                    onClose={() => setSelectedTool(null)}
                    t={t}
                />
            )}
        </div>
    );
};

export default MCPStore;
