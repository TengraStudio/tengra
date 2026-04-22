/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    FolderOpen,
    Image as ImageIcon,
    Info,
    Maximize2,
    RefreshCw,
    Search,
    Sparkles,
    Trash2
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip } from '@/components/ui/tooltip';
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

/** Height in px for each gallery card in the virtualized grid */
const CARD_HEIGHT = 280;
/** Gap in px between grid items */
const GRID_GAP = 16;
/** Number of extra rows rendered above and below the visible area */
const OVERSCAN_ROWS = 4;

const formatDate = (timestamp: number, locale: string): string => {
    return new Date(timestamp).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// --- Sub-components ---

const MetadataBadge = ({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label?: string; value: string | number }) => (
    <Tooltip content={label ?? ''} side="top" delay={300}>
        <Badge variant="outline" className="flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] bg-muted/30 border-muted-foreground/10 text-muted-foreground hover:bg-muted/50 cursor-default">
            <Icon className="w-3 h-3 opacity-60" />
            <span>{value}</span>
        </Badge>
    </Tooltip>
);

const GalleryCard = memo(({
    img,
    selected,
    onPreview,
    onToggleSelection
}: {
    img: GalleryItem;
    selected: boolean;
    onPreview: (image: GalleryItem) => void;
    onToggleSelection: (path: string) => void;
}) => {
    return (
        <Card
            className={cn(
                "group relative h-full overflow-hidden border-border/40 bg-card transition-all duration-300 hover:border-primary/30 hover:shadow-lg",
                selected && "ring-2 ring-primary ring-offset-2"
            )}
        >
            <div className={cn(
                "absolute top-3 left-3 z-20 transition-opacity duration-200",
                selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
                <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggleSelection(img.path)}
                    className="bg-background/80 backdrop-blur-sm border-primary/50 text-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                />
            </div>
            
            <div
                className="relative w-full h-full cursor-pointer overflow-hidden"
                onClick={() => onPreview(img)}
            >
                <img
                    src={img.url}
                    alt={img.name}
                    className="w-full h-full object-cover transition-all duration-300"
                    loading="lazy"
                />
            </div>
        </Card>
    );
});
GalleryCard.displayName = 'GalleryCard';

export function GalleryView({ language }: GalleryViewProps) {
    const { t } = useTranslation(language);
    const [images, setImages] = useState<GalleryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
    const [previewImage, setPreviewImage] = useState<GalleryItem | null>(null);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

    const loadImages = useCallback(async () => {
        setLoading(true);
        try {
            const list = await window.electron.gallery.list();
            const sortedList = list.sort((a, b) => b.mtime - a.mtime);
            setImages(sortedList);
        } catch (error) {
            appLogger.error('GalleryView', 'Failed to load images', error as Error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadImages();
    }, [loadImages]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) {
            return;
        }
        const handleScroll = () => setScrollTop(container.scrollTop);
        const resizeObserver = new ResizeObserver((entries) => {
            if (entries[0]) {
                setViewportSize({
                    width: entries[0].contentRect.width,
                    height: entries[0].contentRect.height,
                });
            }
        });
        container.addEventListener('scroll', handleScroll, { passive: true });
        resizeObserver.observe(container);
        return () => {
            container.removeEventListener('scroll', handleScroll);
            resizeObserver.disconnect();
        };
    }, []);

    const filteredImages = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) {
            return images;
        }
        return images.filter(img =>
            img.name.toLowerCase().includes(q) ||
            img.metadata?.prompt?.toLowerCase().includes(q) ||
            img.metadata?.model?.toLowerCase().includes(q)
        );
    }, [images, searchQuery]);

    const columnCount = useMemo(() => {
        const w = viewportSize.width;
        if (w >= 1400) {
            return 5;
        }
        if (w >= 1100) {
            return 4;
        }
        if (w >= 800) {
            return 3;
        }
        if (w >= 500) {
            return 2;
        }
        return 1;
    }, [viewportSize.width]);

    const virtualData = useMemo(() => {
        if (!viewportSize.height || filteredImages.length === 0) {
            return { items: [], totalHeight: 0, offsetTop: 0 };
        }
        const rowHeight = CARD_HEIGHT + GRID_GAP;
        const totalRows = Math.ceil(filteredImages.length / columnCount);
        const totalHeight = totalRows * rowHeight - GRID_GAP;

        const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN_ROWS);
        const endRow = Math.min(totalRows, Math.ceil((scrollTop + viewportSize.height) / rowHeight) + OVERSCAN_ROWS);

        return {
            items: filteredImages.slice(startRow * columnCount, endRow * columnCount),
            totalHeight,
            offsetTop: startRow * rowHeight
        };
    }, [filteredImages, columnCount, scrollTop, viewportSize.height]);

    const handleToggleSelection = (path: string) => {
        setSelectedPaths(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]);
    };

    const handleDelete = async (path: string) => {
        setDeleting(path);
        try {
            await window.electron.gallery.delete(path);
            await loadImages();
            if (previewImage?.path === path) {
                setPreviewImage(null);
            }
        } catch (error) {
            appLogger.error('GalleryView', 'Delete failed', error as Error);
        } finally {
            setDeleting(null);
        }
    };

    const handleNavigate = (direction: 'next' | 'prev') => {
        if (!previewImage) {
            return;
        }
        const idx = filteredImages.findIndex(img => img.path === previewImage.path);
        const nextIdx = direction === 'next' ? idx + 1 : idx - 1;
        if (nextIdx >= 0 && nextIdx < filteredImages.length) {
            setPreviewImage(filteredImages[nextIdx]);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background select-none">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-b border-border/50 bg-card/30 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold tracking-tight">{t('gallery.title')}</h2>
                    <Badge variant="secondary" className="font-mono text-[10px] h-5">
                        {filteredImages.length}
                    </Badge>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative group flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        <Input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={t('gallery.searchPlaceholder')}
                            className="pl-9 h-9 bg-muted/20 border-border/30 rounded-xl focus-visible:ring-primary/20"
                        />
                    </div>

                    <Tooltip content={t('gallery.refresh')}>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => void loadImages()}
                            className="h-9 w-9 rounded-xl shrink-0"
                        >
                            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        </Button>
                    </Tooltip>

                    {selectedPaths.length > 0 && (
                        <div className="flex items-center gap-2 animate-in slide-in-from-right-4">

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedPaths([])}
                                className="h-9 text-muted-foreground hover:text-foreground"
                            >
                                {t('gallery.clearSelection')}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Grid Area */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 custom-scrollbar lg:p-6"
            >
                {filteredImages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20 grayscale">
                        <ImageIcon className="w-16 h-16 mb-4" />
                        <p className="text-sm font-medium">{loading ? t('common.loading') : t('gallery.noImages')}</p>
                    </div>
                ) : (
                    <div style={{ height: virtualData.totalHeight, position: 'relative' }}>
                        <div style={{
                            position: 'absolute',
                            top: virtualData.offsetTop,
                            left: 0,
                            right: 0,
                            display: 'grid',
                            gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                            gap: GRID_GAP,
                        }}>
                            {virtualData.items.map((img) => (
                                <div key={img.path} style={{ height: CARD_HEIGHT }}>
                                    <GalleryCard
                                        img={img}
                                        selected={selectedPaths.includes(img.path)}
                                        onPreview={setPreviewImage}
                                        onToggleSelection={handleToggleSelection}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Dialog */}
            <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
                <DialogContent className="max-w-[95vw] w-full max-h-[90vh] p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/10 rounded-3xl sm:max-w-7xl">
                    <div className="flex flex-col lg:flex-row h-full min-h-[500px]">
                        {/* Image Side */}
                        <div className="relative flex-1 bg-black/20 flex items-center justify-center p-4 lg:p-8 min-h-[300px] group">
                            {previewImage && (
                                <img
                                    src={previewImage.url}
                                    alt={previewImage.name}
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-500"
                                />
                            )}

                            {/* Navigation Buttons */}
                            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="rounded-full h-12 w-12 bg-background/60 backdrop-blur"
                                    onClick={(e) => { e.stopPropagation(); handleNavigate('prev'); }}
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className="rounded-full h-12 w-12 bg-background/60 backdrop-blur"
                                    onClick={(e) => { e.stopPropagation(); handleNavigate('next'); }}
                                >
                                    <ChevronRight className="w-6 h-6" />
                                </Button>
                            </div>

                            <div className="absolute top-4 left-4 flex gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="bg-background/80"
                                    onClick={() => previewImage && void window.electron.gallery.open(previewImage.path)}
                                >
                                    <Maximize2 className="w-3.5 h-3.5 mr-2" />
                                    {t('gallery.fullScreen')}
                                </Button>
                            </div>
                        </div>

                        {/* Metadata Side */}
                        <div className="w-full lg:w-[420px] border-l border-border/10 flex flex-col bg-card/30">
                            <DialogHeader className="p-6 pb-4 border-b border-border/5">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1 pr-8">
                                        <DialogTitle className="text-lg font-bold truncate">
                                            {previewImage?.name}
                                        </DialogTitle>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                            <Calendar className="w-3 h-3" />
                                            {previewImage && formatDate(previewImage.mtime, t('common.locale'))}
                                        </div>
                                    </div> 
                                </div>
                            </DialogHeader>

                            <ScrollArea className="flex-1 p-6">
                                <div className="space-y-6">
                                    {/* Prompts Section */}
                                    {previewImage?.metadata?.prompt && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-primary" />
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-primary">{t('gallery.prompt')}</h4>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 text-sm leading-relaxed text-foreground/90 font-medium italic select-text selection:bg-primary/20">
                                                {previewImage.metadata.prompt}
                                            </div>

                                            {previewImage.metadata.negative_prompt && (
                                                <div className="space-y-2 mt-4">
                                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{t('gallery.negativePrompt')}</h4>
                                                    <div className="p-3 rounded-xl bg-muted/30 border border-border/10 text-xs text-muted-foreground italic select-text">
                                                        {previewImage.metadata.negative_prompt}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Parameters Grid */}
                                    <div className="space-y-3 pt-2">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{t('gallery.technicalParams')}</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {previewImage?.metadata?.model && (
                                                <MetadataBadge icon={Sparkles} label={t('gallery.metadata.model')} value={previewImage.metadata.model} />
                                            )}
                                            {previewImage?.metadata?.width && previewImage.metadata.height && (
                                                <MetadataBadge icon={ImageIcon} label={t('gallery.metadata.resolution')} value={`${previewImage.metadata.width}×${previewImage.metadata.height}`} />
                                            )}
                                            {previewImage?.metadata?.steps && (
                                                <MetadataBadge icon={RefreshCw} label={t('gallery.metadata.steps')} value={previewImage.metadata.steps} />
                                            )}
                                            {previewImage?.metadata?.cfg_scale && (
                                                <MetadataBadge icon={Info} label={t('gallery.metadata.cfgScale')} value={previewImage.metadata.cfg_scale} />
                                            )}
                                            {previewImage?.metadata?.seed && (
                                                <MetadataBadge icon={Info} label={t('gallery.metadata.seed')} value={previewImage.metadata.seed} />
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="grid grid-cols-2 gap-3 pt-6">
                                        <Button
                                            variant="outline"
                                            className="h-10 rounded-xl gap-2 font-bold"
                                            onClick={() => previewImage && void window.electron.gallery.reveal(previewImage.path)}
                                        >
                                            <FolderOpen className="w-4 h-4" />
                                            {t('gallery.revealInFileExplorer')}
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            className="h-10 rounded-xl gap-2 font-bold"
                                            onClick={() => previewImage && void handleDelete(previewImage.path)}
                                            disabled={!!deleting}
                                        >
                                            {deleting === previewImage?.path ? <RefreshCw className="animate-spin w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                                            {t('common.delete')}
                                        </Button>
                                    </div>
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
