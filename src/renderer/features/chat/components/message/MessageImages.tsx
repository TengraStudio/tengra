import { Eye, Sparkles } from 'lucide-react';
import { memo } from 'react';

type TranslationFn = (key: string, options?: Record<string, string | number>) => string;

export const ImageSkeleton = ({ t }: { t: TranslationFn }) => (
    <div className="w-[300px] h-[300px] rounded-xl bg-accent/30 border border-border/50 flex flex-col items-center justify-center gap-4 relative overflow-hidden group/skel">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/30 to-transparent -translate-x-full animate-slide-shimmer" />
        <div className="w-12 h-12 rounded-full bg-accent/30 flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 text-primary/40" />
        </div>
        <div className="space-y-2 text-center">
            <div className="text-xxs font-black uppercase tracking-widest text-muted-foreground/40 animate-pulse">
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
    if (images.length === 0) {
        return null;
    }
    return (
        <div className="flex gap-3 flex-wrap mb-4">
            {images.map((img, i) =>
                img === '__LOADING_IMAGE__' ? (
                    <ImageSkeleton key={i} t={t} />
                ) : (
                    <div key={i} className="relative group/img-container">
                        <img
                            src={img}
                            alt={t('messageBubble.attachedImage', { index: i + 1 })}
                            className="max-w-full md:max-w-md max-h-[500px] object-contain rounded-xl border border-border/50 cursor-pointer hover:opacity-90 transition-all duration-300 shadow-2xl"
                            onClick={() => {
                                window.electron.openExternal(img);
                            }}
                        />
                        <div className="absolute inset-0 bg-background/40 opacity-0 group-hover/img-container:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
                            <Eye className="w-6 h-6 text-foreground" />
                        </div>
                    </div>
                )
            )}
        </div>
    );
});

MessageImages.displayName = 'MessageImages';
