import { useTranslation } from '@/i18n';

import { ImageSkeleton } from './message/MessageImages';
import { ResponseProgress } from './message/ResponseProgress';

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

export { ResponseProgress };

export const LocalizedImageSkeleton = () => {
    const { t } = useTranslation();
    return <ImageSkeleton t={t} />;
};

