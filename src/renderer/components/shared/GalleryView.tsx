import { Calendar, Download, ExternalLink, FolderOpen, Image, Info, LucideIcon, Minus, Plus, RefreshCw, Search, Sparkles, Trash2, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Language, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { normalizeDirectorySelectionResult } from '@/utils/directory-selection.util';
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

/** Height in px for each gallery card in the virtualized grid */
const CARD_HEIGHT = 300;
/** Gap in px between grid items (matches Tailwind gap-4) */
const GRID_GAP = 16;
/** Number of extra rows rendered above and below the visible area */
const OVERSCAN_ROWS = 3;

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
    <div className="tengra-gallery-meta__item">
        <Icon className="tengra-gallery-meta__icon" />
        <span className="tengra-gallery-meta__value">{value}</span>
    </div>
));
MetadataItem.displayName = 'MetadataItem';

const GenerationParams = memo(({ metadata, t }: { metadata?: GalleryItemMetadata; t: (key: string) => string }) => {
    if (!metadata || !(metadata.steps || metadata.cfg_scale || metadata.seed)) { return null; }
    return (
        <div className="tengra-gallery-meta__params">
            {metadata.steps && <span>{t('gallery.steps')}: {metadata.steps}</span>}
            {metadata.cfg_scale && <span>{t('gallery.cfg')}: {metadata.cfg_scale}</span>}
            {metadata.seed && <span>{t('gallery.seed')}: {metadata.seed}</span>}
        </div>
    );
});
GenerationParams.displayName = 'GenerationParams';

const PromptSection = memo(({ prompt, t }: { prompt: string; t: (key: string) => string }) => (
    <div className="tengra-gallery-meta__prompt">
        <div className="tengra-gallery-meta__prompt-label">{t('gallery.prompt')}</div>
        <div className="tengra-gallery-meta__prompt-text">{prompt}</div>
    </div>
));
PromptSection.displayName = 'PromptSection';

