import { AdvancedSemanticFragment } from '@shared/types/advanced-memory';
import { EpisodicMemory } from '@shared/types/memory';
import { format } from 'date-fns';
import { Brain, History, MessageSquare } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n';

import { appLogger } from '../../../utils/renderer-logger';

interface TimelineItem {
    id: string;
    type: 'episode' | 'fragment';
    timestamp: number;
    title: string;
    content: string;
    tags: string[];
    importance?: number;
    category?: string;
}

export const MemoryTimelineView: React.FC = () => {
    const { t } = useTranslation();
    const [items, setItems] = useState<TimelineItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'episode' | 'fragment'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [fragmentsRes, episodesRes] = await Promise.all([
                window.electron.advancedMemory.getAllAdvancedMemories(),
                window.electron.advancedMemory.getAllEpisodes()
            ]);

            const timelineItems: TimelineItem[] = [];

            if (fragmentsRes.success && fragmentsRes.data) {
                fragmentsRes.data.forEach((m: AdvancedSemanticFragment) => {
                    if (m.status === 'confirmed') {
                        timelineItems.push({
                            id: m.id,
                            type: 'fragment',
                            timestamp: m.createdAt,
                            title: m.category,
                            content: m.content,
                            tags: m.tags,
                            importance: m.importance,
                            category: m.category
                        });
                    }
                });
            }

            if (episodesRes.success && episodesRes.data) {
                episodesRes.data.forEach((e: EpisodicMemory) => {
                    timelineItems.push({
                        id: e.id,
                        type: 'episode',
                        timestamp: e.startDate || e.createdAt,
                        title: e.title,
                        content: e.summary,
                        tags: e.participants || [],
                    });
                });
            }

            // Sort by timestamp descending
            setItems(timelineItems.sort((a, b) => b.timestamp - a.timestamp));
        } catch (error) {
            appLogger.error('MemoryTimelineView', 'Failed to load timeline data', error as Error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const filteredItems = useMemo(() => {
        const normalized = searchQuery.trim().toLowerCase();
        return items.filter(item => {
            if (filter !== 'all' && item.type !== filter) {
                return false;
            }
            if (!normalized) {
                return true;
            }
            return (
                item.title.toLowerCase().includes(normalized)
                || item.content.toLowerCase().includes(normalized)
                || item.tags.some(tag => tag.toLowerCase().includes(normalized))
            );
        });
    }, [items, filter, searchQuery]);

    const groupedItems = useMemo(() => {
        const groups: Record<string, TimelineItem[]> = {};
        filteredItems.forEach(item => {
            const dateKey = format(item.timestamp, 'yyyy-MM-dd');
            if (!groups[dateKey]) { groups[dateKey] = []; }
            groups[dateKey].push(item);
        });
        return groups;
    }, [filteredItems]);

    return (
        <div className="w-full h-full flex flex-col bg-background/30 rounded-2xl border border-border/30 overflow-hidden">
            <div className="p-4 border-b border-border/30 flex items-center justify-between bg-muted/20 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-info/20 rounded-xl text-info">
                        <History className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold">{t('memory.timelineView')}</h2>
                        <p className="typo-caption text-muted-foreground">
                            {t('memory.timelineTotalEvents', { count: items.length })}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Input
                        value={searchQuery}
                        onChange={event => setSearchQuery(event.target.value)}
                        placeholder={t('memory.searchPlaceholder')}
                        className="h-8 w-48 bg-background/50 border-border/50"
                    />
                    <div className="flex bg-background/50 p-1 rounded-lg border border-border/50">
                        {(['all', 'episode', 'fragment'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1 rounded-md text-xxxs font-bold  transition-all ${filter === f ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {f === 'all'
                                    ? t('memory.timelineFilterAll')
                                    : f === 'episode'
                                        ? t('memory.timelineFilterEpisode')
                                        : t('memory.timelineFilterFragment')}
                            </button>
                        ))}
                    </div>
                    {(filter !== 'all' || searchQuery.trim()) && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setFilter('all');
                                setSearchQuery('');
                            }}
                        >
                            {t('common.clear')}
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-8 scrollbar-hide">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="typo-caption text-muted-foreground">{t('memory.timelineReconstructing')}</span>
                    </div>
                ) : (
                    Object.keys(groupedItems).length === 0 ? (
                        <div className="flex h-full items-center justify-center">
                            <p className="rounded-lg border border-border/40 bg-background/70 px-4 py-2 text-sm text-muted-foreground">
                                {t('memory.emptyState')}
                            </p>
                        </div>
                    ) : (
                        <div className="relative border-l border-border/40 ml-4 space-y-12">
                            {Object.entries(groupedItems).map(([date, dayItems]) => (
                                <div key={date} className="relative">
                                {/* Date Marker */}
                                <div className="absolute -left-14 top-0 flex items-center gap-4">
                                    <div className="w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/20 shadow-md" />
                                    <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary typo-caption font-bold whitespace-nowrap">
                                        {format(new Date(date), 'MMMM d, yyyy')}
                                    </div>
                                </div>

                                <div className="pt-8 space-y-6">
                                    {dayItems.map(item => (
                                        <div key={item.id} className="group relative transition-all hover:translate-x-1">
                                            <div className="absolute -left-10 top-2 w-3 h-px bg-border/60 group-hover:bg-primary/40 group-hover:w-5 transition-all" />

                                            <div className="bg-muted/20 border border-border/30 hover:border-border/60 rounded-2xl p-4 transition-all hover:bg-muted/30 shadow-sm hover:shadow-xl">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        {item.type === 'episode' ? (
                                                            <div className="p-1.5 bg-warning/20 rounded-lg text-warning">
                                                                <MessageSquare className="w-3.5 h-3.5" />
                                                            </div>
                                                        ) : (
                                                            <div className="p-1.5 bg-accent/20 rounded-lg text-accent">
                                                                <Brain className="w-3.5 h-3.5" />
                                                            </div>
                                                        )}
                                                        <span className="typo-caption font-bold text-foreground/60">
                                                            {item.title}
                                                        </span>
                                                    </div>
                                                    <span className="typo-caption text-muted-foreground font-mono">
                                                        {format(item.timestamp, 'HH:mm')}
                                                    </span>
                                                </div>

                                                <p className="text-sm text-foreground/80 leading-relaxed mb-3">
                                                    {item.content}
                                                </p>

                                                <div className="flex flex-wrap gap-1.5">
                                                    {item.tags.map(tag => (
                                                        <span key={tag} className="px-2 py-0.5 rounded-md bg-muted/30 typo-caption text-muted-foreground border border-border/30">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
};
