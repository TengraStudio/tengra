import type {
    MarketplaceItem,
    MarketplaceLanguage,
    MarketplaceModel,
    MarketplaceModelPerformanceEstimate,
    MarketplaceTheme
} from '@shared/types/marketplace';
import { compareVersions } from '@shared/utils/extension.util';
import { CheckCircle2, Download, Globe, Heart, MessageSquare, Package, Palette, Puzzle, RefreshCw, Sparkles, TriangleAlert, Zap } from 'lucide-react';
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
    onInstall,
    onActivateLanguage,
    isInstalling
}: {
    item: MarketplaceItem;
    isActive: boolean;
    onInstall: (item: MarketplaceItem) => void;
    onActivateLanguage: (item: MarketplaceLanguage) => void;
    isInstalling: boolean;
}) {
    const { t } = useTranslation();
    const themeItem = item.itemType === 'theme' ? (item as MarketplaceTheme) : null;
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

    const primaryActionLabel = isInstalling
        ? t('marketplace.installing')
        : hasUpdate
            ? t('common.update')
            : item.installed
                ? t('modelExplorer.installed')
                : t('marketplace.install');

    const performance = modelItem?.performance as MarketplaceModelPerformanceEstimate | undefined;

    return (
        <div className="group flex flex-col bg-card/60 backdrop-blur-sm border border-border/40 rounded-2xl p-6 hover:border-primary/50 hover:bg-card transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-0.5 h-full min-h-[280px] relative overflow-hidden">
            {/* Subtle glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="flex items-start justify-between gap-4 mb-4 relative z-10">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-3 rounded-lg bg-primary/5 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-all shrink-0">
                        <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 min-w-0 overflow-hidden">
                            <h3 className="text-sm font-bold text-foreground leading-none truncate group-hover:text-primary transition-colors">{item.name}</h3>
                            {item.installed && (
                                <span className="flex-shrink-0 flex items-center justify-center p-0.5 bg-success/10 text-success rounded-full" title={t('modelExplorer.installed')}>
                                    <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="typo-body text-muted-foreground/80 font-medium truncate">
                                {t('marketplace.authorBy', { author: item.author })}
                            </p>

                        </div>
                    </div>
                </div>

                <button
                    onClick={(event) => {
                        event.stopPropagation();
                        onInstall(item);
                    }}
                    disabled={isInstalling || (Boolean(item.installed) && !hasUpdate)}
                    className={`
                        flex items-center gap-2 px-3.5 py-2 rounded-lg typo-caption font-bold transition-all shrink-0
                        ${item.installed && !hasUpdate
                            ? 'bg-muted/50 text-muted-foreground cursor-default'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95'}
                    `}
                >
                    {isInstalling || hasUpdate
                        ? <RefreshCw className={`w-3.5 h-3.5 ${isInstalling ? 'animate-spin' : ''}`} />
                        : <Download className="w-3.5 h-3.5" />}
                    {primaryActionLabel}
                </button>
            </div>

            {isInstalling && item.itemType === 'model' && (
                <ModelDownloadProgress modelId={item.id} />
            )}

            <p className="text-sm text-muted-foreground/90 leading-relaxed line-clamp-3 mb-5 relative z-10">
                {item.description}
            </p>

            {item.itemType === 'extension' && hasUpdate && installedVersion && (
                <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-warning/35 bg-warning/10 px-3 py-1.5 typo-caption font-semibold text-warning">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    {`${t('common.update')}: v${installedVersion} -> v${item.version}`}
                </div>
            )}

            <div className="mt-auto space-y-3 relative z-10">
                <div className="flex flex-wrap items-center gap-2">
                    {performance && (
                        <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 typo-body font-bold text-primary">
                            {t(`marketplace.modelFit.${performance.fit}`)}
                        </div>
                    )}
                    {performance?.selectedVariant && (
                        <div className="flex items-center gap-1.5 rounded-full bg-muted/30 px-2.5 py-1 typo-body font-bold text-muted-foreground">
                            {performance.selectedVariant.name}
                        </div>
                    )}
                    {(modelItem?.downloads !== undefined && modelItem.downloads > 0) && (
                        <div className="flex items-center gap-1.5 typo-body text-muted-foreground/70 font-semibold" title={t('marketplace.downloads')}>
                            <Download className="w-3.5 h-3.5" />
                            {formatNumber(modelItem.downloads)}
                        </div>
                    )}

                    {(modelItem?.pullCount !== undefined && modelItem.pullCount > 0 && (modelItem.downloads === undefined || modelItem.provider === 'ollama')) && (
                        <div className="flex items-center gap-1.5 typo-body text-muted-foreground/70 font-semibold" title={t('marketplace.pullCount')}>
                            <Download className="w-3.5 h-3.5" />
                            {formatNumber(modelItem.pullCount)}
                        </div>
                    )}

                    {modelItem?.likes !== undefined && modelItem.likes > 0 && (
                        <div className="flex items-center gap-1.5 typo-body text-muted-foreground/70 font-semibold">
                            <Heart className="w-3.5 h-3.5 text-red-500/60" />
                            {formatNumber(modelItem.likes)}
                        </div>
                    )}

                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/10 pt-3">
                    {performance && (
                        <div className="flex items-center gap-1.5 typo-body text-muted-foreground/70 font-semibold" title={t('marketplace.performance')}>
                            <div className="flex items-center gap-1.5 mr-2">
                                <Package className="w-3.5 h-3.5 text-primary/50" />
                                <span>{modelItem?.totalSize || (performance.estimatedDiskBytes > 0 ? formatBytes(performance.estimatedDiskBytes) : '-')}</span>
                            </div>
                            <span className="text-muted-foreground/20">|</span>
                            <div className="flex items-center gap-1.5 ml-2">
                                <Zap className="w-3.5 h-3.5 text-yellow-500/50" />
                                <span>{`${performance.estimatedTokensPerSecond.toFixed(1)} ${t('marketplace.tokensPerSecond')}`}</span>
                                <span className="text-muted-foreground/40">•</span>
                                <span>{formatBytes(performance.estimatedMemoryBytes)} RAM</span>
                            </div>
                        </div>
                    )}
                    {installedVersion && (
                        <div className="flex items-center gap-1.5 typo-body font-bold">
                            <span className="text-muted-foreground/40">{item.version}</span>
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                                v{installedVersion}
                            </span>
                        </div>
                    )}

                    {themeItem?.previewColor && (
                        <div className="w-3 h-3 rounded-full border border-border/40 shadow-inner" style={{ backgroundColor: themeItem.previewColor }} />
                    )}
                </div>
            </div>

            {languageItem && item.installed && !isActive && (
                <div className="mt-3 pt-3 border-t border-border/20 flex items-center justify-between">
                    <span className="typo-caption font-semibold text-muted-foreground">{languageItem.nativeName}</span>
                    <button
                        onClick={(event) => {
                            event.stopPropagation();
                            onActivateLanguage(languageItem);
                        }}
                        className="rounded-lg bg-secondary px-3 py-1.5 typo-body font-bold text-secondary-foreground transition-all hover:bg-secondary/80 active:scale-95 shadow-sm"
                    >
                        {t('common.select')}
                    </button>
                </div>
            )}
        </div>
    );
}

function ModelDownloadProgress({ modelId }: { modelId: string }) {
    const { t } = useTranslation();
    const activeDownloads = useDownloadStore(s => s.activeDownloads);

    // Find the task by modelId (the key in store is modelRef, but we can try to find it)
    const task = Object.values(activeDownloads).find(t => t.modelRef.includes(modelId));

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
