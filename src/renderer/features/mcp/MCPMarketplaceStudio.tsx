import { safeJsonParse } from '@shared/utils/sanitize.util';
import { ArrowRightLeft, Check, History, Plug, Search, Settings, Shield, Star, TrendingUp, UploadCloud, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n';
import { mcpMarketplaceClient, McpServerLike } from '@/lib/mcp-marketplace-client';
import { cn } from '@/lib/utils';

type SurfaceMode = 'browse' | 'installed' | 'compare';
type SortMode = 'relevance' | 'downloads' | 'rating' | 'updated' | 'name';
type FilterMode = 'all' | 'installed' | 'official';
type WizardStep = 'permissions' | 'config' | 'progress' | 'summary';

interface ToolReview {
    id: string;
    rating: number;
    comment: string;
    helpfulVotes: number;
    createdAt: number;
}

interface WizardState {
    open: boolean;
    step: WizardStep;
    tool: McpServerLike | null;
    progress: number;
    error: string | null;
}

const SEARCH_HISTORY_STORAGE_KEY = 'mcp.store.search-history.v3';
const REVIEW_STORAGE_KEY = 'mcp.store.reviews.v3';

const parseVersion = (version?: string): number[] => {
    if (!version) {
        return [0];
    }
    const values = version.replace(/^v/i, '').split('.').map(part => {
        const parsed = Number.parseInt(part.replace(/[^\d]/g, ''), 10);
        return Number.isFinite(parsed) ? parsed : 0;
    });
    return values.length > 0 ? values : [0];
};

const compareVersions = (left?: string, right?: string): number => {
    const l = parseVersion(left);
    const r = parseVersion(right);
    const size = Math.max(l.length, r.length);
    for (let index = 0; index < size; index += 1) {
        const lv = l[index] ?? 0;
        const rv = r[index] ?? 0;
        if (lv !== rv) {
            return lv > rv ? 1 : -1;
        }
    }
    return 0;
};

const buildReadme = (tool: McpServerLike): string => {
    return [
        `# ${tool.name}`,
        '',
        tool.description ?? '',
        '',
        '## Command',
        '',
        tool.command ?? `npx -y ${tool.id}`,
        '',
        '## Categories',
        ...(tool.categories ?? [])
    ].join('\n');
};

const avgRating = (tool: McpServerLike, reviews: ToolReview[]): number => {
    if (reviews.length === 0) {
        return tool.rating ?? 0;
    }
    const total = reviews.reduce((sum, review) => sum + review.rating, 0) + (tool.rating ?? 0);
    return total / (reviews.length + (tool.rating ? 1 : 0));
};

const RatingStars = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => (
    <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
            <button key={star} onClick={() => onChange(star)} className="rounded p-1 hover:bg-muted/30">
                <Star className={cn('h-4 w-4', value >= star ? 'fill-warning text-warning' : 'text-muted-foreground/40')} />
            </button>
        ))}
    </div>
);

