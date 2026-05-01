/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconActivity, IconCode, IconHistory, IconSearch, IconVectorBezier2 } from '@tabler/icons-react';
import React, { useMemo } from 'react';

import logoBlack from '@assets/tengra_black.png';
import logoWhite from '@assets/tengra_white.png';
import { Button } from '@/components/ui/button';
import { ChatTemplate } from '@/features/chat/types';
import { useThemeDetection } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { setCurrentChatId, useChatStore } from '@/store/chat.store';

interface WelcomeScreenProps {
    t: (key: string) => string;
    templates: ChatTemplate[];
    onSelectTemplate: (prompt: string) => void;
}

/**
 * WelcomeScreen Component
 * 
 * Displayed when there are no messages in the current chat.
 * Provides a greeting and quick-start templates for different tasks.
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
    t,
    templates,
    onSelectTemplate
}) => {
    const { isLight } = useThemeDetection();

    const logo = useMemo(() => isLight ? logoBlack : logoWhite, [isLight]);

    return (
        <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center space-y-6 p-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center">
                <img src={logo} alt={t('frontend.welcome.logoAlt')} />
            </div>
            <div className="space-y-2">
                <h1 className="mb-1 text-3xl font-semibold text-foreground">{t('frontend.welcome.title')}</h1>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">{t('frontend.welcome.tagline')}</p>
            </div>
            <div className="mt-4 grid w-full max-w-2xl grid-cols-1 gap-2.5 animate-in fade-in duration-500 sm:grid-cols-2">
                {templates.map((template) => (
                    <Button
                        key={template.id}
                        type="button"
                        variant="outline"
                        onClick={() => onSelectTemplate(template.prompt ?? '')}
                        className="h-auto items-start justify-start gap-3 rounded-2xl border-border/50 px-4 py-3.5 text-left font-normal transition-all hover:bg-muted/40 hover:shadow-sm"
                    >
                        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60", template.iconColor)}>
                            {template.id === 'code' ? <IconCode className="w-4.5 h-4.5" /> :
                                template.id === 'write' ? <IconVectorBezier2 className="w-4.5 h-4.5" /> :
                                    template.id === 'debug' ? <IconActivity className="w-4.5 h-4.5" /> :
                                        <IconSearch className="w-4.5 h-4.5" />}
                        </div>
                        <div className="space-y-0.5">
                            <div className="text-sm font-medium text-foreground">{template.title}</div>
                            <div className="typo-caption leading-relaxed text-muted-foreground">{template.description}</div>
                        </div>
                    </Button>
                ))}
            </div>

            <RecentChatsSection t={t} />
        </div>
    );
};

const RecentChatsSection: React.FC<{ t: (key: string) => string }> = ({ t }) => {
    const allChats = useChatStore(s => s.chats);
    
    const recentChats = useMemo(() => {
        return [...allChats]
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .filter(chat => chat.messages.length > 0)
            .slice(0, 3);
    }, [allChats]);

    if (recentChats.length === 0) {
        return null;
    }

    return (
        <div className="mt-12 w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-4 flex items-center gap-2 px-1 text-muted-foreground">
                <IconHistory className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">{t('frontend.welcome.recentChats')}</span>
            </div>
            <div className="grid gap-2">
                {recentChats.map(chat => (
                    <button
                        key={chat.id}
                        onClick={() => setCurrentChatId(chat.id)}
                        className="group flex w-full items-center justify-between rounded-2xl border border-border/40 bg-muted/20 px-4 py-3 transition-all hover:bg-muted/40 hover:shadow-md"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:text-primary transition-colors">
                                <IconSearch className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col items-start min-w-0">
                                <span className="text-sm font-medium text-foreground truncate max-w-[400px]">{chat.title || t('frontend.chat.newChat')}</span>
                                <span className="typo-caption text-muted-foreground truncate">
                                    {chat.model} · {new Date(chat.updatedAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

