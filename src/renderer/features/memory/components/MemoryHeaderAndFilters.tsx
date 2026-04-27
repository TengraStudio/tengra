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
import { IconPlus, IconRefresh, IconSearch, IconTrendingDown } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { CATEGORY_CONFIG } from './constants';

interface MemoryHeaderProps {
    isLoading: boolean;
    onRefresh: () => void;
    onRunDecay: () => void;
    onAddMemory: () => void;
}

export const MemoryHeader = ({
    isLoading,
    onRefresh,
    onRunDecay,
    onAddMemory,
}: MemoryHeaderProps) => {
    const { t } = useTranslation();
    return (
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold">{t('memory.title')}</h1>
                <p className="text-muted-foreground mt-1">{t('memory.subtitle')}</p>
            </div>
            <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
                    <IconRefresh className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                    {t('common.refresh')}
                </Button>
                <Button variant="outline" size="sm" onClick={onRunDecay} className="gap-2">
                    <IconTrendingDown className="w-4 h-4" />
                    {t('memory.runDecay')}
                </Button>
                <Button size="sm" onClick={onAddMemory} className="gap-2">
                    <IconPlus className="w-4 h-4" />
                    {t('memory.addAction')}
                </Button>
            </div>
        </div>
    );
};

interface MemoryFiltersProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    categoryFilter: MemoryCategory | 'all';
    setCategoryFilter: (filter: MemoryCategory | 'all') => void;
    onSearch: () => void;
}

export const MemoryFilters = ({
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    onSearch,
}: MemoryFiltersProps) => {
    const { t } = useTranslation();
    return (
        <div className="flex gap-4 items-center">
            <form
                onSubmit={e => {
                    e.preventDefault();
                    onSearch();
                }}
                className="flex gap-2 items-center flex-1"
            >
                <div className="relative flex-1 max-w-md">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                    <Input
                        placeholder={t('memory.searchPlaceholder')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-10 bg-muted/30 border-border/40"
                    />
                </div>
                <Button type="submit" variant="secondary">
                    {t('common.search')}
                </Button>
            </form>
            <Select
                value={categoryFilter}
                onValueChange={v => setCategoryFilter(v as MemoryCategory | 'all')}
            >
                <SelectTrigger className="w-44 bg-muted/30 border-border/40">
                    <SelectValue placeholder={t('memory.allCategories')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('memory.allCategories')}</SelectItem>
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
    );
};
