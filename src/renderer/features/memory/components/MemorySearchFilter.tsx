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
import { IconFilter, IconSearch } from '@tabler/icons-react';
import React from 'react';

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

import { CATEGORY_CONFIG } from './constants';

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
    onSearch,
}) => {
    const { t } = useTranslation();

    return (
        <section className="rounded-2xl border border-border/40 bg-card/80 p-4">
            <form onSubmit={onSearch} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem_auto] lg:items-end">
                <label className="grid gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        {t('frontend.memory.search')}
                    </span>
                    <div className="relative">
                        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                        <Input
                            placeholder={t('frontend.memory.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(event) => onSearchChange(event.target.value)}
                            className="pl-10"
                        />
                    </div>
                </label>

                <label className="grid gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        <IconFilter className="h-3.5 w-3.5" />
                        {t('frontend.memory.filter')}
                    </span>
                    <Select value={categoryFilter} onValueChange={(value) => onCategoryChange(value as MemoryCategory | 'all')}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('frontend.memory.allCategories')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('frontend.memory.allCategories')}</SelectItem>
                            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                                <SelectItem key={key} value={key}>
                                    <span className="flex items-center gap-2">
                                        <config.icon className="h-4 w-4" />
                                        {t(config.labelKey)}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </label>

                <div className="flex items-end">
                    <Button type="submit" variant="secondary" className="w-full lg:w-auto">
                        {t('common.search')}
                    </Button>
                </div>
            </form>
        </section>
    );
};
