import type { MarketplaceModelPerformanceEstimate, MarketplaceModelTag } from '@shared/types/marketplace';
import DOMPurify from 'dompurify';
import { Download, Heart, Package, X } from 'lucide-react';
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
    const totalSubmodels = item.submodels?.length || 0;
    const totalPages = Math.ceil(totalSubmodels / pageSize);
    const paginatedSubmodels = item.submodels?.slice((currentPage - 1) * pageSize, currentPage * pageSize) || [];

    return (
        <aside className="rounded-2xl border border-border/40 bg-card p-6 sticky top-6 self-start max-h-[calc(100vh-8rem)] overflow-y-auto shadow-2xl animate-in slide-in-from-right-4 duration-300 w-full lg:w-[460px]">
            <div className="flex items-center justify-between mb-4 border-b border-border/10 pb-3">
                <p className="typo-body font-bold uppercase tracking-widest text-muted-foreground/50">{t('common.info')}</p>
                <button
                    onClick={onClose}
                    className="p-1 px-2 rounded-lg hover:bg-muted/50 text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <h3 className="text-base font-bold text-foreground leading-tight">{item.name}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground/90 font-medium">{item.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                        <div className="flex flex-col">
                            <span className="typo-body font-bold text-muted-foreground/40 uppercase tracking-tight">{t('common.type')}</span>
                            <span className="typo-body font-bold text-foreground/80">{item.itemType}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="typo-body font-bold text-muted-foreground/40 uppercase tracking-tight">{t('marketplace.author')}</span>
                            <span className="typo-body font-bold text-foreground/80">{item.author}</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex flex-col">
                            <span className="typo-body font-bold text-muted-foreground/40 uppercase tracking-tight">{t('mcp.version')}</span>
                            <span className="typo-body font-bold text-foreground/80">{item.version}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-2">
                            {item.downloads !== undefined && item.downloads > 0 && (
                                <div className="flex items-center gap-1.5 typo-body text-muted-foreground/70 font-semibold" title={t('marketplace.downloads')}>
                                    <Download className="w-3.5 h-3.5" />
                                    {formatNumber(item.downloads)}
                                </div>
                            )}
                            {item.pullCount !== undefined && item.pullCount > 0 && (
                                <div className="flex items-center gap-1.5 typo-body text-muted-foreground/70 font-semibold" title={t('marketplace.pullCount')}>
                                    <Download className="w-3.5 h-3.5" />
                                    {formatNumber(item.pullCount)}
                                </div>
                            )}
                            {item.likes !== undefined && item.likes > 0 && (
                                <div className="flex items-center gap-1.5 typo-body text-muted-foreground/70 font-semibold" title="Likes">
                                    <Heart className="w-3.5 h-3.5 text-red-500/60" />
                                    {formatNumber(item.likes)}
                                </div>
                            )}
                            {item.totalSize && (
                                <div className="flex items-center gap-1.5 typo-body text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md" title={t('modelExplorer.diskRam')}>
                                    <Package className="w-3.5 h-3.5" />
                                    {item.totalSize}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {item.performance && (
                    <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="typo-body font-bold uppercase tracking-tight text-muted-foreground/40">
                                {t('marketplace.performance')}
                            </span>
                            <span className="rounded-full bg-background/80 px-2 py-0.5 typo-body font-bold uppercase text-primary">
                                {t(`marketplace.modelFit.${item.performance.fit}`)}
                            </span>
                        </div>
                        {item.performance.selectedVariant && (
                            <div className="rounded-xl bg-background/70 px-3 py-2 text-xs font-bold text-foreground">
                                {item.performance.selectedVariant.name}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="rounded-xl bg-background/70 px-3 py-2">
                                <div className="typo-body uppercase text-muted-foreground/50 font-bold">{t('marketplace.tokensPerSecond')}</div>
                                <div className="font-bold text-foreground">{item.performance.estimatedTokensPerSecond.toFixed(1)}</div>
                            </div>
                            <div className="rounded-xl bg-background/70 px-3 py-2">
                                <div className="typo-body uppercase text-muted-foreground/50 font-bold">{t('marketplace.ram')}</div>
                                <div className="font-bold text-foreground">{formatBytes(item.performance.estimatedMemoryBytes)}</div>
                            </div>
                            <div className="rounded-xl bg-background/70 px-3 py-2">
                                <div className="typo-body uppercase text-muted-foreground/50 font-bold">{t('marketplace.vram')}</div>
                                <div className="font-bold text-foreground">{item.performance.estimatedVramBytes ? formatBytes(item.performance.estimatedVramBytes) : '-'}</div>
                            </div>
                            <div className="rounded-xl bg-background/70 px-3 py-2">
                                <div className="typo-body uppercase text-muted-foreground/50 font-bold">{t('marketplace.disk')}</div>
                                <div className="font-bold text-foreground">{formatBytes(item.performance.estimatedDiskBytes)}</div>
                            </div>
                        </div>
                    </div>
                )}

                {item.provider && (
                    <div className="bg-muted/10 p-2 rounded-lg border border-border/10">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="typo-body font-bold text-muted-foreground/40 uppercase">{t('modelExplorer.provider')}</span>
                                <span className="typo-body font-bold text-primary uppercase">{item.provider}</span>
                            </div>
                            {item.provider === 'ollama' && !item.installed && onInstall && (
                                <button
                                    onClick={() => onInstall()}
                                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center gap-2 typo-body font-bold shadow-sm"
                                >
                                    <Download className="w-3 h-3" />
                                    {t('marketplace.install')}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {item.readme && (
                    <div className="mt-6 border-t border-border/20 pt-6 prose prose-invert prose-sm max-w-full overflow-hidden text-xs leading-relaxed">
                        <p className="mb-4 font-bold uppercase tracking-widest text-muted-foreground/30 typo-body">{t('common.info')} (README)</p>
                        <div className="text-muted-foreground/90 readme-content bg-muted/5 p-4 rounded-xl border border-border/5">
                            {((item.provider === 'ollama' || item.provider === 'huggingface') && (item.readme.includes('<h2') || item.readme.includes('<li>') || item.readme.includes('<p>') || item.readme.includes('<h1>'))) ? (
                                <div
                                    className={`${item.provider}-readme rich-text overflow-hidden`}
                                    dangerouslySetInnerHTML={{ __html: sanitizedReadme }}
                                />
                            ) : (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        h1: ({ ...props }) => <h1 className="text-sm font-bold mt-4 mb-2 first:mt-0" {...props} />,
                                        h2: ({ ...props }) => <h2 className="text-xs font-bold mt-4 mb-2 first:mt-0" {...props} />,
                                        p: ({ ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                                        ul: ({ ...props }) => <ul className="list-disc ml-4 mb-3" {...props} />,
                                        li: ({ ...props }) => <li className="mb-1" {...props} />,
                                        code: ({ ...props }) => <code className="bg-muted/40 px-1 py-0.5 rounded font-mono typo-body" {...props} />,
                                        pre: ({ ...props }) => <pre className="bg-background/50 p-2 rounded-lg border border-border/20 overflow-x-auto mb-3" {...props} />,
                                    }}
                                >
                                    {item.readme}
                                </ReactMarkdown>
                            )}
                        </div>
                    </div>
                )}
                {item.isReadmeLoading && !item.readme && (
                    <div className="mt-6 border-t border-border/20 pt-6">
                        <p className="text-xs text-muted-foreground/70 font-medium">{t('marketplace.syncing')}</p>
                    </div>
                )}

                {item.provider === 'ollama' && paginatedSubmodels.length > 0 && (
                    <div className="mt-6 border-t border-border/20 pt-6">
                        <div className="flex items-center justify-between mb-3">
                            <p className="font-bold uppercase tracking-widest text-muted-foreground/30 typo-body">
                                {t('mcp.version')}s ({totalSubmodels})
                            </p>
                            {totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => prev - 1)}
                                        className="typo-body font-bold text-primary disabled:text-muted-foreground hover:underline"
                                    >
                                        Prev
                                    </button>
                                    <span className="typo-body text-muted-foreground font-mono">{currentPage}/{totalPages}</span>
                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => prev + 1)}
                                        className="typo-body font-bold text-primary disabled:text-muted-foreground hover:underline"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {paginatedSubmodels.map(tag => (
                                <div key={tag.id} className="flex flex-col gap-1 bg-muted/10 px-3 py-2 rounded-lg border border-border/5 hover:border-primary/20 transition-all hover:bg-muted/20 relative group/tag">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 truncate">
                                            <span className="font-bold text-foreground/70 typo-body truncate">{tag.name}</span>
                                            {tag.installed && (
                                                <span className="typo-body bg-green-500/10 text-green-500 px-1 rounded font-bold uppercase tracking-tighter">Installed</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-muted-foreground/60 font-mono bg-background/50 px-1.5 py-0.5 rounded typo-body border border-border/10 leading-none">{tag.size || tag.contextWindow}</span>
                                            {item.provider === 'ollama' && !tag.installed && onInstall && (
                                                <button
                                                    onClick={() => onInstall({
                                                        id: tag.id,
                                                        name: `${item.name} (${tag.name})`,
                                                        downloadUrl: tag.downloadUrl // If available
                                                    })}
                                                    className="p-1 rounded-md hover:bg-primary/20 text-primary transition-colors"
                                                    title={t('marketplace.install')}
                                                >
                                                    <Download className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {(tag.modelSize || tag.tensorType) && (
                                        <div className="flex gap-2 typo-body text-muted-foreground/40 font-bold uppercase tracking-tighter">
                                            {tag.modelSize && <span>{tag.modelSize} Params</span>}
                                            {tag.tensorType && <span>{tag.tensorType}</span>}
                                        </div>
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
