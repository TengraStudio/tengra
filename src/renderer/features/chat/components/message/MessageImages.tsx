import { Expand, Sparkles, X } from 'lucide-react';
import { memo, useState } from 'react';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export const ImageSkeleton = ({ t }: { t: TranslationFn }) => (
    <div className="w-72 h-72 rounded-xl bg-accent/30 border border-border/50 flex flex-col items-center justify-center gap-4 relative overflow-hidden group/skel">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/30 to-transparent -translate-x-full animate-slide-shimmer" />
        <div className="w-12 h-12 rounded-full bg-accent/30 flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 text-primary/40" />
        </div>
        <div className="space-y-2 text-center">
            <div className="text-xxs font-bold text-muted-foreground/40 animate-pulse">
                {t('messageBubble.TengraDrawing')}
            </div>
            <div className="flex gap-1 justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-bounce" />
            </div>
        </div>
    </div>
);

export interface MessageImagesProps {
    images: string[];
    t: TranslationFn;
}

/**
 * MessageImages component
 * 
 * Renders a gallery of attached images for a message.
 * Supports a loading skeleton state.
 */
export const MessageImages = memo(({ images, t }: MessageImagesProps) => {
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    if (images.length === 0) {
        return null;
    }
    return (
        <>
            <div className="mb-4 overflow-hidden rounded-3xl border border-border/60 bg-card/50">
                <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                    <div className="flex flex-col">
                        <span className="text-xxs font-semibold text-muted-foreground/70">
                            {t('input.generate')}
                        </span>
                        <span className="text-sm font-medium text-foreground/90">
                            {t('gallery.imageCount', { count: images.length })}
                        </span>
                    </div>
                    <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xxs font-semibold text-muted-foreground/80">
                        {t('common.zoomIn')}
                    </span>
                </div>

                <div className="grid gap-4 p-4">
                    {images.map((img, i) =>
                        img === '__LOADING_IMAGE__' ? (
                            <ImageSkeleton key={i} t={t} />
                        ) : (
                            <button
                                key={i}
                                type="button"
                                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-muted/10 text-left"
                                onClick={() => {
                                    setPreviewImage(img);
                                }}
                            >
                                <img
                                    src={img}
                                    alt={t('messageBubble.attachedImage', { index: i + 1 })}
                                    className="max-h-screen min-h-96 w-full object-cover transition-transform duration-300 group-hover:scale-102"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-background/75 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-xl border border-border/50 bg-background/80 px-3 py-2 opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100">
                                    <span className="text-xs font-medium text-foreground">
                                        {t('messageBubble.attachedImage', { index: i + 1 })}
                                    </span>
                                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                        <Expand className="h-3.5 w-3.5" />
                                        {t('common.zoomIn')}
                                    </span>
                                </div>
                            </button>
                        )
                    )}
                </div>
            </div>

            {previewImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-6 backdrop-blur-md"
                    onClick={() => {
                        setPreviewImage(null);
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('common.zoomIn')}
                >
                    <button
                        type="button"
                        className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-background/80 text-muted-foreground transition-colors hover:bg-background/90 hover:text-foreground"
                        onClick={event => {
                            event.stopPropagation();
                            setPreviewImage(null);
                        }}
                        aria-label={t('aria.closeModal')}
                    >
                        <X className="h-4 w-4" />
                    </button>
                    <div
                        className="flex max-h-screen max-w-full items-center justify-center"
                        onClick={event => {
                            event.stopPropagation();
                        }}
                    >
                        <img
                            src={previewImage}
                            alt={t('messageBubble.attachedImage', { index: 1 })}
                            className="max-h-screen max-w-full rounded-2xl object-contain shadow-2xl"
                        />
                    </div>
                </div>
            )}
        </>
    );
});

MessageImages.displayName = 'MessageImages';
