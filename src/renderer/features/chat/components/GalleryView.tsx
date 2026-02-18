import { Calendar, ExternalLink, FolderOpen, Image, Info, LucideIcon, RefreshCw, Search, Sparkles, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

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
    language: Language;
    deleting: string | null;
    onDelete: (path: string) => void;
    onOpen: (path: string) => void;
    onReveal: (path: string) => void;
    t: (key: string) => string;
}

const GalleryCard = memo(({ img, deleting, onDelete, onOpen, onReveal, t }: Omit<GalleryCardProps, 'language'>) => {
    const [showDetails, setShowDetails] = useState(false);

    return (
        <div
            key={img.path}
            className="group relative aspect-square bg-card/40 rounded-xl overflow-hidden border border-border/20 hover:border-primary/50 transition-all"
            onMouseEnter={() => setShowDetails(true)}
            onMouseLeave={() => setShowDetails(false)}
        >
            <img
                src={img.url}
                alt={img.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
            />

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
                        onClick={() => onReveal(img.path)}
                        className="p-1.5 bg-muted/20 hover:bg-muted/40 text-foreground rounded-lg backdrop-blur-sm transition-colors"
                        title={t('gallery.openLocation')}
                    >
                        <FolderOpen className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onOpen(img.path)}
                        className="p-1.5 bg-primary/20 hover:bg-primary/40 text-primary rounded-lg backdrop-blur-sm transition-colors"
                        title={t('gallery.open')}
                    >
                        <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDelete(img.path)}
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

export function GalleryView({ language }: GalleryViewProps) {
    const { t } = useTranslation(language);
    const [images, setImages] = useState<GalleryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const loadImages = useCallback(async () => {
        setLoading(true);
        try {
            const list = await window.electron.gallery.list();
            setImages(list.sort((a: GalleryItem, b: GalleryItem) => b.mtime - a.mtime));
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
        try {
            await window.electron.gallery.open(path);
        } catch (error) {
            appLogger.error('GalleryView', 'Failed to open image', error as Error);
        }
    }, []);

    const handleReveal = useCallback(async (path: string) => {
        try {
            await window.electron.gallery.reveal(path);
        } catch (error) {
            appLogger.error('GalleryView', 'Failed to reveal image', error as Error);
        }
    }, []);

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

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border/20 flex items-center justify-between bg-muted/5">
                <div className="flex items-center gap-3">
                    <h3 className="text-foreground font-medium">{t('gallery.title')}</h3>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{t('gallery.imageCount', { count: filteredImages.length })}</span>
                </div>
                <div className="flex items-center gap-2">
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
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredImages.map((img) => (
                            <GalleryCard
                                key={img.path}
                                img={img}
                                deleting={deleting}
                                onDelete={(path) => void handleDelete(path)}
                                onOpen={(path) => void handleOpen(path)}
                                onReveal={(path) => void handleReveal(path)}
                                t={t}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
