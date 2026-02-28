import { Calendar, Download, ExternalLink, FolderOpen, Image, Info, LucideIcon, Minus, Plus, RefreshCw, Search, Sparkles, Trash2, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { appLogger } from '@/utils/renderer-logger';

interface GalleryItemMetadata {
    prompt?: string;
    negative_prompt?: string;
    seed?: number;
    steps?: number;
    cfg_scale?: number;
    width?: number;
    height?: number;
    model?: string;
    created_at?: number;
}

interface GalleryItem {
    name: string;
    path: string;
    url: string;
    mtime: number;
    type?: 'image' | 'video';
    metadata?: GalleryItemMetadata;
}

interface GalleryViewProps {
    language: Language;
}

type GalleryAnalyticsEvent =
    | 'preview_opened'
    | 'preview_closed'
    | 'zoom_in'
    | 'zoom_out'
    | 'zoom_reset'
    | 'image_deleted'
    | 'image_opened'
    | 'image_revealed'
    | 'batch_download_started'
    | 'batch_download_completed'
    | 'search_query_used';

interface GalleryAnalyticsPayloadMap {
    preview_opened: { imagePath: string };
    preview_closed: { imagePath: string };
    zoom_in: { zoom: number };
    zoom_out: { zoom: number };
    zoom_reset: { imagePath: string | null };
    image_deleted: { imagePath: string };
    image_opened: { imagePath: string };
    image_revealed: { imagePath: string };
    batch_download_started: { selectedCount: number };
    batch_download_completed: { selectedCount: number; targetDirectory: string };
    search_query_used: { query: string };
}

const trackGalleryEvent = <TEvent extends GalleryAnalyticsEvent>(
    event: TEvent,
    payload: GalleryAnalyticsPayloadMap[TEvent]
): void => {
    appLogger.info('GalleryAnalytics', event, payload);
};

const formatDate = (timestamp: number, locale: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

interface MetadataDisplayProps {
    metadata?: GalleryItemMetadata;
    mtime: number;
    t: (key: string) => string;
}

const MetadataItem = memo(({ icon: Icon, value }: { icon: LucideIcon; value: string | number }) => (
    <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="w-3 h-3" />
        <span className="truncate">{value}</span>
    </div>
));
MetadataItem.displayName = 'MetadataItem';

const GenerationParams = memo(({ metadata, t }: { metadata?: GalleryItemMetadata; t: (key: string) => string }) => {
    if (!metadata || !(metadata.steps || metadata.cfg_scale || metadata.seed)) { return null; }
    return (
        <div className="flex flex-wrap gap-2 text-xxxs text-muted-foreground border-t border-border/10 pt-2 mt-2">
            {metadata.steps && <span>{t('gallery.steps')}: {metadata.steps}</span>}
            {metadata.cfg_scale && <span>{t('gallery.cfg')}: {metadata.cfg_scale}</span>}
            {metadata.seed && <span>{t('gallery.seed')}: {metadata.seed}</span>}
        </div>
    );
});
GenerationParams.displayName = 'GenerationParams';

const PromptSection = memo(({ prompt, t }: { prompt: string; t: (key: string) => string }) => (
    <div className="mt-2 pt-2 border-t border-border/20">
        <div className="text-xxxs text-muted-foreground uppercase font-bold mb-1">{t('gallery.prompt')}</div>
        <div className="text-foreground/80 line-clamp-3 leading-relaxed">{prompt}</div>
    </div>
));
PromptSection.displayName = 'PromptSection';

const MetadataDisplay = memo(({ metadata, mtime, t }: MetadataDisplayProps) => {
    return (
        <div className="space-y-2 text-xxs">
            {/* Date */}
            <MetadataItem icon={Calendar} value={formatDate(mtime, t('common.locale'))} />

            {/* Dimensions */}
            {metadata?.width && metadata.height && (
                <MetadataItem icon={Image} value={`${metadata.width} × ${metadata.height}`} />
            )}

            {/* Model */}
            {metadata?.model && (
                <MetadataItem icon={Sparkles} value={metadata.model} />
            )}

            {/* Prompt */}
            {metadata?.prompt && (
                <PromptSection prompt={metadata.prompt} t={t} />
            )}

            {/* Generation params */}
            <GenerationParams metadata={metadata} t={t} />
        </div>
    );
});
MetadataDisplay.displayName = 'MetadataDisplay';

interface GalleryCardProps {
    img: GalleryItem;
    deleting: string | null;
    selected: boolean;
    onPreview: (image: GalleryItem) => void;
    onDelete: (path: string) => void;
    onOpen: (path: string) => void;
    onReveal: (path: string) => void;
    onToggleSelection: (path: string) => void;
    t: (key: string) => string;
}

const GalleryCard = memo(({ img, deleting, selected, onPreview, onDelete, onOpen, onReveal, onToggleSelection, t }: GalleryCardProps) => {
    const [showDetails, setShowDetails] = useState(false);

    return (
        <div
            key={img.path}
            className="group relative mb-4 break-inside-avoid bg-card/40 rounded-xl overflow-hidden border border-border/20 hover:border-primary/50 transition-all"
            onMouseEnter={() => setShowDetails(true)}
            onMouseLeave={() => setShowDetails(false)}
        >
            <div className="absolute top-2 left-2 z-20">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleSelection(img.path)}
                    onClick={event => event.stopPropagation()}
                    aria-label={t('gallery.selectImage')}
                    className="h-4 w-4 rounded border-border/70 bg-background/80"
                />
            </div>
            <button
                type="button"
                onClick={() => onPreview(img)}
                className="block w-full text-left"
                aria-label={t('gallery.openPreview')}
            >
                <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                />
            </button>

            {/* Hover Overlay with Details */}
            <div className={cn(
                "absolute inset-0 bg-gradient-to-t from-background/90 via-background/60 to-transparent transition-opacity flex flex-col justify-end p-3",
                showDetails ? "opacity-100" : "opacity-0"
            )}>
                {/* File name */}
                <div className="text-xs text-foreground truncate font-medium mb-2">{img.name}</div>

                {/* Metadata */}
                <MetadataDisplay metadata={img.metadata} mtime={img.mtime} t={t} />

                {/* Actions */}
                <div className="flex gap-2 justify-end mt-3 pt-2 border-t border-border/20">
                    {img.metadata?.prompt && (
                        <button
                            onClick={(e) => { e.stopPropagation(); }}
                            className="p-1.5 bg-info/20 hover:bg-info/40 text-info rounded-lg backdrop-blur-sm transition-colors"
                            title={t('gallery.viewPrompt')}
                        >
                            <Info className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onReveal(img.path); }}
                        className="p-1.5 bg-muted/20 hover:bg-muted/40 text-foreground rounded-lg backdrop-blur-sm transition-colors"
                        title={t('gallery.openLocation')}
                    >
                        <FolderOpen className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpen(img.path); }}
                        className="p-1.5 bg-primary/20 hover:bg-primary/40 text-primary rounded-lg backdrop-blur-sm transition-colors"
                        title={t('gallery.open')}
                    >
                        <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(img.path); }}
                        disabled={!!deleting}
                        className="p-1.5 bg-destructive/20 hover:bg-destructive/40 text-destructive rounded-lg backdrop-blur-sm transition-colors"
                        title={t('gallery.delete')}
                    >
                        {deleting === img.path ? (
                            <div className="w-4 h-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
});
GalleryCard.displayName = 'GalleryCard';

