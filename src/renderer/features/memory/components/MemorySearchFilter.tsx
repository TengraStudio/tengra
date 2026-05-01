/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MemoryCategory } from '@shared/types/advanced-memory';
import { safeJsonParse } from '@shared/utils/sanitize.util';
import { IconFilter, IconSearch } from '@tabler/icons-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useTranslation } from '@/i18n';
import { appLogger } from '@/utils/renderer-logger';

import { CATEGORY_CONFIG } from './constants';

/* Batch-02: Extracted Long Classes */
const C_MEMORYSEARCHFILTER_1 = "rounded-md border border-border/50 bg-muted/30 px-2 py-0.5 typo-caption text-muted-foreground transition hover:bg-muted/40 hover:text-foreground";


const MEMORY_SEARCH_HISTORY_KEY = 'memory-search-history';
const MAX_MEMORY_SEARCH_HISTORY = 8;

const getInitialSearchHistory = (): string[] => {
    if (typeof window === 'undefined') {
        return [];
    }
    try {
        const stored = window.localStorage.getItem(MEMORY_SEARCH_HISTORY_KEY);
        if (!stored) {
            return [];
        }
        const parsed = safeJsonParse<string[]>(stored, []);
        return parsed
            .filter((value): value is string => typeof value === 'string')
            .slice(0, MAX_MEMORY_SEARCH_HISTORY);
    } catch (error) {
        appLogger.error('MemorySearchFilter', 'Failed to read memory search history', error as Error);
        return [];
    }
};

interface MemorySearchFilterProps {
    searchQuery: string;
    categoryFilter: MemoryCategory | 'all';
    onSearchChange: (query: string) => void;
    onCategoryChange: (category: MemoryCategory | 'all') => void;
    onSearch: (e: React.FormEvent) => void;
}

export const MemorySearchFilter: React.FC<MemorySearchFilterProps> = ({
    searchQuery,
    categoryFilter,
    onSearchChange,
    onCategoryChange,
    onSearch
}) => {
    const { t } = useTranslation();
    const [searchHistory, setSearchHistory] = useState<string[]>(getInitialSearchHistory);

    useEffect(() => {
        try {
            window.localStorage.setItem(MEMORY_SEARCH_HISTORY_KEY, JSON.stringify(searchHistory));
        } catch (error) {
            appLogger.error('MemorySearchFilter', 'Failed to persist memory search history', error as Error);
        }
    }, [searchHistory]);

    const rememberSearch = useCallback((): void => {
        const normalizedQuery = searchQuery.trim();
        if (normalizedQuery.length < 2) {
            return;
        }
        setSearchHistory(previous => {
            const deduped = previous.filter(item => item.toLowerCase() !== normalizedQuery.toLowerCase());
            return [normalizedQuery, ...deduped].slice(0, MAX_MEMORY_SEARCH_HISTORY);
        });
    }, [searchQuery]);

    const handleSubmit = useCallback((event: React.FormEvent): void => {
        event.preventDefault();
        rememberSearch();
        onSearch(event);
    }, [onSearch, rememberSearch]);

    const clearSearchHistory = useCallback((): void => {
        setSearchHistory([]);
    }, []);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-4 items-center">
                <form onSubmit={handleSubmit} className="flex gap-2 items-center flex-1">
                    <div className="relative flex-1 max-w-md">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                        <Input
                            list="memory-search-suggestions"
                            placeholder={t('frontend.memory.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            onBlur={rememberSearch}
                            className="pl-10 bg-muted/30 border-border/40"
                        />
                        <datalist id="memory-search-suggestions">
                            {searchHistory.map(query => (
                                <option key={query} value={query} />
                            ))}
                        </datalist>
                    </div>
                    <Button type="submit" variant="secondary">{t('common.search')}</Button>
                </form>

                <div className="flex items-center gap-2">
                    <IconFilter className="w-4 h-4 text-muted-foreground" />
                    <Select value={categoryFilter} onValueChange={(v) => onCategoryChange(v as MemoryCategory | 'all')}>
                        <SelectTrigger className="w-44 bg-muted/30 border-border/40">
                            <SelectValue placeholder={t('frontend.memory.allCategories')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('frontend.memory.allCategories')}</SelectItem>
                            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                <SelectItem key={key} value={key}>
                                    <span className="flex items-center gap-2">
                                        <config.icon className="w-4 h-4" />
                                        {t(config.labelKey)}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {searchHistory.length > 0 && (
                <div className="flex items-center gap-2">
                    <span className="typo-caption text-muted-foreground">{t('common.search')}:</span>
                    <div className="flex flex-wrap gap-1">
                        {searchHistory.map(query => (
                            <button
                                key={query}
                                type="button"
                                className={C_MEMORYSEARCHFILTER_1}
                                onClick={() => onSearchChange(query)}
                            >
                                {query}
                            </button>
                        ))}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={clearSearchHistory}>
                        {t('common.clear')}
                    </Button>
                </div>
            )}
        </div>
    );
};
