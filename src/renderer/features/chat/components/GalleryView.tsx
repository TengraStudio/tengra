import { useState, useEffect } from 'react';
import { Image, Trash2, ExternalLink, RefreshCw, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation, Language } from '@/i18n';

interface GalleryViewProps {
    language: Language;
}

export function GalleryView({ language }: GalleryViewProps) {
    const { t } = useTranslation(language);
    const [images, setImages] = useState<Array<{ name: string; path: string; url: string; mtime: number }>>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        loadImages();
    }, []);

    const loadImages = async () => {
        setLoading(true);
        try {
            const list = await window.electron.gallery.list();
            // Sort by modification time (newest first)
            setImages(list.sort((a, b) => b.mtime - a.mtime));
        } catch (error) {
            console.error('Failed to load gallery:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (path: string) => {
        if (!confirm(t('gallery.deleteConfirm'))) return;
        setDeleting(path);
        try {
            await window.electron.gallery.delete(path);
            await loadImages();
        } catch (error) {
            console.error('Failed to delete image:', error);
        } finally {
            setDeleting(null);
        }
    };

    const handleOpen = async (path: string) => {
        try {
            await window.electron.gallery.open(path);
        } catch (error) {
            console.error('Failed to open image:', error);
        }
    };

    const handleReveal = async (path: string) => {
        try {
            await window.electron.gallery.reveal(path);
        } catch (error) {
            console.error('Failed to reveal image:', error);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                    <h3 className="text-white font-medium">{t('gallery.title')}</h3>
                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{t('gallery.imageCount', { count: images.length })}</span>
                </div>
                <button
                    onClick={loadImages}
                    className="p-1.5 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors"
                    title={t('gallery.refresh')}
                >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {images.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                        <Image className="w-12 h-12 mb-3 opacity-20" />
                        <p>{t('gallery.noImages')}</p>
                        <p className="text-xs mt-1">{t('gallery.emptyState')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {images.map((img) => (
                            <div key={img.path} className="group relative aspect-square bg-black/40 rounded-xl overflow-hidden border border-white/5 hover:border-purple-500/50 transition-all">
                                <img
                                    src={img.url}
                                    alt={img.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    loading="lazy"
                                />

                                {/* Overlay */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                    <div className="text-xs text-white truncate font-medium mb-2">{img.name}</div>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => handleReveal(img.path)}
                                            className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-colors"
                                            title={t('gallery.openLocation')}
                                        >
                                            <FolderOpen className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleOpen(img.path)}
                                            className="p-1.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 rounded-lg backdrop-blur-sm transition-colors"
                                            title={t('gallery.open')}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(img.path)}
                                            disabled={!!deleting}
                                            className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-lg backdrop-blur-sm transition-colors"
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
