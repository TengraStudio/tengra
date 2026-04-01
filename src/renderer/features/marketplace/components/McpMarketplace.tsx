import type { MarketplaceItem, MarketplaceRegistry, MarketplaceTheme } from '@shared/types/marketplace';
import {
    Download,
    MessageSquare,
    Package,
    Palette,
    RefreshCw,
    Search,
    Sparkles,
    Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useAuthLanguage } from '@/context/AuthContext';
import { useTranslation } from '@/i18n';
import { pushNotification } from '@/store/notification-center.store';

type MarketplaceMode = 'mcp' | 'themes' | 'personas' | 'models' | 'prompts';

export function McpMarketplace({ mode }: { mode: MarketplaceMode }): JSX.Element {
    const { language } = useAuthLanguage();
    const { t } = useTranslation(language);
    const [registry, setRegistry] = useState<MarketplaceRegistry | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [installingId, setInstallingId] = useState<string | null>(null);

    const fetchRegistry = useCallback(async () => {
        try {
            const data = await window.electron.marketplace.fetch();
            setRegistry(data);
        } catch {
            pushNotification({ type: 'error', message: 'Pazar yeri verileri alınamadı.' });
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            await fetchRegistry();
        } finally {
            setLoading(false);
        }
    }, [fetchRegistry]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const handleInstall = async (item: MarketplaceItem) => {
        if (installingId) { return; }
        setInstallingId(item.id);
        try {
            const result = await window.electron.marketplace.install({
                id: item.id,
                type: item.itemType,
                downloadUrl: item.downloadUrl,
            });
            if (result.success) {
                pushNotification({ type: 'success', message: `${item.name} başarıyla yüklendi.` });
                void fetchData();
            } else {
                pushNotification({ type: 'error', message: result.message || 'Yükleme başarısız oldu.' });
            }
        } catch {
            pushNotification({ type: 'error', message: 'Bir ağ hatası oluştu.' });
        } finally {
            setInstallingId(null);
        }
    };

    if (loading) { return <Loader />; }

    const getStoreItems = () => {
        if (!registry) { return []; }
        switch (mode) {
            case 'mcp': return registry.mcp || [];
            case 'themes': return registry.themes || [];
            case 'personas': return registry.personas || [];
            case 'prompts': return registry.prompts || [];
            case 'models': return registry.models || [];
            default: return [];
        }
    };

    const storeItems = getStoreItems();
    const filtered = storeItems.filter(i => 
        i.name.toLowerCase().includes(search.toLowerCase()) || 
        i.description.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <Toolbar search={search} onSearch={setSearch} count={filtered.length} t={t} />
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {filtered.map(item => (
                    <MarketCard 
                        key={item.id} 
                        item={item} 
                        isInstalling={installingId === item.id} 
                        onInstall={(it) => void handleInstall(it)} 
                    />
                ))}
                {filtered.length === 0 && <EmptyState t={t} mode={mode} />}
            </div>
        </div>
    );
}

function MarketCard({ item, onInstall, isInstalling }: {
    item: MarketplaceItem;
    onInstall: (item: MarketplaceItem) => void;
    isInstalling: boolean;
}) {
    const { t } = useTranslation();
    const themeItem = item.itemType === 'theme' ? (item as MarketplaceTheme) : null;

    const Icon = {
        theme: Palette,
        mcp: Package,
        persona: Sparkles,
        model: Zap,
        prompt: MessageSquare,
    }[item.itemType] || Package;

    return (
        <div className="group flex flex-col bg-card border border-border/40 rounded-lg p-5 hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-md">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded bg-muted/40 text-muted-foreground group-hover:text-primary transition-colors">
                        <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground leading-none mb-1">{item.name}</h3>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-tight">by {item.author}</p>
                    </div>
                </div>
                <button
                    onClick={() => onInstall(item)}
                    disabled={isInstalling}
                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary text-xs font-bold uppercase transition-all hover:text-primary-foreground group/btn disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isInstalling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    {isInstalling ? (t('marketplace.installing') || 'Installing...') : (t('marketplace.install') || 'Install')}
                </button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>
            {themeItem?.previewColor && (
                <div className="mt-4 flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full border border-border/20 shadow-sm" style={{ backgroundColor: themeItem.previewColor }} />
                    <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">PREVIEW</span>
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
                    placeholder={t('marketplace.search') || 'Search...'} 
                    value={search} 
                    onChange={(e) => onSearch(e.target.value)} 
                    className="w-full bg-background border border-border/30 rounded px-10 py-2 text-sm focus:outline-none focus:border-primary/40 transition-all font-medium" 
                />
            </div>
            <div className="hidden sm:flex items-center gap-2">
                <div className="px-3 py-1 rounded-full bg-muted/30 text-xs font-black text-muted-foreground uppercase tracking-widest">
                    {count} {t('marketplace.results') || 'Results Found'}
                </div>
            </div>
        </div>
    );
}

function EmptyState({ t, mode }: { t: (key: string) => string, mode: MarketplaceMode }) {
    return (
        <div className="col-span-full py-20 text-center border border-dashed border-border/40 rounded-xl bg-muted/5">
            <Package className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">{t('marketplace.empty') || `No ${mode} found`}</p>
        </div>
    );
}

function Loader() {
    return (
        <div className="flex flex-col items-center justify-center py-32 space-y-5">
            <RefreshCw className="w-8 h-8 text-primary animate-spin opacity-40" />
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest animate-pulse">Syncing Marketplace</p>
        </div>
    );
}
