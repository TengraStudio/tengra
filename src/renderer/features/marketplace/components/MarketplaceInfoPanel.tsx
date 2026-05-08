/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { MarketplaceModelPerformanceEstimate, MarketplaceModelTag } from '@shared/types/marketplace';
import { compareVersions } from '@shared/utils/extension.util';
import { IconAlertTriangle, IconDownload, IconX } from '@tabler/icons-react';
import DOMPurify from 'dompurify';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_MARKETPLACEINFOPANEL_1 = "sticky top-6 self-start max-h-[calc(100vh-32px)] overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-500 w-full lg:w-[480px] px-8 custom-scrollbar";
const C_MARKETPLACEINFOPANEL_2 = "inline-flex items-center gap-2 rounded-lg bg-warning/5 px-4 py-2 text-sm font-bold  text-warning border border-warning/10 uppercase";
const C_MARKETPLACEINFOPANEL_3 = "opacity-0 group-hover/tag:opacity-100 p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all active:scale-95";


export type MarketplaceInfoItem = {
    id: string;
    name: string;
    description: string;
    author: string;
    version: string;
    installed: boolean;
    installedVersion?: string;
    itemType: string;
    provider?: string;
    sourceLabel?: string;
    nativeName?: string;
    extraDescription?: string;
    readme?: string;
    downloads?: number;
    pullCount?: number;
    likes?: number;
    submodels?: MarketplaceModelTag[];
    performance?: MarketplaceModelPerformanceEstimate;
    totalSize?: string;
    downloadUrl?: string; // Add downloadUrl to the item type
    isReadmeLoading?: boolean;
};

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
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export function MarketplaceInfoPanel({
    item,
    t,
    onClose,
    onInstall,
}: {
    item: MarketplaceInfoItem | null;
    t: (key: string, options?: Record<string, string | number>) => string;
    onClose: () => void;
    onInstall?: (override?: Partial<MarketplaceInfoItem>) => void;
}) {
    const [currentPage, setCurrentPage] = React.useState(1);
    const pageSize = 10;

    React.useEffect(() => {
        const timer = window.setTimeout(() => {
            setCurrentPage(1);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [item?.id]);

    if (!item) {
        return null;
    }

    const sanitizedReadme = item.readme ? DOMPurify.sanitize(item.readme) : '';
    const hasUpdate = Boolean(
        item.installed
        && item.installedVersion
        && compareVersions(item.version, item.installedVersion) > 0
    );
    const totalSubmodels = item.submodels?.length || 0;
    const totalPages = Math.ceil(totalSubmodels / pageSize);
    const paginatedSubmodels = item.submodels?.slice((currentPage - 1) * pageSize, currentPage * pageSize) || [];

    return (
        <aside className={C_MARKETPLACEINFOPANEL_1}>
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <p className="text-sm font-bold  uppercase text-muted-foreground/30">{t('common.info')}</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-xl hover:bg-muted text-muted-foreground/40 hover:text-foreground transition-all"
                >
                    <IconX className="w-4 h-4" />
                </button>
            </div>

            <div className="space-y-10">
                <div className="space-y-4">
                    <h3 className="text-3xl font-semibold text-foreground  leading-tight">{item.name}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground/60 font-medium">{item.description}</p>
                </div>

                {hasUpdate && item.installedVersion && (
                    <div className={C_MARKETPLACEINFOPANEL_2}>
                        <IconAlertTriangle className="h-3.5 w-3.5" />
                        {`${t('common.update')}: v${item.installedVersion} → v${item.version}`}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-x-12 gap-y-8 border-y border-border/10 py-10">
                    <div className="space-y-2">
                        <span className="text-sm font-bold text-muted-foreground/20 uppercase ">{t('common.type')}</span>
                        <p className="text-sm font-semibold text-foreground/70 uppercase ">{item.itemType}</p>
                    </div>
                    <div className="space-y-2">
                        <span className="text-sm font-bold text-muted-foreground/20 uppercase ">{t('frontend.mcp.version')}</span>
                        <p className="text-sm font-semibold text-foreground/70">{item.version}</p>
                    </div>
                    <div className="space-y-2">
                        <span className="text-sm font-bold text-muted-foreground/20 uppercase ">{t('frontend.marketplace.author')}</span>
                        <p className="text-sm font-semibold text-foreground/70">{item.author}</p>
                    </div>
                    <div className="space-y-2">
                        <span className="text-sm font-bold text-muted-foreground/20 uppercase ">{t('frontend.marketplace.downloads')}</span>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground/70">
                            <IconDownload className="w-3.5 h-3.5 opacity-40" />
                            {formatNumber(item.downloads || item.pullCount || 0)}
                        </div>
                    </div>
                </div>

                {item.performance && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-muted-foreground/20 uppercase ">{t('frontend.marketplace.performance')}</span>
                            <div className="h-px flex-1 bg-border/5" />
                            <span className="text-sm font-bold text-primary uppercase ">
                                {t(`marketplace.modelFit.${item.performance.fit}`)}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted/30 rounded-2xl p-5 border border-border/5">
                                <span className="text-sm font-bold text-muted-foreground/30 uppercase ">{t('frontend.marketplace.tokensPerSecond')}</span>
                                <p className="text-xl font-semibold text-foreground/80 mt-2">{item.performance.estimatedTokensPerSecond.toFixed(1)} <span className="text-sm text-muted-foreground/30 font-medium">t/s</span></p>
                            </div>
                            <div className="bg-muted/30 rounded-2xl p-5 border border-border/5">
                                <span className="text-sm font-bold text-muted-foreground/30 uppercase ">{t('frontend.marketplace.ram')}</span>
                                <p className="text-xl font-semibold text-foreground/80 mt-2">{formatBytes(item.performance.estimatedMemoryBytes)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {item.readme && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-muted-foreground/20 uppercase ">Documentation</span>
                            <div className="h-px flex-1 bg-border/5" />
                        </div>
                        <div className="prose prose-invert prose-sm max-w-full text-muted-foreground/70 leading-relaxed">
                            {((item.provider === 'ollama' || item.provider === 'huggingface') && (item.readme.includes('<h2') || item.readme.includes('<li>') || item.readme.includes('<p>') || item.readme.includes('<h1>'))) ? (
                                <div
                                    className={cn(`${item.provider}-readme`, 'rich-text')}
                                    dangerouslySetInnerHTML={{ __html: sanitizedReadme }}
                                />
                            ) : (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        h1: ({ ...props }) => <h1 className="text-lg font-semibold mt-10 mb-5 text-foreground first:mt-0 " {...props} />,
                                        h2: ({ ...props }) => <h2 className="text-base font-semibold mt-8 mb-4 text-foreground/80 first:mt-0 " {...props} />,
                                        p: ({ ...props }) => <p className="mb-5 last:mb-0" {...props} />,
                                        ul: ({ ...props }) => <ul className="list-disc ml-4 mb-5 space-y-2" {...props} />,
                                        li: ({ ...props }) => <li className="pl-1" {...props} />,
                                        code: ({ ...props }) => <code className="bg-muted/50 px-1.5 py-0.5 rounded-md font-mono text-sm text-primary/90" {...props} />,
                                        pre: ({ ...props }) => <pre className="bg-muted/30 p-5 rounded-2xl border border-border/5 overflow-x-auto mb-6 scrollbar-hide" {...props} />,
                                    }}
                                >
                                    {item.readme}
                                </ReactMarkdown>
                            )}
                        </div>
                    </div>
                )}

                {item.isReadmeLoading && !item.readme && (
                    <div className="mt-8 pt-8 border-t border-border/5">
                        <div className="flex items-center gap-3 text-muted-foreground/20 animate-pulse">
                            <span className="text-sm font-bold uppercase ">{t('frontend.marketplace.syncing')}</span>
                            <div className="h-px flex-1 bg-border/5" />
                        </div>
                    </div>
                )}

                {item.provider === 'ollama' && paginatedSubmodels.length > 0 && (
                    <div className="mt-12 pt-12 border-t border-border/10 space-y-8 pb-10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-muted-foreground/20 uppercase ">{t('frontend.mcp.version')}s</span>
                                <span className="text-sm font-bold text-muted-foreground/10">({totalSubmodels})</span>
                            </div>
                            {totalPages > 1 && (
                                <div className="flex items-center gap-4">
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => prev - 1)}
                                        className="text-sm font-bold uppercase  text-primary disabled:opacity-20 transition-opacity"
                                    >
                                        Prev
                                    </button>
                                    <span className="text-sm font-bold text-muted-foreground/20">{currentPage} / {totalPages}</span>
                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => prev + 1)}
                                        className="text-sm font-bold uppercase  text-primary disabled:opacity-20 transition-opacity"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="space-y-4">
                            {paginatedSubmodels.map(tag => (
                                <div
                                    key={tag.id}
                                    className="group/tag relative flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent hover:bg-muted/30 hover:border-border/5 transition-all"
                                >
                                    <div className="space-y-1.5 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-foreground/80 truncate">{tag.name}</span>
                                            {tag.installed && (
                                                <div className="h-1 w-1 rounded-full bg-primary" />
                                            )}
                                        </div>
                                        <div className="flex gap-4 text-sm font-bold text-muted-foreground/30 uppercase ">
                                            {tag.modelSize && <span>{tag.modelSize} Params</span>}
                                            {tag.tensorType && <span>{tag.tensorType}</span>}
                                            <span>{tag.size || tag.contextWindow}</span>
                                        </div>
                                    </div>

                                    {!tag.installed && item.provider === 'ollama' && onInstall && (
                                        <button
                                            onClick={() => onInstall({
                                                id: tag.id,
                                                name: `${item.name} (${tag.name})`,
                                                downloadUrl: tag.downloadUrl
                                            })}
                                            className={C_MARKETPLACEINFOPANEL_3}
                                        >
                                            <IconDownload className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}