export const MCPMarketplaceStudio: React.FC<{ onConfigure?: (id: string) => void }> = ({ onConfigure }) => {
    const { t } = useTranslation();
    const [surface, setSurface] = useState<SurfaceMode>('browse');
    const [sortMode, setSortMode] = useState<SortMode>('relevance');
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchHistory, setSearchHistory] = useState<string[]>([]);
    const [marketplaceServers, setMarketplaceServers] = useState<McpServerLike[]>([]);
    const [installedServers, setInstalledServers] = useState<McpServerLike[]>([]);
    const [compareIds, setCompareIds] = useState<string[]>([]);
    const [selectedTool, setSelectedTool] = useState<McpServerLike | null>(null);
    const [versionHistory, setVersionHistory] = useState<string[]>([]);
    const [reviewStore, setReviewStore] = useState<Record<string, ToolReview[]>>({});
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewDraft, setReviewDraft] = useState('');
    const [loading, setLoading] = useState(true);
    const [wizard, setWizard] = useState<WizardState>({ open: false, step: 'permissions', tool: null, progress: 0, error: null });

    const loadMarketplace = useCallback(async () => {
        setLoading(true);
        try {
            const result = await mcpMarketplaceClient.list();
            if (result.success && result.servers) {
                setMarketplaceServers(result.servers);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const loadInstalled = useCallback(async () => {
        const result = await mcpMarketplaceClient.installed();
        if (result.success && result.servers) {
            setInstalledServers(result.servers);
        }
    }, []);

    useEffect(() => {
        void Promise.all([loadMarketplace(), loadInstalled()]);
        const historyRaw = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
        if (historyRaw) {
            setSearchHistory(safeJsonParse<string[]>(historyRaw, []));
        }
        const reviewsRaw = window.localStorage.getItem(REVIEW_STORAGE_KEY);
        if (reviewsRaw) {
            setReviewStore(safeJsonParse<Record<string, ToolReview[]>>(reviewsRaw, {}));
        }
    }, [loadInstalled, loadMarketplace]);

    useEffect(() => {
        window.localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(searchHistory.slice(0, 10)));
    }, [searchHistory]);

    useEffect(() => {
        window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviewStore));
    }, [reviewStore]);

    const installedMap = useMemo(() => new Map(installedServers.map(server => [server.id, server])), [installedServers]);

    const filteredTools = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const sorted = marketplaceServers.filter(server => {
            if (filterMode === 'installed' && !installedMap.has(server.id)) {
                return false;
            }
            if (filterMode === 'official' && !server.isOfficial) {
                return false;
            }
            if (!q) {
                return true;
            }
            const text = [server.name, server.description ?? '', server.publisher ?? '', ...(server.categories ?? [])].join(' ').toLowerCase();
            return text.includes(q);
        });

        sorted.sort((left, right) => {
            if (sortMode === 'name') {
                return left.name.localeCompare(right.name);
            }
            if (sortMode === 'downloads') {
                return (right.downloads ?? 0) - (left.downloads ?? 0);
            }
            if (sortMode === 'rating') {
                return avgRating(right, reviewStore[right.id] ?? []) - avgRating(left, reviewStore[left.id] ?? []);
            }
            if (sortMode === 'updated') {
                return compareVersions(right.version, left.version);
            }
            const rightScore = (right.downloads ?? 0) / 1000 + avgRating(right, reviewStore[right.id] ?? []) * 8 + (right.isOfficial ? 30 : 0);
            const leftScore = (left.downloads ?? 0) / 1000 + avgRating(left, reviewStore[left.id] ?? []) * 8 + (left.isOfficial ? 30 : 0);
            return rightScore - leftScore;
        });
        return sorted;
    }, [filterMode, installedMap, marketplaceServers, reviewStore, searchQuery, sortMode]);

    const featured = useMemo(() => filteredTools.slice(0, 6), [filteredTools]);
    const trending = useMemo(() => [...filteredTools].sort((left, right) => (right.downloads ?? 0) - (left.downloads ?? 0)).slice(0, 6), [filteredTools]);
    const recent = useMemo(() => [...filteredTools].sort((left, right) => compareVersions(right.version, left.version)).slice(0, 6), [filteredTools]);
    const compareTools = useMemo(() => compareIds.map(id => marketplaceServers.find(server => server.id === id)).filter((value): value is McpServerLike => Boolean(value)), [compareIds, marketplaceServers]);

    const openTool = useCallback(async (tool: McpServerLike) => {
        setSelectedTool(tool);
        setReviewDraft('');
        setReviewRating(5);
        const history = await mcpMarketplaceClient.versionHistory(tool.id);
        setVersionHistory(history.success && history.history ? history.history : []);
    }, []);

    const toggleCompare = useCallback((id: string) => {
        setCompareIds(previous => {
            if (previous.includes(id)) {
                return previous.filter(item => item !== id);
            }
            if (previous.length >= 3) {
                return [...previous.slice(1), id];
            }
            return [...previous, id];
        });
    }, []);

    const startWizardInstall = useCallback((tool: McpServerLike) => {
        setWizard({ open: true, step: 'permissions', tool, progress: 0, error: null });
    }, []);

    const runWizardInstall = useCallback(async () => {
        if (!wizard.tool) {
            return;
        }
        setWizard(previous => ({ ...previous, step: 'progress', progress: 20, error: null }));
        let progress = 20;
        const timer = window.setInterval(() => {
            progress = Math.min(progress + 20, 90);
            setWizard(previous => ({ ...previous, progress }));
        }, 200);
        try {
            const result = await mcpMarketplaceClient.install(wizard.tool.id);
            window.clearInterval(timer);
            if (!result.success) {
                throw new Error(result.error ?? 'install failed');
            }
            setWizard(previous => ({ ...previous, progress: 100, step: 'summary' }));
            await loadInstalled();
        } catch (error) {
            window.clearInterval(timer);
            setWizard(previous => ({ ...previous, step: 'config', progress: 0, error: (error as Error).message }));
        }
    }, [loadInstalled, wizard.tool]);

    const closeWizard = useCallback(() => {
        setWizard({ open: false, step: 'permissions', tool: null, progress: 0, error: null });
    }, []);

    const submitReview = useCallback(() => {
        if (!selectedTool) {
            return;
        }
        const nextReview: ToolReview = { id: `${selectedTool.id}-${Date.now()}`, rating: reviewRating, comment: reviewDraft.trim(), helpfulVotes: 0, createdAt: Date.now() };
        setReviewStore(previous => ({ ...previous, [selectedTool.id]: [...(previous[selectedTool.id] ?? []), nextReview] }));
        setReviewDraft('');
    }, [reviewDraft, reviewRating, selectedTool]);

    const voteHelpful = useCallback((toolId: string, reviewId: string) => {
        setReviewStore(previous => ({
            ...previous,
            [toolId]: (previous[toolId] ?? []).map(review => review.id === reviewId ? { ...review, helpfulVotes: review.helpfulVotes + 1 } : review)
        }));
    }, []);

    const renderCard = (tool: McpServerLike) => {
        const installed = installedMap.has(tool.id);
        const hasUpdate = compareVersions(tool.version, installedMap.get(tool.id)?.version) > 0;
        const average = avgRating(tool, reviewStore[tool.id] ?? []);
        return (
            <div key={tool.id} className={cn('rounded-xl border p-4', installed ? 'border-primary/35 bg-primary/5' : 'border-border/40 bg-card/30')}>
                <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{tool.name}</span>
                        {tool.isOfficial && <Shield className="h-3.5 w-3.5 text-primary" />}
                        {hasUpdate && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] text-warning">{t('common.update')}</span>}
                    </div>
                    <button onClick={() => toggleCompare(tool.id)} className={cn('rounded border px-2 py-1 text-[11px]', compareIds.includes(tool.id) ? 'border-primary text-primary' : 'border-border/40 text-muted-foreground')}>{compareIds.includes(tool.id) ? t('common.done') : t('mcp.compareAction')}</button>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{tool.description}</p>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-warning text-warning" />{average.toFixed(1)}</span>
                    <span>{(tool.downloads ?? 0).toLocaleString()}</span>
                    <span>v{tool.version ?? '1.0.0'}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                    <button onClick={() => void openTool(tool)} className="flex-1 rounded-md border border-border/40 px-2 py-1.5 text-xs hover:bg-muted/20">{t('common.details')}</button>
                    {installed ? (
                        <button onClick={() => { void mcpMarketplaceClient.uninstall(tool.id).then(loadInstalled); }} className="rounded-md border border-destructive/30 px-2 py-1.5 text-xs text-destructive">{t('mcp.uninstall')}</button>
                    ) : (
                        <button onClick={() => startWizardInstall(tool)} className="rounded-md border border-primary/40 px-2 py-1.5 text-xs text-primary">{t('mcp.install')}</button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-border/40 px-6 py-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Plug className="h-5 w-5" /></div><div><h2 className="text-lg font-semibold">{t('mcp.storeTitle')}</h2><p className="text-xs text-muted-foreground">{t('mcp.toolsInstalled', { count: installedServers.length })}</p></div></div>
                    <div className="flex items-center gap-2">
                        {(['browse', 'installed', 'compare'] as SurfaceMode[]).map(mode => (
                            <button key={mode} onClick={() => setSurface(mode)} className={cn('rounded-md px-3 py-1.5 text-xs', surface === mode ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground')}>{mode === 'browse' ? t('mcp.marketplace') : mode === 'installed' ? t('mcp.installedTools') : t('mcp.compareTitle')}</button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[260px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" /><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} onBlur={() => setSearchHistory(previous => [searchQuery, ...previous.filter(item => item !== searchQuery)].filter(item => item.trim().length > 1).slice(0, 10))} placeholder={t('mcp.searchPlaceholder')} className="w-full rounded-lg border border-border/40 bg-muted/20 py-2 pl-9 pr-3 text-sm" /></div>
                    <select value={sortMode} onChange={event => setSortMode(event.target.value as SortMode)} className="rounded-md border border-border/40 bg-background px-2 py-1.5 text-xs"><option value="relevance">{t('mcp.sort.relevance')}</option><option value="downloads">{t('mcp.sort.downloads')}</option><option value="rating">{t('mcp.sort.rating')}</option><option value="updated">{t('mcp.sort.updated')}</option><option value="name">{t('mcp.sort.name')}</option></select>
                    <select value={filterMode} onChange={event => setFilterMode(event.target.value as FilterMode)} className="rounded-md border border-border/40 bg-background px-2 py-1.5 text-xs"><option value="all">{t('mcp.filter.all')}</option><option value="installed">{t('mcp.filter.installed')}</option><option value="official">{t('mcp.filter.official')}</option></select>
                </div>
                {searchHistory.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{searchHistory.slice(0, 6).map(item => <button key={item} onClick={() => setSearchQuery(item)} className="rounded-full border border-border/40 bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">{item}</button>)}</div>}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
                {loading ? <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div> : surface === 'installed' ? (
                    <div className="space-y-3">
                        <div className="flex items-center justify-end"><button onClick={() => { void Promise.all(installedServers.map(server => { const current = marketplaceServers.find(entry => entry.id === server.id); return compareVersions(current?.version, server.version) > 0 ? mcpMarketplaceClient.updateConfig(server.id, { version: current?.version ?? server.version ?? '1.0.0' }) : Promise.resolve({ success: true }); })).then(loadInstalled); }} className="inline-flex items-center gap-1 rounded-md border border-primary/40 px-2 py-1.5 text-xs text-primary"><UploadCloud className="h-3.5 w-3.5" />{t('mcp.updateAll')}</button></div>
                        {installedServers.map(server => <div key={server.id} className="rounded-lg border border-border/40 bg-card/40 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-2"><span className="text-sm font-semibold">{server.name}</span>{server.enabled ? <Check className="h-3.5 w-3.5 text-success" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}</div><div className="text-xs text-muted-foreground">v{server.version ?? '1.0.0'} • {(server.tools ?? []).length} {t('mcp.tools')}</div></div><div className="flex items-center gap-2"><button onClick={() => { void mcpMarketplaceClient.toggle(server.id, !(server.enabled ?? false)).then(loadInstalled); }} className="rounded-md border border-border/40 px-2 py-1 text-xs">{server.enabled ? t('mcp.disableAction') : t('mcp.enableAction')}</button><button onClick={() => onConfigure?.(server.id)} className="inline-flex items-center gap-1 rounded-md border border-border/40 px-2 py-1 text-xs"><Settings className="h-3 w-3" />{t('mcp.configure')}</button></div></div></div>)}
                    </div>
                ) : surface === 'compare' ? (
                    compareTools.length < 2 ? <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground">{t('mcp.compareHint')}</div> : <div className="overflow-x-auto rounded-lg border border-border/40"><table className="min-w-full text-sm"><thead className="bg-muted/20"><tr><th className="px-3 py-2 text-left text-xs text-muted-foreground">{t('common.details')}</th>{compareTools.map(tool => <th key={tool.id} className="px-3 py-2 text-left"><div className="flex items-center justify-between gap-2"><span>{tool.name}</span><button onClick={() => toggleCompare(tool.id)} className="rounded p-1 hover:bg-muted/30"><X className="h-3.5 w-3.5" /></button></div></th>)}</tr></thead><tbody><tr className="border-t border-border/30"><td className="px-3 py-2 text-xs text-muted-foreground">{t('mcp.rating')}</td>{compareTools.map(tool => <td key={`${tool.id}-rating`} className="px-3 py-2">{avgRating(tool, reviewStore[tool.id] ?? []).toFixed(1)}</td>)}</tr><tr className="border-t border-border/30"><td className="px-3 py-2 text-xs text-muted-foreground">{t('mcp.downloads')}</td>{compareTools.map(tool => <td key={`${tool.id}-downloads`} className="px-3 py-2">{(tool.downloads ?? 0).toLocaleString()}</td>)}</tr><tr className="border-t border-border/30"><td className="px-3 py-2 text-xs text-muted-foreground">{t('mcp.version')}</td>{compareTools.map(tool => <td key={`${tool.id}-version`} className="px-3 py-2">{tool.version ?? '1.0.0'}</td>)}</tr><tr className="border-t border-border/30"><td className="px-3 py-2 text-xs text-muted-foreground">{t('mcp.features')}</td>{compareTools.map(tool => <td key={`${tool.id}-features`} className="px-3 py-2">{(tool.capabilities ?? []).join(', ') || '-'}</td>)}</tr></tbody></table></div>
                ) : (
                    <div className="space-y-5">
                        {searchQuery.trim().length === 0 ? <><section><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Plug className="h-4 w-4 text-primary" />{t('mcp.featuredSection')}</div><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{featured.map(renderCard)}</div></section><section><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-primary" />{t('mcp.trendingSection')}</div><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{trending.map(renderCard)}</div></section><section><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-primary" />{t('mcp.recentSection')}</div><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{recent.map(renderCard)}</div></section></> : filteredTools.length === 0 ? <div className="rounded-lg border border-dashed border-border/40 p-10 text-center text-sm text-muted-foreground">{t('mcp.noToolsFound')}</div> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredTools.map(renderCard)}</div>}
                    </div>
                )}
            </div>

            {compareIds.length > 0 && surface !== 'compare' && <div className="border-t border-border/40 bg-muted/10 px-6 py-2"><div className="flex items-center justify-between text-xs"><span>{t('mcp.compareSelected', { count: compareIds.length })}</span><div className="flex items-center gap-2"><button onClick={() => setCompareIds([])} className="rounded-md border border-border/40 px-2 py-1">{t('common.clear')}</button><button onClick={() => setSurface('compare')} className="inline-flex items-center gap-1 rounded-md border border-primary/40 px-2 py-1 text-primary"><ArrowRightLeft className="h-3 w-3" />{t('mcp.compareTitle')}</button></div></div></div>}

            {selectedTool && <div className="fixed inset-0 z-50 bg-black/50 p-4" onClick={() => setSelectedTool(null)}><div onClick={event => event.stopPropagation()} className="mx-auto flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border/40 bg-card"><div className="border-b border-border/40 px-5 py-4"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><h3 className="text-lg font-semibold">{selectedTool.name}</h3>{selectedTool.isOfficial && <Shield className="h-4 w-4 text-primary" />}</div><p className="text-sm text-muted-foreground">{selectedTool.description}</p></div><button onClick={() => setSelectedTool(null)} className="rounded-md border border-border/40 p-2 hover:bg-muted/30"><X className="h-4 w-4" /></button></div></div><div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-3"><div className="space-y-4 lg:col-span-2"><div className="rounded-lg border border-border/40 bg-muted/10 p-4"><h4 className="mb-2 text-sm font-semibold">{t('mcp.readmeTitle')}</h4><pre className="whitespace-pre-wrap text-xs text-muted-foreground">{buildReadme(selectedTool)}</pre></div><div className="rounded-lg border border-border/40 bg-muted/10 p-4"><h4 className="mb-2 text-sm font-semibold">{t('mcp.ratingSection')}</h4><div className="mb-3 flex items-center gap-2"><RatingStars value={reviewRating} onChange={setReviewRating} /><span className="text-xs text-muted-foreground">{avgRating(selectedTool, reviewStore[selectedTool.id] ?? []).toFixed(1)} / 5</span></div><textarea value={reviewDraft} onChange={event => setReviewDraft(event.target.value)} placeholder={t('mcp.reviewPlaceholder')} className="min-h-[80px] w-full rounded-md border border-border/40 bg-background px-2 py-1.5 text-xs" /><div className="mt-2 flex justify-end"><button onClick={submitReview} className="rounded-md border border-primary/40 px-2 py-1 text-xs text-primary">{t('mcp.submitReview')}</button></div><div className="mt-3 space-y-2">{(reviewStore[selectedTool.id] ?? []).map(review => <div key={review.id} className="rounded-md border border-border/30 p-2 text-xs"><div className="mb-1 flex items-center justify-between"><span>{'★'.repeat(review.rating)}</span><span className="text-muted-foreground">{new Date(review.createdAt).toLocaleDateString()}</span></div><p className="text-muted-foreground">{review.comment}</p><button onClick={() => voteHelpful(selectedTool.id, review.id)} className="mt-1 rounded border border-border/30 px-1.5 py-0.5 text-[11px]">{t('mcp.helpfulVote')} ({review.helpfulVotes})</button></div>)}</div></div></div><div className="space-y-4"><div className="rounded-lg border border-border/40 bg-muted/10 p-4 text-xs"><h4 className="mb-2 text-sm font-semibold">{t('mcp.versionHistoryTitle')}</h4><div className="space-y-1 text-muted-foreground">{versionHistory.length === 0 ? <div>{t('mcp.noVersionHistory')}</div> : versionHistory.slice().reverse().map((version, index) => <div key={`${version}-${index}`}>{version}</div>)}</div></div><div className="rounded-lg border border-border/40 bg-muted/10 p-4 text-xs"><h4 className="mb-2 text-sm font-semibold">{t('mcp.permissionsTitle')}</h4>{((selectedTool?.capabilities ?? []).length > 0 ? selectedTool?.capabilities ?? [] : ['standard-runtime']).map(capability => <div key={capability} className="rounded bg-background/70 px-2 py-1 text-muted-foreground">{capability}</div>)}</div><div className="rounded-lg border border-border/40 bg-muted/10 p-4 text-xs"><h4 className="mb-2 text-sm font-semibold">{t('mcp.dependencyTreeTitle')}</h4>{(selectedTool.dependencies ?? []).length === 0 ? <div className="text-muted-foreground">{t('mcp.noDependencies')}</div> : (selectedTool.dependencies ?? []).map(dep => <div key={dep}>↳ {dep}</div>)}</div><div className="flex gap-2">{installedMap.has(selectedTool.id) ? <button onClick={() => { void mcpMarketplaceClient.uninstall(selectedTool.id).then(loadInstalled); setSelectedTool(null); }} className="flex-1 rounded-md border border-destructive/40 px-2 py-1.5 text-xs text-destructive">{t('mcp.uninstall')}</button> : <button onClick={() => { setSelectedTool(null); startWizardInstall(selectedTool); }} className="flex-1 rounded-md border border-primary/40 px-2 py-1.5 text-xs text-primary">{t('mcp.install')}</button>}<button onClick={() => onConfigure?.(selectedTool.id)} className="inline-flex items-center gap-1 rounded-md border border-border/40 px-2 py-1.5 text-xs"><Settings className="h-3 w-3" />{t('mcp.configure')}</button></div></div></div></div></div>}

            {wizard.open && wizard.tool && <div className="fixed inset-0 z-50 bg-black/50 p-4" onClick={closeWizard}><div onClick={event => event.stopPropagation()} className="mx-auto w-full max-w-lg rounded-xl border border-border/40 bg-card p-4"><h3 className="mb-2 text-base font-semibold">{t('mcp.installWizardTitle', { name: wizard.tool.name })}</h3><div className="mb-4 text-xs text-muted-foreground">{t(`mcp.wizard.${wizard.step}`)}</div>{wizard.step === 'permissions' && <div className="space-y-2">{((wizard.tool?.capabilities ?? []).length > 0 ? wizard.tool?.capabilities ?? [] : ['standard-runtime']).map(capability => <div key={capability} className="rounded-md border border-border/40 px-2 py-1 text-xs">{capability}</div>)}</div>}{wizard.step === 'config' && <div className="space-y-2"><div className="text-xs text-muted-foreground">{t('mcp.wizardConfigHelp')}</div><input className="w-full rounded-md border border-border/40 bg-background px-2 py-1.5 text-xs" placeholder={t('mcp.wizardConfigPlaceholder')} />{wizard.error && <div className="text-xs text-destructive">{wizard.error}</div>}</div>}{wizard.step === 'progress' && <div className="space-y-2"><div className="h-2 w-full overflow-hidden rounded-full bg-muted/30"><div className="h-full bg-primary transition-all" style={{ width: `${wizard.progress}%` }} /></div><div className="text-xs text-muted-foreground">{wizard.progress}% {t('common.processing')}</div></div>}{wizard.step === 'summary' && <div className="rounded-md border border-success/30 bg-success/10 p-3 text-xs text-success">{t('mcp.wizardSummarySuccess')}</div>}<div className="mt-4 flex items-center justify-between"><button onClick={closeWizard} className="rounded-md border border-border/40 px-2 py-1 text-xs">{wizard.step === 'summary' ? t('common.close') : t('common.cancel')}</button><div className="flex items-center gap-2">{wizard.step === 'permissions' && <button onClick={() => setWizard(previous => ({ ...previous, step: 'config' }))} className="rounded-md border border-primary/40 px-2 py-1 text-xs text-primary">{t('common.next')}</button>}{wizard.step === 'config' && <button onClick={() => { void runWizardInstall(); }} className="rounded-md border border-primary/40 px-2 py-1 text-xs text-primary">{t('mcp.install')}</button>}{wizard.step === 'summary' && <button onClick={closeWizard} className="rounded-md border border-primary/40 px-2 py-1 text-xs text-primary">{t('common.done')}</button>}</div></div></div></div>}
        </div>
    );
};

export default MCPMarketplaceStudio;
