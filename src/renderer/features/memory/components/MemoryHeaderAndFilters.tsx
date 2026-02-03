import { MemoryCategory } from '@shared/types/advanced-memory';
import { Plus, RefreshCw, Search, TrendingDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

import { CATEGORY_CONFIG } from './MemorySubComponents';

interface MemoryHeaderProps {
    isLoading: boolean;
    onRefresh: () => void;
    onRunDecay: () => void;
    onAddMemory: () => void;
}

export const MemoryHeader = ({ isLoading, onRefresh, onRunDecay, onAddMemory }: MemoryHeaderProps) => (
    <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Advanced Memory
            </h1>
            <p className="text-muted-foreground mt-1">
                Intelligent memory with validation, decay, and context-aware recall.
            </p>
        </div>
        <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={onRunDecay} className="gap-2">
                <TrendingDown className="w-4 h-4" />
                Run Decay
            </Button>
            <Button size="sm" onClick={onAddMemory} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Memory
            </Button>
        </div>
    </div>
);

interface MemoryFiltersProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    categoryFilter: MemoryCategory | 'all';
    setCategoryFilter: (filter: MemoryCategory | 'all') => void;
    onSearch: () => void;
}

export const MemoryFilters = ({ searchQuery, setSearchQuery, categoryFilter, setCategoryFilter, onSearch }: MemoryFiltersProps) => (
    <div className="flex gap-4 items-center">
        <form onSubmit={(e) => { e.preventDefault(); onSearch(); }} className="flex gap-2 items-center flex-1">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                <Input placeholder="Search memories..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-muted/30 border-white/5" />
            </div>
            <Button type="submit" variant="secondary">Search</Button>
        </form>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as MemoryCategory | 'all')}>
            <SelectTrigger className="w-[180px] bg-muted/30 border-white/5">
                <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2"><config.icon className="w-4 h-4" />{config.label}</span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    </div>
);