interface PanPosition {
    x: number;
    y: number;
}

export function GalleryView({ language }: GalleryViewProps) {
    const { t } = useTranslation(language);
    const [images, setImages] = useState<GalleryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
    const [isBatchDownloading, setIsBatchDownloading] = useState(false);
    const [previewImage, setPreviewImage] = useState<GalleryItem | null>(null);
    const [previewZoom, setPreviewZoom] = useState(1);
    const [previewPan, setPreviewPan] = useState<PanPosition>({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastPointer, setLastPointer] = useState<PanPosition>({ x: 0, y: 0 });
    const previousSearchQuery = useRef('');

    const loadImages = useCallback(async () => {
        setLoading(true);
        try {
            const list = await window.electron.gallery.list();
            const sortedList = list.sort((a: GalleryItem, b: GalleryItem) => b.mtime - a.mtime);
            setImages(sortedList);
            setSelectedPaths(prev => prev.filter(path => sortedList.some(img => img.path === path)));
        } catch (error) {
            appLogger.error('GalleryView', 'Failed to load gallery', error as Error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadImages();
    }, [loadImages]);

    const handleDelete = useCallback(async (path: string) => {
        setDeleting(path);
        trackGalleryEvent('image_deleted', { imagePath: path });
        try {
            await window.electron.gallery.delete(path);
            await loadImages();
        } catch (error) {
            appLogger.error('GalleryView', 'Failed to delete image', error as Error);
        } finally {
            setDeleting(null);
        }
    }, [loadImages]);

    const handleOpen = useCallback(async (path: string) => {
        trackGalleryEvent('image_opened', { imagePath: path });
        try {
            await window.electron.gallery.open(path);
        } catch (error) {
            appLogger.error('GalleryView', 'Failed to open image', error as Error);
        }
    }, []);

    const handleReveal = useCallback(async (path: string) => {
        trackGalleryEvent('image_revealed', { imagePath: path });
        try {
            await window.electron.gallery.reveal(path);
        } catch (error) {
            appLogger.error('GalleryView', 'Failed to reveal image', error as Error);
        }
    }, []);

    const handleToggleSelection = useCallback((path: string) => {
        setSelectedPaths(prev => (
            prev.includes(path) ? prev.filter(item => item !== path) : [...prev, path]
        ));
    }, []);

    const handleClearSelection = useCallback(() => {
        setSelectedPaths([]);
    }, []);

    const handleBatchDownload = useCallback(async () => {
        if (isBatchDownloading || selectedPaths.length === 0) {
            return;
        }

        setIsBatchDownloading(true);
        trackGalleryEvent('batch_download_started', { selectedCount: selectedPaths.length });
        try {
            const result = await window.electron.selectDirectory();
            if (!result.success || !result.path) {
                return;
            }

            await window.electron.gallery.batchDownload({
                filePaths: selectedPaths,
                targetDirectory: result.path,
            });
            trackGalleryEvent('batch_download_completed', {
                selectedCount: selectedPaths.length,
                targetDirectory: result.path,
            });
            await loadImages();
            setSelectedPaths([]);
        } catch (error) {
            appLogger.error('GalleryView', 'Failed to batch download images', error as Error);
        } finally {
            setIsBatchDownloading(false);
        }
    }, [isBatchDownloading, loadImages, selectedPaths]);

    const filteredImages = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        if (!normalizedQuery) {
            return images;
        }
        return images.filter(img => {
            const nameMatch = img.name.toLowerCase().includes(normalizedQuery);
            const promptMatch = img.metadata?.prompt?.toLowerCase().includes(normalizedQuery) ?? false;
            const modelMatch = img.metadata?.model?.toLowerCase().includes(normalizedQuery) ?? false;
            const seedMatch = String(img.metadata?.seed ?? '').includes(normalizedQuery);
            return nameMatch || promptMatch || modelMatch || seedMatch;
        });
    }, [images, searchQuery]);

    const handleClosePreview = useCallback(() => {
        if (previewImage) {
            trackGalleryEvent('preview_closed', { imagePath: previewImage.path });
        }
        setPreviewImage(null);
        setPreviewZoom(1);
        setPreviewPan({ x: 0, y: 0 });
        setIsPanning(false);
    }, [previewImage]);

    const handleOpenPreview = useCallback((image: GalleryItem) => {
        trackGalleryEvent('preview_opened', { imagePath: image.path });
        setPreviewImage(image);
        setPreviewZoom(1);
        setPreviewPan({ x: 0, y: 0 });
        setIsPanning(false);
    }, []);

    const handleZoomChange = useCallback((delta: number) => {
        setPreviewZoom(prev => {
            const next = Math.min(5, Math.max(1, Number((prev + delta).toFixed(2))));
            if (next !== prev) {
                trackGalleryEvent(delta > 0 ? 'zoom_in' : 'zoom_out', { zoom: next });
            }
            if (next === 1) {
                setPreviewPan({ x: 0, y: 0 });
            }
            return next;
        });
    }, []);

    const handleResetPreview = useCallback(() => {
        trackGalleryEvent('zoom_reset', { imagePath: previewImage?.path ?? null });
        setPreviewZoom(1);
        setPreviewPan({ x: 0, y: 0 });
        setIsPanning(false);
    }, [previewImage?.path]);

    useEffect(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        if (normalizedQuery !== previousSearchQuery.current && normalizedQuery.length > 0) {
            trackGalleryEvent('search_query_used', { query: normalizedQuery });
        }
        previousSearchQuery.current = normalizedQuery;
    }, [searchQuery]);

    useEffect(() => {
        if (!previewImage) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleClosePreview();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleClosePreview, previewImage]);

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border/20 flex items-center justify-between bg-muted/5">
                <div className="flex items-center gap-3">
                    <h3 className="text-foreground font-medium">{t('gallery.title')}</h3>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{t('gallery.imageCount', { count: filteredImages.length })}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {t('gallery.selectedCount', { count: selectedPaths.length })}
                    </span>
                    <button
                        onClick={handleClearSelection}
                        disabled={selectedPaths.length === 0 || isBatchDownloading}
                        className="px-2 py-1 text-xs border border-border/40 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {t('gallery.clearSelection')}
                    </button>
                    <button
                        onClick={() => void handleBatchDownload()}
                        disabled={selectedPaths.length === 0 || isBatchDownloading}
                        className="px-2 py-1 text-xs rounded-md bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                        <Download className={cn("w-3.5 h-3.5", isBatchDownloading && "animate-pulse")} />
                        {isBatchDownloading ? t('gallery.downloadingSelected') : t('gallery.downloadSelected')}
                    </button>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                        <Input
                            value={searchQuery}
                            onChange={event => setSearchQuery(event.target.value)}
                            placeholder={t('gallery.searchPlaceholder')}
                            className="pl-9 h-8 bg-muted/20 border-border/30"
                        />
                    </div>
                    <button
                        onClick={() => void loadImages()}
                        className="p-1.5 hover:bg-muted/20 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                        title={t('gallery.refresh')}
                    >
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {images.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <Image className="w-12 h-12 mb-3 opacity-20" />
                        <p>{t('gallery.noImages')}</p>
                        <p className="text-xs mt-1">{t('gallery.emptyState')}</p>
                    </div>
                ) : filteredImages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <Search className="w-12 h-12 mb-3 opacity-20" />
                        <p>{t('gallery.noResults')}</p>
                    </div>
                ) : (
                    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
                        {filteredImages.map((img) => (
                            <GalleryCard
                                key={img.path}
                                img={img}
                                deleting={deleting}
                                selected={selectedPaths.includes(img.path)}
                                onPreview={handleOpenPreview}
                                onDelete={(path) => void handleDelete(path)}
                                onOpen={(path) => void handleOpen(path)}
                                onReveal={(path) => void handleReveal(path)}
                                onToggleSelection={handleToggleSelection}
                                t={t}
                            />
                        ))}
                    </div>
                )}
            </div>

            {previewImage && (
                <div
                    className="fixed inset-0 z-[60] bg-background/90 backdrop-blur-sm flex items-center justify-center p-6"
                    onClick={handleClosePreview}
                >
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); handleZoomChange(0.2); }}
                            title={t('gallery.zoomIn')}
                            className="p-2 rounded-md bg-muted/70 hover:bg-muted text-foreground transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); handleZoomChange(-0.2); }}
                            title={t('gallery.zoomOut')}
                            className="p-2 rounded-md bg-muted/70 hover:bg-muted text-foreground transition-colors"
                        >
                            <Minus className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); handleResetPreview(); }}
                            title={t('gallery.resetView')}
                            className="px-3 py-2 text-xs rounded-md bg-muted/70 hover:bg-muted text-foreground transition-colors"
                        >
                            {t('gallery.resetView')}
                        </button>
                        <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); handleClosePreview(); }}
                            title={t('gallery.closePreview')}
                            className="p-2 rounded-md bg-muted/70 hover:bg-muted text-foreground transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div
                        onClick={(event) => event.stopPropagation()}
                        onWheel={(event) => {
                            event.preventDefault();
                            handleZoomChange(event.deltaY < 0 ? 0.2 : -0.2);
                        }}
                        onMouseDown={(event) => {
                            if (previewZoom <= 1) {
                                return;
                            }
                            setIsPanning(true);
                            setLastPointer({ x: event.clientX, y: event.clientY });
                        }}
                        onMouseMove={(event) => {
                            if (!isPanning || previewZoom <= 1) {
                                return;
                            }
                            const deltaX = event.clientX - lastPointer.x;
                            const deltaY = event.clientY - lastPointer.y;
                            setPreviewPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
                            setLastPointer({ x: event.clientX, y: event.clientY });
                        }}
                        onMouseUp={() => setIsPanning(false)}
                        onMouseLeave={() => setIsPanning(false)}
                        className={cn("max-w-[90vw] max-h-[85vh] overflow-hidden", previewZoom > 1 && "cursor-grab", isPanning && "cursor-grabbing")}
                    >
                        <img
                            src={previewImage.url}
                            alt={previewImage.name}
                            draggable={false}
                            className="max-w-[90vw] max-h-[85vh] object-contain select-none"
                            style={{
                                transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
                                transition: isPanning ? 'none' : 'transform 120ms ease-out',
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
