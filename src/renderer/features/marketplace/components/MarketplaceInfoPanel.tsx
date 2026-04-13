import type { MarketplaceModelPerformanceEstimate, MarketplaceModelTag } from '@shared/types/marketplace';
import { compareVersions } from '@shared/utils/extension.util';
import DOMPurify from 'dompurify';
import { Download, TriangleAlert, X } from 'lucide-react';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
        setCurrentPage(1);
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
        <aside className="sticky top-6 self-start max-h-[calc(100vh-8rem)] overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-500 w-full lg:w-[480px] px-8">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">{t('common.info')}</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 rounded-full hover:bg-muted text-muted-foreground/40 hover:text-foreground transition-all active:scale-90"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="space-y-10">
                <div className="space-y-3">
                    <h3 className="text-3xl font-black tracking-tighter text-foreground/90 leading-none">{item.name}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground/60 font-medium max-w-[90%]">{item.description}</p>
                </div>

                {hasUpdate && item.installedVersion && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-amber-500">
                        <TriangleAlert className="h-3.5 w-3.5" />
                        {`${t('common.update')}: v${item.installedVersion} → v${item.version}`}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                    <div className="space-y-1">
                        <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">{t('common.type')}</span>
                        <p className="text-xs font-bold text-foreground/70 uppercase tracking-widest">{item.itemType}</p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">{t('mcp.version')}</span>
                        <p className="text-xs font-bold text-foreground/70">{item.version}</p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">{t('marketplace.author')}</span>
                        <p className="text-xs font-bold text-foreground/70">{item.author}</p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">{t('marketplace.downloads')}</span>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground/70">
                            <Download className="w-3.5 h-3.5 opacity-40" />
                            {formatNumber(item.downloads || item.pullCount || 0)}
                        </div>
                    </div>
                </div>

                {item.performance && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">{t('marketplace.performance')}</span>
                            <div className="h-[1px] flex-1 bg-muted/20" />
                            <span className="text-[9px] font-black text-primary uppercase tracking-wider">
                                {t(`marketplace.modelFit.${item.performance.fit}`)}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted/20 rounded-xl p-4 transition-colors hover:bg-muted/30">
                                <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">{t('marketplace.tokensPerSecond')}</span>
                                <p className="text-lg font-black text-foreground/80 mt-1">{item.performance.estimatedTokensPerSecond.toFixed(1)} <span className="text-[10px] text-muted-foreground/40">t/s</span></p>
                            </div>
                            <div className="bg-muted/20 rounded-xl p-4 transition-colors hover:bg-muted/30">
                                <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">{t('marketplace.ram')}</span>
                                <p className="text-lg font-black text-foreground/80 mt-1">{formatBytes(item.performance.estimatedMemoryBytes)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {item.readme && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">Documentation</span>
                            <div className="h-[1px] flex-1 bg-muted/20" />
                        </div>
                        <div className="prose prose-invert prose-sm max-w-full text-muted-foreground/60 leading-relaxed font-medium">
                            {((item.provider === 'ollama' || item.provider === 'huggingface') && (item.readme.includes('<h2') || item.readme.includes('<li>') || item.readme.includes('<p>') || item.readme.includes('<h1>'))) ? (
                                <div
                                    className={`${item.provider}-readme rich-text`}
                                    dangerouslySetInnerHTML={{ __html: sanitizedReadme }}
                                />
                            ) : (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        h1: ({ ...props }) => <h1 className="text-base font-black mt-8 mb-4 text-foreground/80 first:mt-0 tracking-tight" {...props} />,
                                        h2: ({ ...props }) => <h2 className="text-sm font-black mt-6 mb-3 text-foreground/70 first:mt-0 tracking-tight" {...props} />,
                                        p: ({ ...props }) => <p className="mb-4 last:mb-0" {...props} />,
                                        ul: ({ ...props }) => <ul className="list-disc ml-4 mb-4 space-y-1" {...props} />,
                                        li: ({ ...props }) => <li className="pl-1" {...props} />,
                                        code: ({ ...props }) => <code className="bg-muted/50 px-1.5 py-0.5 rounded-md font-mono text-xs text-primary/80" {...props} />,
                                        pre: ({ ...props }) => <pre className="bg-muted/20 p-4 rounded-xl overflow-x-auto mb-4 scrollbar-hide" {...props} />,
                                    }}
                                >
                                    {item.readme}
                                </ReactMarkdown>
                            )}
                        </div>
                    </div>
                )}

                {item.isReadmeLoading && !item.readme && (
                    <div className="mt-8 pt-8 border-t border-muted/10">
                        <div className="flex items-center gap-3 text-muted-foreground/30 animate-pulse">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('marketplace.syncing')}</span>
                            <div className="h-[1px] flex-1 bg-muted/20" />
                        </div>
                    </div>
                )}

                {item.provider === 'ollama' && paginatedSubmodels.length > 0 && (
                    <div className="mt-10 pt-10 border-t border-muted/10 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">{t('mcp.version')}s</span>
                                <span className="text-[9px] font-black text-muted-foreground/20">({totalSubmodels})</span>
                            </div>
                            {totalPages > 1 && (
                                <div className="flex items-center gap-3">
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => prev - 1)}
                                        className="text-[10px] font-black uppercase tracking-widest text-primary disabled:opacity-20 transition-opacity"
                                    >
                                        Prev
                                    </button>
                                    <span className="text-[10px] font-black text-muted-foreground/20">{currentPage} / {totalPages}</span>
                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => prev + 1)}
                                        className="text-[10px] font-black uppercase tracking-widest text-primary disabled:opacity-20 transition-opacity"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="space-y-3">
                            {paginatedSubmodels.map(tag => (
                                <div 
                                    key={tag.id} 
                                    className="group/tag relative flex items-center justify-between p-4 rounded-xl bg-muted/20 hover:bg-muted/30 transition-all"
                                >
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-foreground/80 truncate">{tag.name}</span>
                                            {tag.installed && (
                                                <div className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                            )}
                                        </div>
                                        <div className="flex gap-3 text-[9px] font-black text-muted-foreground/40 uppercase tracking-tighter">
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
                                            className="opacity-0 group-hover/tag:opacity-100 p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
                                        >
                                            <Download className="w-4 h-4" />
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
