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
const C_CHATHEADER_1 = "inline-flex h-8 items-center gap-1.5 rounded-md border border-border/40 px-2.5 typo-caption font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground";
const C_CHATHEADER_2 = "w-full bg-foreground/5 border border-border/10 rounded-xl pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:border-primary/30 transition-all placeholder:text-muted-foreground/30";


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
        <div className="border-b border-border/50 bg-background/30 px-6 py-3 backdrop-blur-md shrink-0">
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-3">
                            <span className="truncate typo-body font-semibold text-muted-foreground/80">
                                Context Window
                            </span>
                            <span className="typo-body font-bold text-foreground/80">
                                {normalizedUsedTokens.toLocaleString()} / {normalizedWindow.toLocaleString()}
                            </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/45">
                            <div
                                className="h-full rounded-full bg-primary/80 transition-all duration-300"
                                style={{ width: `${usagePercent}%` }}
                            />
                        </div>
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
                            className="text-muted-foreground/50 hover:text-foreground transition-colors p-2"
                            title={t('frontend.chat.exportChat')}
                        >
                            <IconDownload className="w-5 h-5" />
                        </button>
                    )}
                </div>
                <div className="relative w-full">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-foreground text-muted-foreground/40"
                            aria-label={t('common.clear')}
                        >
                            <IconX className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});
ChatHeader.displayName = 'ChatHeader';