const MetadataDisplay = memo(({ metadata, mtime, t }: MetadataDisplayProps) => {
    return (
        <div className="tengra-gallery-meta">
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
            className="tengra-gallery-card"
            onMouseEnter={() => setShowDetails(true)}
            onMouseLeave={() => setShowDetails(false)}
        >
            <div className="tengra-gallery-card__checkbox">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleSelection(img.path)}
                    onClick={event => event.stopPropagation()}
                    aria-label={t('gallery.selectImage')}
                    className="tengra-gallery-card__checkbox-input"
                />
            </div>
            <button
                type="button"
                onClick={() => onPreview(img)}
                className="tengra-gallery-card__image-btn"
                aria-label={t('gallery.openPreview')}
            >
                <img
                    src={img.url}
                    alt={img.name}
                    className="tengra-gallery-card__image"
                    loading="lazy"
                />
            </button>

            {/* Hover Overlay with Details */}
            <div className={cn(
                "tengra-gallery-card__overlay",
                showDetails && "tengra-gallery-card__overlay--visible"
            )}>
                {/* File name */}
                <div className="tengra-gallery-card__filename">{img.name}</div>

                {/* Metadata */}
                <MetadataDisplay metadata={img.metadata} mtime={img.mtime} t={t} />

                {/* Actions */}
                <div className="tengra-gallery-card__actions">
                    {img.metadata?.prompt && (
                        <button
                            onClick={(e) => { e.stopPropagation(); }}
                            className="tengra-gallery-card__action-btn tengra-gallery-card__action-btn--info"
                            title={t('gallery.viewPrompt')}
                        >
                            <Info className="tengra-gallery-card__action-icon" />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onReveal(img.path); }}
                        className="tengra-gallery-card__action-btn tengra-gallery-card__action-btn--muted"
                        title={t('gallery.openLocation')}
                    >
                        <FolderOpen className="tengra-gallery-card__action-icon" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpen(img.path); }}
                        className="tengra-gallery-card__action-btn tengra-gallery-card__action-btn--primary"
                        title={t('gallery.open')}
                    >
                        <ExternalLink className="tengra-gallery-card__action-icon" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(img.path); }}
                        disabled={!!deleting}
                        className="tengra-gallery-card__action-btn tengra-gallery-card__action-btn--destructive"
                        title={t('gallery.delete')}
                    >
                        {deleting === img.path ? (
                            <div className="tengra-gallery-card__action-spinner" />
                        ) : (
                            <Trash2 className="tengra-gallery-card__action-icon" />
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
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

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

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) { return; }
        const handleContainerScroll = (): void => {
            setScrollTop(container.scrollTop);
        };
        const resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
            const entry = entries[0];
            if (entry) {
                setViewportSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
            }
        });
        container.addEventListener('scroll', handleContainerScroll, { passive: true });
        resizeObserver.observe(container);
        return () => {
            container.removeEventListener('scroll', handleContainerScroll);
            resizeObserver.disconnect();
        };
    }, []);

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
            const result = normalizeDirectorySelectionResult(await window.electron.selectDirectory());
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

    const columnCount = useMemo(() => {
        const w = viewportSize.width;
        if (w >= 1280) { return 4; }
        if (w >= 1024) { return 3; }
        if (w >= 640) { return 2; }
        return 1;
    }, [viewportSize.width]);

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

    const virtualWindow = useMemo(() => {
        const empty = { visibleItems: [] as GalleryItem[], totalHeight: 0, offsetTop: 0 };
        if (viewportSize.height === 0 || filteredImages.length === 0) {
            return empty;
        }
        const rowHeight = CARD_HEIGHT + GRID_GAP;
        const totalRows = Math.ceil(filteredImages.length / columnCount);
        const totalHeight = totalRows > 0 ? totalRows * rowHeight - GRID_GAP : 0;
        const firstVisibleRow = Math.floor(scrollTop / rowHeight);
        const lastVisibleRow = Math.ceil((scrollTop + viewportSize.height) / rowHeight);
        const startRow = Math.max(0, firstVisibleRow - OVERSCAN_ROWS);
        const endRow = Math.min(totalRows, lastVisibleRow + OVERSCAN_ROWS);
        const startIdx = startRow * columnCount;
        const endIdx = Math.min(filteredImages.length, endRow * columnCount);
        return {
            visibleItems: filteredImages.slice(startIdx, endIdx),
            totalHeight,
            offsetTop: startRow * rowHeight,
        };
    }, [filteredImages, columnCount, scrollTop, viewportSize.height]);

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
        <div className="tengra-gallery">
            <div className="tengra-gallery__header">
                <div className="flex items-center gap-3">
                    <h3 className="tengra-gallery__title">{t('gallery.title')}</h3>
                    <span className="tengra-gallery__badge">{t('gallery.imageCount', { count: filteredImages.length })}</span>
                </div>
                <div className="tengra-gallery__actions">
                    <span className="tengra-gallery__badge">
                        {t('gallery.selectedCount', { count: selectedPaths.length })}
                    </span>
                    <button
                        onClick={handleClearSelection}
                        disabled={selectedPaths.length === 0 || isBatchDownloading}
                        className="tengra-gallery__clear-btn"
                    >
                        {t('gallery.clearSelection')}
                    </button>
                    <button
                        onClick={() => void handleBatchDownload()}
                        disabled={selectedPaths.length === 0 || isBatchDownloading}
                        className="tengra-gallery__download-btn"
                    >
                        <Download className={cn("tengra-gallery__download-icon", isBatchDownloading && "tengra-gallery__download-icon--loading")} />
                        {isBatchDownloading ? t('gallery.downloadingSelected') : t('gallery.downloadSelected')}
                    </button>
                    <div className="tengra-gallery__search">
                        <Search className="tengra-gallery__search-icon" />
                        <Input
                            value={searchQuery}
                            onChange={event => setSearchQuery(event.target.value)}
                            placeholder={t('gallery.searchPlaceholder')}
                            className="pl-9 h-8 bg-muted/20 border-border/30"
                        />
                    </div>
                    <button
                        onClick={() => void loadImages()}
                        className="tengra-gallery__refresh-btn"
                        title={t('gallery.refresh')}
                    >
                        <RefreshCw className={cn("tengra-gallery__refresh-icon", loading && "tengra-gallery__refresh-icon--loading")} />
                    </button>
                </div>
            </div>

            <div ref={scrollContainerRef} className="tengra-gallery__content">
                {images.length === 0 ? (
                    <div className="tengra-gallery__empty">
                        <Image className="tengra-gallery__empty-icon" />
                        <p>{t('gallery.noImages')}</p>
                        <p className="tengra-gallery__empty-subtitle">{t('gallery.emptyState')}</p>
                    </div>
                ) : filteredImages.length === 0 ? (
                    <div className="tengra-gallery__empty">
                        <Search className="tengra-gallery__empty-icon" />
                        <p>{t('gallery.noResults')}</p>
                    </div>
                ) : (
                    <div style={{ height: virtualWindow.totalHeight, position: 'relative' }}>
                        <div style={{
                            position: 'absolute',
                            top: virtualWindow.offsetTop,
                            left: 0,
                            right: 0,
                        }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                                gap: GRID_GAP,
                            }}>
                                {virtualWindow.visibleItems.map((img) => (
                                    <div key={img.path} style={{ height: CARD_HEIGHT }} className="overflow-hidden rounded-xl">
                                        <GalleryCard
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
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {previewImage && (
                <div
                    className="tengra-gallery-preview"
                    onClick={handleClosePreview}
                >
                    <div className="tengra-gallery-preview__controls">
                        <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); handleZoomChange(0.2); }}
                            title={t('gallery.zoomIn')}
                            className="tengra-gallery-preview__btn"
                        >
                            <Plus className="tengra-gallery-preview__btn-icon" />
                        </button>
                        <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); handleZoomChange(-0.2); }}
                            title={t('gallery.zoomOut')}
                            className="tengra-gallery-preview__btn"
                        >
                            <Minus className="tengra-gallery-preview__btn-icon" />
                        </button>
                        <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); handleResetPreview(); }}
                            title={t('gallery.resetView')}
                            className="tengra-gallery-preview__btn tengra-gallery-preview__btn--text"
                        >
                            {t('gallery.resetView')}
                        </button>
                        <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); handleClosePreview(); }}
                            title={t('gallery.closePreview')}
                            className="tengra-gallery-preview__btn"
                        >
                            <X className="tengra-gallery-preview__btn-icon" />
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
                        className={cn(
                            "tengra-gallery-preview__image-container",
                            previewZoom > 1 && "tengra-gallery-preview__image-container--zoomable",
                            isPanning && "tengra-gallery-preview__image-container--panning"
                        )}
                    >
                        <img
                            src={previewImage.url}
                            alt={previewImage.name}
                            draggable={false}
                            className="tengra-gallery-preview__image"
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
