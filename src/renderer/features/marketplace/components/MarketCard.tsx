/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type {
    MarketplaceItem,
    MarketplaceLanguage
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
    SwatchBook,
    Trash2,
    Zap,
} from 'lucide-react';
import type { ElementType } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { useDownloadStore } from '@/store/download.store';

/* Batch-02: Extracted Long Classes */
const C_MARKETCARD_1 = "flex h-5 items-center gap-1 rounded bg-warning/10 px-2 py-0.5 text-xxxs font-black uppercase tracking-wider text-warning ring-1 ring-inset ring-warning/20 shadow-glow-amber";
const C_MARKETCARD_2 = "flex h-5 items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-xxxs font-black uppercase tracking-wider text-success ring-1 ring-inset ring-success/20";
const C_MARKETCARD_3 = "flex h-5 items-center gap-1 rounded bg-muted/40 px-2 py-0.5 text-xxxs font-black uppercase tracking-wider text-muted-foreground/60 ring-1 ring-inset ring-border/20";
const C_MARKETCARD_4 = "h-8 px-2 flex items-center gap-1.5 rounded-md text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all active:scale-95 text-xxxs font-bold uppercase tracking-wider";
const C_MARKETCARD_5 = "h-8 px-3 flex items-center gap-2 rounded-md bg-warning/10 text-warning hover:bg-warning hover:text-warning-foreground transition-all active:scale-95 text-xxxs font-bold uppercase tracking-wider";
const C_MARKETCARD_6 = "bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground px-3 py-1 rounded text-xxxs font-black uppercase tracking-widest transition-all active:scale-95";



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
    onActivateIconPack,
}: {
    item: MarketplaceItem;
    isActive: boolean;
    isInstalling: boolean;
    onInstall: (item: MarketplaceItem) => void;
    onUninstall?: (item: MarketplaceItem) => void;
    onActivateLanguage?: (item: MarketplaceLanguage) => void;
    onActivateIconPack?: (item: MarketplaceItem) => void;
}) {
    const { t } = useTranslation();
    const languageItem = item.itemType === 'language' ? (item as MarketplaceLanguage) : null;
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
        'icon-pack': SwatchBook,
    } as Record<string, ElementType>)[item.itemType] || Package);

    const versionDisplay = (
        <div className="flex items-center gap-1.5 font-black select-none">
            {installedVersion ? (
                <>
                    {compareVersions(item.version, installedVersion) > 0 ? (
                        <div className="flex items-center gap-1.5">
                             <span className="text-xxxs text-muted-foreground/30 line-through decoration-muted-foreground/20 italic font-bold">V{installedVersion}</span>
                             <div className={C_MARKETCARD_1}>
                                 <RefreshCw className="h-2.5 w-2.5 animate-spin-slow" />
                                 V{item.version}
                             </div>
                        </div>
                    ) : (
                        <div className={C_MARKETCARD_2}>
                            V{installedVersion}
                        </div>
                    )}
                </>
            ) : (
                <div className={C_MARKETCARD_3}>
                    V{item.version.startsWith('v') ? item.version.substring(1).toUpperCase() : item.version.toUpperCase()}
                </div>
            )}
        </div>
    );

    return (
        <div className={cn(
            'group relative flex items-start gap-4 p-4 transition-colors duration-200',
            item.installed ? 'bg-primary/[0.03]' : 'bg-transparent hover:bg-muted/30'
        )}>
            {/* Visual indicator for installed */}
            {item.installed && (
                <div className="absolute left-0 top-4 bottom-4 w-0.5 bg-primary rounded-r-full" />
            )}

            {/* Icon - Smaller and more integrated */}
            <div className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-transform',
                item.installed
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted/50 text-muted-foreground group-hover:scale-105'
            )}>
                <Icon className="h-6 w-6" />
            </div>

            <div className="flex flex-1 flex-col min-w-0 py-0.5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <h3 className="truncate text-base font-semibold text-foreground/90">
                            {item.name}
                        </h3>
                        {item.installed && (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success opacity-80" />
                        )}
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                        {item.installed && !hasUpdate && onUninstall && item.removable !== false && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUninstall(item);
                                }}
                                className={C_MARKETCARD_4}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                {t('marketplace.uninstall')}
                            </button>
                        )}

                        {hasUpdate && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onInstall(item);
                                }}
                                className={C_MARKETCARD_5}
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                {t('marketplace.update')}
                            </button>
                        )}

                        {!item.installed && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onInstall(item);
                                }}
                                disabled={isInstalling}
                                className={cn(
                                    'h-8 px-4 flex items-center gap-2 rounded-md transition-all active:scale-95 text-xxxs font-bold uppercase tracking-wider',
                                    isInstalling
                                        ? 'bg-muted text-muted-foreground animate-pulse'
                                        : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'
                                )}
                            >
                                {isInstalling ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Download className="h-3.5 w-3.5" />
                                )}
                                {t('marketplace.install')}
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-1 flex items-center gap-2 text-xxs font-medium text-muted-foreground/60">
                    <span className="truncate">{item.author || t('marketplace.authorPrefix')}</span>
                    <span className="opacity-30">•</span>
                    {versionDisplay}
                    <span className="opacity-30">•</span>
                    <span className="uppercase tracking-widest text-xxxs font-black">{item.itemType}</span>
                </div>

                <p className="mt-2 line-clamp-1 text-sm text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors">
                    {item.description}
                </p>

                {isInstalling && item.itemType === 'model' && (
                    <div className="mt-4">
                        <ModelDownloadProgress modelId={item.id} />
                    </div>
                )}

                {languageItem && item.installed && !isActive && (
                    <div className="mt-3 flex items-center justify-between">
                        <span className="text-xxxs font-black text-muted-foreground/30 uppercase tracking-widest">{languageItem.nativeName}</span>
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                if (onActivateLanguage && languageItem) {
                                    onActivateLanguage(languageItem);
                                }
                            }}
                            className={C_MARKETCARD_6}
                        >
                            {t('common.activate')}
                        </button>
                    </div>
                )}

                {item.itemType === 'icon-pack' && item.installed && !isActive && (
                    <div className="mt-3 flex items-center justify-end">
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                onActivateIconPack?.(item);
                            }}
                            className={C_MARKETCARD_6}
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
    const task = Object.values(activeDownloads).find(task => task.modelRef?.includes(modelId));

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
                    className="h-full bg-primary transition-all duration-300 shadow-glow-primary"
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
