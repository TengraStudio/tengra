import { MemoryCategory } from '@shared/types/advanced-memory';
import { Filter, Search } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
    onSearch
}) => (
    <div className="flex gap-4 items-center">
        <form onSubmit={onSearch} className="flex gap-2 items-center flex-1">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                <Input
                    placeholder="Search memories..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-10 bg-muted/30 border-white/5"
                />
            </div>
            <Button type="submit" variant="secondary">Search</Button>
        </form>

        <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={categoryFilter} onValueChange={(v) => onCategoryChange(v as MemoryCategory | 'all')}>
                <SelectTrigger className="w-[180px] bg-muted/30 border-white/5">
                    <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                                <config.icon className="w-4 h-4" />
                                {config.label}
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    </div>
);
