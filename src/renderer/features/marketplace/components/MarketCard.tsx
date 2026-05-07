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
import { IconBolt, IconCircleCheck, IconColorSwatch, IconDownload, IconGlobe, IconMessage, IconPackage, IconPalette, IconPuzzle, IconRefresh, IconSparkles, IconTrash } from '@tabler/icons-react';
import type { ElementType } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { useDownloadStore } from '@/store/download.store';

/* Batch-02: Extracted Long Classes */
const C_MARKETCARD_1 = "flex h-5 items-center gap-1 rounded-md bg-warning/5 px-2 py-0.5 text-sm font-bold  text-warning border border-warning/10";
const C_MARKETCARD_2 = "flex h-5 items-center gap-1 rounded-md bg-success/5 px-2 py-0.5 text-sm font-bold  text-success border border-success/10";
const C_MARKETCARD_3 = "flex h-5 items-center gap-1 rounded-md bg-muted/40 px-2 py-0.5 text-sm font-bold  text-muted-foreground/40 border border-border/10";
const C_MARKETCARD_4 = "h-8 px-3 flex items-center gap-2 rounded-lg text-destructive/40 hover:text-destructive hover:bg-destructive/5 transition-colors text-sm font-semibold";
const C_MARKETCARD_5 = "h-8 px-3 flex items-center gap-2 rounded-lg bg-warning/10 text-warning hover:bg-warning hover:text-warning-foreground transition-colors text-sm font-semibold";
const C_MARKETCARD_6 = "bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors";

const formatBytes = (bytes: number): string => {
    if (bytes <= 0) {
        return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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
        theme: IconPalette,
        mcp: IconPackage,
        model: IconBolt,
        prompt: IconMessage,
        language: IconGlobe,
        skill: IconSparkles,
        extension: IconPuzzle,
        'icon-pack': IconColorSwatch,
    } as Record<string, ElementType>)[item.itemType] || IconPackage);

    const hideVersion = ['theme', 'skill', 'prompt', 'language', 'icon-pack'].includes(item.itemType);

    const versionDisplay = (
        <div className="flex items-center gap-1.5 font-medium select-none">
            {installedVersion ? (
                <>
                    {compareVersions(item.version, installedVersion) > 0 ? (
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm text-muted-foreground/20 line-through font-medium">V{installedVersion}</span>
                            <div className={C_MARKETCARD_1}>
                                <IconRefresh className="h-2.5 w-2.5 animate-spin-slow" />
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
                    V{item.version.startsWith('v') ? item.version.substring(1) : item.version}
                </div>
            )}
        </div>
    );

    return (
        <div className={cn(
            'group relative flex items-start gap-4 p-5 transition-all duration-200 border border-transparent rounded-2xl h-full',
            item.installed ? 'bg-primary/[0.02] border-primary/10' : 'bg-transparent hover:bg-muted/30 hover:border-border/30'
        )}>
            {/* Icon Container */}
            <div className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all',
                item.installed
                    ? 'bg-primary/10 text-primary shadow-inner'
                    : 'bg-muted/40 text-muted-foreground/40 group-hover:bg-muted/60 group-hover:text-muted-foreground'
            )}>
                <Icon className="h-6 w-6" />
            </div>

            <div className="flex flex-1 flex-col min-w-0 py-0.5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <h3 className="truncate text-base font-semibold text-foreground ">
                            {item.name}
                        </h3>
                        {item.installed && (
                            <IconCircleCheck className="h-3.5 w-3.5 shrink-0 text-primary/60" />
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
                                <IconTrash className="h-3.5 w-3.5" />
                                {t('frontend.marketplace.uninstall')}
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
                                <IconRefresh className="h-3.5 w-3.5" />
                                {t('frontend.marketplace.update')}
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
                                    'h-8 px-4 flex items-center gap-2 rounded-lg transition-all text-sm font-semibold',
                                    isInstalling
                                        ? 'bg-muted/60 text-muted-foreground/40'
                                        : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                                )}
                            >
                                {isInstalling ? (
                                    <IconRefresh className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <IconDownload className="h-3.5 w-3.5" />
                                )}
                                {isInstalling ? t('frontend.marketplace.installing') : t('frontend.marketplace.install')}
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-1.5 flex items-center gap-2 text-sm font-medium text-muted-foreground/40">
                    <span className="truncate">{item.author || t('frontend.marketplace.authorPrefix')}</span>
                    {!hideVersion && (
                        <>
                            <span className="opacity-20">•</span>
                            {versionDisplay}
                        </>
                    )}
                    <span className="opacity-20">•</span>
                    <span className=" uppercase opacity-80 text-sm">{item.itemType}</span>
                </div>

                <p className="mt-3 line-clamp-1 text-sm text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors">
                    {item.description}
                </p>

                {isInstalling && item.itemType === 'model' && (
                    <div className="mt-4">
                        <ModelDownloadProgress modelId={item.id} />
                    </div>
                )}

                {languageItem && item.installed && !isActive && (
                    <div className="mt-4 flex items-center justify-between border-t border-border/10 pt-4">
                        <span className="text-sm font-bold text-muted-foreground/30 uppercase ">{languageItem.nativeName}</span>
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
                    <div className="mt-4 flex items-center justify-end border-t border-border/10 pt-4">
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
        <div className="mt-2 space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="flex items-center justify-between text-sm font-semibold text-primary">
                <span>{task.status === 'paused' ? t('common.paused') : t('frontend.marketplace.installing')}</span>
                <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
            <div className="flex items-center justify-between text-sm font-medium text-muted-foreground/40">
                <span>{formatBytes(task.received || 0)} / {formatBytes(task.total || 0)}</span>
                {task.speed !== undefined && <span className="text-primary/60">{formatBytes(task.speed)}/s</span>}
            </div>
        </div>
    );
}

