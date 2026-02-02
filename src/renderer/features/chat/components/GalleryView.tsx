import { ExternalLink, FolderOpen,Image, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect,useState } from 'react';

import { appLogger } from '@main/logging/logger';
import { Language,useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface GalleryViewProps {
    language: Language;
}

export function GalleryView({ language }: GalleryViewProps) {
    const { t } = useTranslation(language);
    const [images, setImages] = useState<Array<{ name: string; path: string; url: string; mtime: number }>>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        void loadImages();
    }, []);

    const loadImages = async () => {
        setLoading(true);
        try {
            const list = await window.electron.gallery.list();
            // Sort by modification time (newest first)
            setImages(list.sort((a, b) => b.mtime - a.mtime));
        } catch (error) {
            appLogger.error('GalleryView', 'Failed to load gallery', error as Error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (path: string) => {
        console.warn(t('gallery.deleteConfirm'));
        setDeleting(path);
        try {
            await window.electron.gallery.delete(path);
            await loadImages();
        } catch (error) {
            appLogger.error('GalleryView', 'Failed to delete image', error as Error);
        } finally {
            setDeleting(null);
        }
    };

    const handleOpen = async (path: string) => {
        try {
            await window.electron.gallery.open(path);
        } catch (error) {
            appLogger.error('GalleryView', 'Failed to open image', error as Error);
        }
    };

    const handleReveal = async (path: string) => {
        try {
            await window.electron.gallery.reveal(path);
        } catch (error) {
            appLogger.error('GalleryView', 'Failed to reveal image', error as Error);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                    <h3 className="text-foreground font-medium">{t('gallery.title')}</h3>
                    <span className="text-xs text-muted-foreground bg-zinc-800 px-2 py-0.5 rounded-full">{t('gallery.imageCount', { count: images.length })}</span>
                </div>
                <button
                    onClick={() => void loadImages()}
                    className="p-1.5 hover:bg-white/10 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    title={t('gallery.refresh')}
                >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {images.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <Image className="w-12 h-12 mb-3 opacity-20" />
                        <p>{t('gallery.noImages')}</p>
                        <p className="text-xs mt-1">{t('gallery.emptyState')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {images.map((img) => (
                            <div key={img.path} className="group relative aspect-square bg-black/40 rounded-xl overflow-hidden border border-white/5 hover:border-purple/50 transition-all">
                                <img
                                    src={img.url}
                                    alt={img.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    loading="lazy"
                                />

                                {/* Overlay */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                    <div className="text-xs text-foreground truncate font-medium mb-2">{img.name}</div>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => void handleReveal(img.path)}
                                            className="p-1.5 bg-white/10 hover:bg-white/20 text-foreground rounded-lg backdrop-blur-sm transition-colors"
                                            title={t('gallery.openLocation')}
                                        >
                                            <FolderOpen className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => void handleOpen(img.path)}
                                            className="p-1.5 bg-primary/20 hover:bg-primary/40 text-blue-300 rounded-lg backdrop-blur-sm transition-colors"
                                            title={t('gallery.open')}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => void handleDelete(img.path)}
                                            disabled={!!deleting}
                                            className="p-1.5 bg-destructive/20 hover:bg-destructive/40 text-red-300 rounded-lg backdrop-blur-sm transition-colors"
                                            title={t('gallery.delete')}
                                        >
                                            {deleting === img.path ? (
                                                <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
