import type {
    MarketplaceItem,
    MarketplaceLanguage,
    MarketplaceModel,
    MarketplaceModelPerformanceEstimate 
} from '@shared/types/marketplace';
import { compareVersions } from '@shared/utils/extension.util';
import { 
    CheckCircle2, 
    Download, 
    Globe, 
    MessageSquare,
    Package, 
    Palette, 
    Puzzle, 
    RefreshCw, 
    Sparkles, 
    Trash2,
    Zap 
} from 'lucide-react';
import type { ElementType } from 'react';

import { useTranslation } from '@/i18n';
import { useDownloadStore } from '@/store/download.store';

const formatNumber = (num: number): string => {
    if (num >= 1000000000) { return (num / 1000000000).toFixed(1) + 'B'; }
    if (num >= 1000000) { return (num / 1000000).toFixed(1) + 'M'; }
    if (num >= 1000) { return (num / 1000).toFixed(1) + 'K'; }
    return num.toString();
};

const formatBytes = (bytes: number): string => {
    if (bytes <= 0) {
        return '0 B';
    }
    if (bytes >= 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (bytes >= 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }
    return `${Math.max(1, Math.round(bytes))} B`;
};

export function MarketCard({
    item,
    isActive,
    isInstalling,
    onInstall,
    onUninstall,
    onActivateLanguage,
}: {
    item: MarketplaceItem;
    isActive: boolean;
    isInstalling: boolean;
    onInstall: (item: MarketplaceItem) => void;
    onUninstall?: (item: MarketplaceItem) => void;
    onActivateLanguage?: (item: MarketplaceLanguage) => void;
}) {
    const { t } = useTranslation();
    const languageItem = item.itemType === 'language' ? (item as MarketplaceLanguage) : null;
    const modelItem = item.itemType === 'model' ? (item as MarketplaceModel) : null;
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
        extension: Puzzle,
    } as Record<string, ElementType>)[item.itemType] || Package);

    const performance = modelItem?.performance as MarketplaceModelPerformanceEstimate | undefined;

    const versionDisplay = (
        <div className="flex items-center gap-1.5 font-black select-none">
            {installedVersion ? (
                <>
                    {compareVersions(item.version, installedVersion) > 0 ? (
                        <div className="flex items-center gap-1.5">
                             <span className="text-[10px] text-muted-foreground/30 line-through decoration-muted-foreground/20 italic font-bold">V{installedVersion}</span>
                             <div className="flex h-5 items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-500 ring-1 ring-inset ring-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.15)]">
                                 <RefreshCw className="h-2.5 w-2.5 animate-spin-slow" />
                                 V{item.version}
                             </div>
                        </div>
                    ) : (
                        <div className="flex h-5 items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-success ring-1 ring-inset ring-success/20">
                            V{installedVersion}
                        </div>
                    )}
                </>
            ) : (
                <div className="flex h-5 items-center gap-1 rounded bg-muted/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground/60 ring-1 ring-inset ring-white/5">
                    V{item.version.startsWith('v') ? item.version.substring(1).toUpperCase() : item.version.toUpperCase()}
                </div>
            )}
        </div>
    );

    return (
        <div className={`
            group relative flex h-full min-h-[170px] flex-col overflow-hidden rounded-xl border transition-all duration-300
            ${item.installed 
                ? 'border-primary/50 bg-card/10 shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] ring-1 ring-primary/20' 
                : 'border-border/40 bg-card/20 hover:border-primary/30 hover:bg-card/40'}
            p-5 hover:shadow-[0_12px_50px_rgba(0,0,0,0.4)] hover:scale-[1.01] active:scale-[0.995]
        `}>
            {/* Visual glow on install */}
            {item.installed && (
                <div className="absolute -inset-px rounded-xl border border-primary/40 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none" />
            )}
            
            {/* Subtle background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10 flex flex-1 flex-col">
                <div className="flex gap-5">
                    {/* Icon Container - Ultra Premium */}
                    <div className={`
                        flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl shadow-inner transition-all duration-500
                        ${item.installed 
                            ? 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/30' 
                            : 'bg-muted/30 text-muted-foreground/50 ring-1 ring-inset ring-white/5 group-hover:bg-primary/20 group-hover:text-primary group-hover:ring-primary/40'}
                    `}>
                        <Icon className="h-10 w-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3" />
                    </div>

                    <div className="flex flex-col justify-center min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                            <h3 className="truncate text-[19px] font-black tracking-tighter text-foreground transition-colors group-hover:text-primary">
                                {item.name}
                            </h3>
                            {item.installed && (
                                <div 
                                    className="h-2.5 w-2.5 shrink-0 rounded-full bg-success shadow-[0_0_15px_rgba(34,197,94,0.8)] animate-pulse" 
                                    title={t('modelExplorer.installed')} 
                                />
                            )}
                        </div>
                        
                        <div className="mt-2 flex items-center gap-3">
                            <span className="truncate max-w-[140px] text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                                {item.author || t('marketplace.authorPrefix')}
                            </span>
                            <span className="h-1 w-1 rounded-full bg-border/40" />
                            {versionDisplay}
                        </div>
                    </div>

                    <div className="flex items-start gap-2.5 h-fit shrink-0">
                        {item.installed && !hasUpdate && onUninstall && item.removable !== false && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUninstall(item);
                                }}
                                title={t('marketplace.uninstall')}
                                className="group/btn h-10 w-10 flex items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20 hover:bg-destructive hover:text-white transition-all duration-200 active:scale-90 shadow-sm"
                            >
                                <Trash2 className="h-5 w-5 transition-transform group-hover/btn:rotate-12" />
                            </button>
                        )}

                        {hasUpdate && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onInstall(item);
                                }}
                                title={t('marketplace.update')}
                                className="group/btn h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 ring-1 ring-inset ring-amber-500/20 hover:bg-amber-500 hover:text-white transition-all duration-200 active:scale-90 shadow-sm"
                            >
                                <RefreshCw className="h-4.5 w-4.5 transition-transform group-hover/btn:rotate-180 duration-500" />
                            </button>
                        )}

                        {item.installed && !hasUpdate && (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success ring-1 ring-inset ring-success/20 shadow-sm">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                        )}

                        {!item.installed && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onInstall(item);
                                }}
                                disabled={isInstalling}
                                className={`
                                    flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 active:scale-90 shadow-sm
                                    ${isInstalling 
                                        ? 'bg-muted text-muted-foreground animate-pulse cursor-not-allowed' 
                                        : 'bg-primary/20 text-primary ring-1 ring-inset ring-primary/30 hover:bg-primary hover:text-white'}
                                `}
                            >
                                {isInstalling ? (
                                    <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                                ) : (
                                    <Download className="h-4.5 w-4.5" />
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {isInstalling && item.itemType === 'model' && (
                    <div className="my-3">
                        <ModelDownloadProgress modelId={item.id} />
                    </div>
                )}

                {/* Tags and Stats Section */}
                <div className="mt-auto pt-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {/* Performance metrics for models */}
                            {performance && (
                                <div className="flex items-center gap-3">
                                    {/* Disk Requirement */}
                                    {performance.estimatedDiskBytes > 0 && (
                                        <div className="flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity" title={t('marketplace.estimatedDisk')}>
                                            <Package className="h-3.5 w-3.5 text-blue-500/80" />
                                            <span className="text-[11px] font-black tracking-tight">{formatBytes(performance.estimatedDiskBytes)}</span>
                                        </div>
                                    )}

                                    {/* RAM Requirement */}
                                    {performance.estimatedMemoryBytes > 0 && (
                                        <div className="flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity" title={t('marketplace.estimatedRam')}>
                                            <Zap className="h-3.5 w-3.5 text-amber-500/80" />
                                            <span className="text-[11px] font-black tracking-tight">{formatBytes(performance.estimatedMemoryBytes)}</span>
                                        </div>
                                    )}

                                    {/* TPS info */}
                                    <div className="flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity" title={t('marketplace.estimatedTps')}>
                                        <RefreshCw className="h-3.5 w-3.5 text-primary/80" />
                                        <span className="text-[11px] font-black tracking-tight">{performance.estimatedTokensPerSecond.toFixed(0)} t/s</span>
                                    </div>
                                </div>
                            )}

                            {/* Downloads Count */}
                            {(item as any).downloads !== undefined && (item as any).downloads > 0 && !performance && (
                                <div className="flex items-center gap-1.5 opacity-40 group-hover:opacity-70 transition-opacity">
                                    <Download className="h-3.5 w-3.5" />
                                    <span className="text-[11px] font-black tracking-tight">{formatNumber((item as any).downloads)}</span>
                                </div>
                            )}
                        </div>

                        {/* Category Tag */}
                        <div className="flex h-6 items-center rounded-full bg-white/5 px-2.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 ring-1 ring-inset ring-white/5 transition-all group-hover:bg-primary/10 group-hover:text-primary/60 group-hover:ring-primary/20">
                            {item.itemType}
                        </div>
                    </div>

                    <p className="mt-4 line-clamp-2 text-[13px] font-medium leading-relaxed text-muted-foreground/50 transition-colors group-hover:text-muted-foreground/80">
                        {item.description}
                    </p>
                </div>

                {languageItem && item.installed && !isActive && (
                    <div className="mt-3 pt-3 border-t border-border/10 flex items-center justify-between">
                        <span className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-widest">{languageItem.nativeName}</span>
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                if (onActivateLanguage && languageItem) {
                                    onActivateLanguage(languageItem);
                                }
                            }}
                            className="rounded-lg bg-secondary/80 px-3 py-1.5 text-[11px] font-black text-secondary-foreground transition-all hover:bg-secondary active:scale-95 shadow-sm ring-1 ring-inset ring-white/5"
                        >
                            {t('common.activate')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function ModelDownloadProgress({ modelId }: { modelId: string }) {
    const { t } = useTranslation();
    const activeDownloads = useDownloadStore(s => s.activeDownloads);

    // Find the task by modelId
    const task = Object.values(activeDownloads).find(task => task.modelRef && task.modelRef.includes(modelId));

    if (!task) { return null; }

    const progressPercent = Math.floor(((task.received || 0) / (task.total || 1)) * 100);

    return (
        <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="flex items-center justify-between typo-body font-bold text-primary">
                <span>{task.status === 'paused' ? t('common.paused') : t('marketplace.installing')}</span>
                <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                <div
                    className="h-full bg-primary transition-all duration-300 shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
            <div className="flex items-center justify-between typo-body text-muted-foreground/60">
                <span>{formatBytes(task.received || 0)} / {formatBytes(task.total || 0)}</span>
                {task.speed !== undefined && <span>{formatBytes(task.speed)}/s</span>}
            </div>
        </div>
    );
}
