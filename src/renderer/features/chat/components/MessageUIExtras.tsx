import { Sparkles } from 'lucide-react';

import { useTranslation } from '@/i18n';

export const TypingDots = () => {
    const { t } = useTranslation(); // This might fail if outside provider, but assuming context exists. Better pass language or use hook.
    // MessageUIExtras seems to be stateless utility components?
    // If they are used inside components under I18nextProvider, hook works.
    return (
        <div className="flex gap-2 items-center px-2 py-3">
            <div className="flex gap-1.5 items-center">
                <div className="w-2 h-2 bg-gradient-to-r from-primary to-accent rounded-full animate-bounce [animation-delay:-0.3s] shadow-lg shadow-primary/30" />
                <div className="w-2 h-2 bg-gradient-to-r from-accent to-primary rounded-full animate-bounce [animation-delay:-0.15s] shadow-lg shadow-accent/30" />
                <div className="w-2 h-2 bg-gradient-to-r from-primary to-primary/80 rounded-full animate-bounce shadow-lg shadow-primary/30" />
            </div>
            <span className="text-xxs text-muted-foreground/50 font-medium animate-pulse">
                {t('messageBubble.thinking')}
            </span>
        </div>
    );
};

export const ResponseProgress = () => (
    <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden bg-primary/5">
        <div
            className="h-full w-full bg-primary/40 animate-pulse"
            style={{
                background:
                    'linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
            }}
        />
    </div>
);

export const ImageSkeleton = () => {
    const { t } = useTranslation();
    return (
        <div className="w-72 h-72 rounded-xl bg-muted/30 border border-border/50 flex flex-col items-center justify-center gap-4 relative overflow-hidden group/skel">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted/30 to-transparent -translate-x-full animate-slide-shimmer" />
            <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center animate-pulse">
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
};

