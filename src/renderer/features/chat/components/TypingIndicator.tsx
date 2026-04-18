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

export const TypingIndicator = () => {
    const { t } = useTranslation();

    return (
        <div className="flex gap-2 items-center px-4 py-3 bg-muted/5 rounded-2xl w-fit">
            <div className="flex gap-1.5 items-center">
                <div className={"w-2 h-2 bg-gradient-to-r from-primary to-accent-foreground rounded-full animate-bounce animate-delay-300 shadow-lg shadow-primary/30"} />
                <div className={"w-2 h-2 bg-gradient-to-r from-accent-foreground to-info rounded-full animate-bounce animate-delay-150 shadow-lg shadow-accent-foreground/30"} />
                <div className="w-2 h-2 bg-gradient-to-r from-info to-primary rounded-full animate-bounce shadow-lg shadow-info/30" />
            </div>
            <span className="typo-caption text-muted-foreground/50 font-medium animate-pulse ml-1">{t('messageBubble.thinking')}</span>
        </div>
    );
};
