/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconDownload, IconEraser, IconSearch, IconX } from '@tabler/icons-react';
import { memo, useEffect } from 'react';

import { useDebounce } from '@/hooks/useDebounce';

/* Batch-02: Extracted Long Classes */
const C_CHATHEADER_1 = "inline-flex h-7 items-center gap-1.5 rounded border border-border px-2 typo-caption font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground";
const C_CHATHEADER_2 = "w-full rounded border border-border bg-background pl-9 pr-7 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50";


interface ChatHeaderProps {
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    onClearMessages: () => void;
    onSearchChange?: (debouncedTerm: string) => void;
    contextTokens: number;
    contextWindow: number;
    t: (key: string) => string;
    onExport?: () => void;
}

/**
 * ChatHeader Component
 * 
 * Provides a search bar to filter messages within the current chat.
 * Uses debouncing to improve performance.
 */
export const ChatHeader = memo(({
    searchTerm,
    setSearchTerm,
    onClearMessages,
    onSearchChange,
    contextTokens,
    contextWindow,
    t,
    onExport
}: ChatHeaderProps) => {
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const normalizedUsedTokens = Math.max(0, contextTokens);
    const normalizedWindow = Math.max(1, contextWindow);
    const usagePercent = Math.min(100, Math.round((normalizedUsedTokens / normalizedWindow) * 100));

    useEffect(() => {
        if (onSearchChange) {
            onSearchChange(debouncedSearchTerm);
        }
    }, [debouncedSearchTerm, onSearchChange]);

    return (
        <div className="shrink-0 border-b border-border bg-background px-4 py-2.5">
            <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                    <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
                    <input
                        type="text"
                        placeholder={t('frontend.chat.searchMessages')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={C_CHATHEADER_2}
                        aria-label={t('frontend.chat.searchMessages')}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-foreground"
                            aria-label={t('common.clear')}
                        >
                            <IconX className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <button
                    onClick={onClearMessages}
                    className={C_CHATHEADER_1}
                    title={t('frontend.chat.clear')}
                    aria-label={t('frontend.chat.clear')}
                >
                    <IconEraser className="h-3.5 w-3.5" />
                    <span>{t('frontend.chat.clear')}</span>
                </button>
                {onExport && (
                    <button
                        onClick={onExport}
                        className={C_CHATHEADER_1}
                        title={t('frontend.chat.exportChat')}
                        aria-label={t('frontend.chat.exportChat')}
                    >
                        <IconDownload className="h-3.5 w-3.5" />
                        <span>{t('frontend.chat.exportChat')}</span>
                    </button>
                )}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground/80">
                <span>Context</span>
                <span>
                    {normalizedUsedTokens.toLocaleString()} / {normalizedWindow.toLocaleString()} ({usagePercent}%)
                </span>
            </div>
        </div>
    );
});
ChatHeader.displayName = 'ChatHeader';

