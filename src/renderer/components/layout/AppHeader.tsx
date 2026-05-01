/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconContainer, IconLayoutGrid, IconMessage, IconMinus, IconSettings as SettingsIcon, IconShoppingBag, IconSquare, IconX } from '@tabler/icons-react';
import React from 'react';

import { useAuthLanguage } from '@/context/AuthContext';
import { useChatHeader } from '@/context/ChatContext';
import { AppView } from '@/hooks/useAppState';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { useMarketplaceStore } from '@/store/marketplace.store';


interface AppHeaderProps {
    currentView: AppView
    onOpenSettings: () => void
}

export const AppHeader: React.FC<AppHeaderProps> = ({
    currentView,
    onOpenSettings,
}) => {
    const { currentChatTitle } = useChatHeader();
    const { language } = useAuthLanguage();
    const { t } = useTranslation(language);
    const updateCount = useMarketplaceStore(s => s.updateCount);

    const viewIcons: Record<AppView, React.ElementType> = {
        chat: IconMessage,
        workspace: IconLayoutGrid,
        settings: SettingsIcon,
        mcp: IconContainer,
        docker: IconContainer,
        terminal: IconMessage,
        models: IconMessage,
        marketplace: IconShoppingBag,
    };

    const Icon = viewIcons[currentView] ?? IconMessage;


    const handleMinimize = () => {
        void window.electron.minimize();
    };
    const handleMaximize = () => {
        void window.electron.maximize();
    };
    const handleClose = () => {
        void window.electron.close();
    };

    return (
        <>
            <header className="app-drag-region z-20 flex h-14 items-center justify-between bg-background/95 px-6">
                <div className="no-drag flex items-center gap-4">
                    <div className="rounded-xl bg-primary/10 p-2">
                        <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
                            {currentView === 'chat' && currentChatTitle
                                ? currentChatTitle
                                : t(`nav.${currentView}`)}
                        </h1>
                    </div>
                </div>

                <div className="no-drag flex items-center gap-2">
                    <button
                        onClick={onOpenSettings}
                        className={cn(
                            'relative rounded-xl p-2 transition-colors',
                            currentView === 'settings'
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                        )}
                        title={t('frontend.nav.settings')}
                        aria-label={t('frontend.nav.settings')}
                    >
                        <SettingsIcon className="h-4 w-4" />
                        {updateCount > 0 && (
                            <span className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 typo-overline font-bold leading-none text-destructive-foreground shadow-outline-background-2">
                                {updateCount}
                            </span>
                        )}
                    </button>

                    <div className="mx-2 h-4 w-px bg-border/50" />

                    <div className="flex items-center gap-1">
                        <button
                            data-testid="window-minimize"
                            onClick={handleMinimize}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent/50"
                        >
                            <IconMinus className="h-4 w-4" />
                        </button>
                        <button
                            data-testid="window-maximize"
                            onClick={handleMaximize}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent/50"
                        >
                            <IconSquare className="h-3.5 w-3.5" />
                        </button>
                        <button
                            data-testid="window-close"
                            onClick={handleClose}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                        >
                            <IconX className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </header >
        </>
    );
};

export const MemoizedAppHeader = React.memo(AppHeader);
