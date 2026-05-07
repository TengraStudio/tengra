/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconSearch, IconX } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/* Batch-02: Extracted Long Classes */
const C_SETTINGSSEARCH_1 = "mb-6 sticky top-0 z-20 bg-background/95 backdrop-blur-md pb-6 pt-2 border-b border-border/40 transition-all duration-300";
const C_SETTINGSSEARCH_2 = "absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-colors group-focus-within:text-primary text-muted-foreground/60";
const C_SETTINGSSEARCH_3 = "w-full pl-11 pr-11 py-6 bg-muted/30 border-border/40 rounded-2xl text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/20 focus-visible:border-primary/40 transition-all shadow-sm hover:bg-muted/40";
const C_SETTINGSSEARCH_4 = "absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 rounded-xl transition-all";
const C_SETTINGSSEARCH_5 = "inline-flex items-center px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-sm font-bold text-primary/80 shadow-xs";


interface SettingsSearchProps {
    searchQuery: string;
    setSearchQuery: (s: string) => void;
    t: (key: string, options?: Record<string, string | number>) => string;
    filteredTabsCount: number;
}

export const SettingsSearch: React.FC<SettingsSearchProps> = ({
    searchQuery,
    setSearchQuery,
    t,
    filteredTabsCount,
}) => {
    return (
        <div className={C_SETTINGSSEARCH_1}>
            <div className="relative group max-w-2xl mx-auto">
                <div className={C_SETTINGSSEARCH_2}>
                    <IconSearch className="w-4.5 h-4.5" />
                </div>
                <Input
                    type="text"
                    placeholder={t('frontend.settings.searchPlaceholder')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className={C_SETTINGSSEARCH_3}
                    aria-label={t('frontend.settings.searchPlaceholder')}
                    autoComplete="off"
                    autoFocus
                />
                {searchQuery && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSearchQuery('')}
                        className={C_SETTINGSSEARCH_4}
                        aria-label={t('common.clear')}
                    >
                        <IconX className="w-4 h-4" />
                    </Button>
                )}
            </div>
            {searchQuery && (
                <div className="mt-4 text-center animate-in fade-in slide-in-from-top-1 duration-200">
                    <span className={C_SETTINGSSEARCH_5}>
                        {filteredTabsCount > 0
                            ? t('frontend.settings.searchResults', { count: filteredTabsCount })
                            : t('frontend.settings.noResults')}
                    </span>
                </div>
            )}
        </div>
    );
};

