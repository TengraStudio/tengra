/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useTranslation } from '@/i18n';

import { ImageSkeleton } from './message/MessageImages';
import { ResponseProgress } from './message/ResponseProgress';

/* Batch-02: Extracted Long Classes */
const C_MESSAGEUIEXTRAS_1 = "w-2 h-2 bg-gradient-to-r from-primary to-accent rounded-full animate-bounce animate-delay-300 shadow-lg shadow-primary/30";
const C_MESSAGEUIEXTRAS_2 = "w-2 h-2 bg-gradient-to-r from-accent to-primary rounded-full animate-bounce animate-delay-150 shadow-lg shadow-accent/30";


export const TypingDots = () => {
    const { t } = useTranslation(); // This might fail if outside provider, but assuming context exists. Better pass language or use hook.
    // MessageUIExtras seems to be stateless utility components?
    // If they are used inside components under I18nextProvider, hook works.
    return (
        <div className="flex gap-2 items-center px-2 py-3">
            <div className="flex gap-1.5 items-center">
                <div className={C_MESSAGEUIEXTRAS_1} />
                <div className={C_MESSAGEUIEXTRAS_2} />
                <div className="w-2 h-2 bg-gradient-to-r from-primary to-primary/80 rounded-full animate-bounce shadow-lg shadow-primary/30" />
            </div>
            <span className="text-sm text-muted-foreground/50 font-medium animate-pulse">
                {t('frontend.messageBubble.thinking')}
            </span>
        </div>
    );
};

export { ResponseProgress };

export const LocalizedImageSkeleton = () => {
    const { t } = useTranslation();
    return <ImageSkeleton t={t} />;
};

