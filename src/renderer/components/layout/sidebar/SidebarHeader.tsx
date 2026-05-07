/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import logoBlack from '@assets/tengra_black.png';
import logoWhite from '@assets/tengra_white.png';
import { IconPlus } from '@tabler/icons-react';
import React, { useMemo } from 'react';

import { UI_PRIMITIVES } from '@/constants/ui-primitives';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface SidebarHeaderProps {
    isCollapsed: boolean;
    newChatLabel: string;
    onClickNewChat: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
    isCollapsed,
    newChatLabel,
    onClickNewChat,
}) => {
    const { t } = useTranslation();
    const { isLight } = useTheme();

    const logo = useMemo(() => (isLight ? logoBlack : logoWhite), [isLight]);

    return (
        <div className="flex flex-col gap-4 p-3">
            {/* Tengra Branding */}
            <div
                className={cn(
                    'flex items-center gap-3 px-2 py-1',
                    isCollapsed ? 'justify-center' : 'justify-start'
                )}
            >
                <img
                    src={logo}
                    className="h-7 w-7 min-w-7 object-contain"
                    alt={t('frontend.app.name')}
                />
                {!isCollapsed && (
                    <span className="text-sm font-semibold text-foreground/90">
                        {t('frontend.app.name')}
                    </span>
                )}
            </div>

            <button
                data-testid="new-chat-button"
                onClick={onClickNewChat}
                className={cn(
                    UI_PRIMITIVES.ACTION_BUTTON_GHOST,
                    'w-full flex items-center justify-center rounded-xl bg-primary/15 py-2.5 text-primary hover:bg-primary/20',
                    'gap-2',
                    isCollapsed && 'px-0'
                )}
            >
                <IconPlus className="w-4 h-4 stroke-2" />
                {!isCollapsed && (<>{newChatLabel}</>)}
            </button>
        </div>
    );
};

SidebarHeader.displayName = 'SidebarHeader';



