/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Pending Memories List Component
 *
 * Displays list of pending memories with validation controls and bulk actions.
 */

import { PendingMemory } from '@shared/types/advanced-memory';
import { IconBulb, IconCheck, IconChevronDown, IconClock, IconGauge, IconSparkles, IconTag, IconX } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { CATEGORY_CONFIG } from './constants';
import { EmptyState } from './EmptyState';

/* Batch-02: Extracted Long Classes */
const C_PENDINGMEMORIESLIST_1 = "group p-4 bg-muted/20 border-border/40 hover:bg-muted/30 transition-all hover:border-warning/40 relative overflow-hidden sm:p-5 lg:p-6";


interface PendingMemoriesListProps {
    memories: PendingMemory[];
    isLoading: boolean;
    onConfirmAll: () => void;
    onRejectAll: () => void;
    onConfirm: (id: string) => void;
    onReject: (id: string) => void;
}

export const PendingMemoriesList: React.FC<PendingMemoriesListProps> = ({
    memories,
    isLoading,
    onConfirmAll,
    onRejectAll,
    onConfirm,
    onReject,
}) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-4 h-full">
            {/* Bulk actions */}
            {memories.length > 0 && (
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void onConfirmAll()}
                        disabled={isLoading}
                        className="gap-2"
                    >
                        <IconCheck className="w-4 h-4" />
                        {t('frontend.memory.confirmAll')}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void onRejectAll()}
                        disabled={isLoading}
                        className="gap-2 text-destructive hover:text-destructive"
                    >
                        <IconX className="w-4 h-4" />
                        {t('frontend.memory.rejectAll')}
                    </Button>
                </div>
            )}

            {/* List */}
            <ScrollArea className="flex-1">
                <div className="grid grid-cols-1 gap-4 pb-6">
                    {memories.length === 0 ? (
                        <EmptyState
                            icon={IconClock}
                            title={t('frontend.memory.noPendingTitle')}
                            description={t('frontend.memory.noPendingDesc')}
                        />
                    ) : (
                        memories.map(memory => (
                            <PendingMemoryCard
                                key={memory.id}
                                memory={memory}
                                onConfirm={() => onConfirm(memory.id)}
                                onReject={() => onReject(memory.id)}
                            />
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

interface PendingMemoryCardProps {
    memory: PendingMemory;
    onConfirm: () => void;
    onReject: () => void;
}

const PendingMemoryCard: React.FC<PendingMemoryCardProps> = ({ memory, onConfirm, onReject }) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const config = CATEGORY_CONFIG[memory.suggestedCategory];

    return (
        <Card className={C_PENDINGMEMORIESLIST_1}>
            {/* Confidence indicator */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{
                    background: `linear-gradient(to top,
            hsl(${memory.extractionConfidence * 120}, 70%, 50%) 0%,
            hsl(${memory.extractionConfidence * 120}, 70%, 50%) ${memory.extractionConfidence * 100}%,
            transparent ${memory.extractionConfidence * 100}%)`,
                }}
            />

            <div className="flex flex-col gap-3 pl-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Badge
                            className={cn('border-none text-sm font-bold', config.color)}
                        >
                            <config.icon className="w-3 h-3 mr-1" />
                            {t(config.labelKey)}
                        </Badge>
                        {memory.requiresUserValidation && (
                            <Badge
                                variant="outline"
                                className="border-warning/40 text-warning text-sm"
                            >
                                {t('frontend.memory.needsReview')}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onReject}
                            className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                            <IconX className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={onConfirm}
                            className="h-8 px-3 gap-1"
                        >
                            <IconCheck className="w-4 h-4" />
                            {t('frontend.memory.confirm')}
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <p className="text-sm leading-relaxed">{memory.content}</p>

                {/* Scores */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <IconGauge className="w-3 h-3" />
                        {t('frontend.memory.confidence', {
                            percent: (memory.extractionConfidence * 100).toFixed(0),
                        })}
                    </span>
                    <span className="flex items-center gap-1">
                        <IconSparkles className="w-3 h-3" />
                        {t('frontend.memory.relevance', {
                            percent: (memory.relevanceScore * 100).toFixed(0),
                        })}
                    </span>
                    <span className="flex items-center gap-1">
                        <IconBulb className="w-3 h-3" />
                        {t('frontend.memory.novelty', { percent: (memory.noveltyScore * 100).toFixed(0) })}
                    </span>
                </div>

                {/* Expandable details */}
                {(memory.potentialContradictions.length > 0 ||
                    memory.similarMemories.length > 0) && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <IconChevronDown
                            className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')}
                        />
                        {memory.potentialContradictions.length > 0 && (
                            <span className="text-warning">
                                {memory.potentialContradictions.length === 1
                                    ? t('frontend.memory.potentialContradiction', {
                                          count: memory.potentialContradictions.length,
                                      })
                                    : t('frontend.memory.potentialContradictions', {
                                          count: memory.potentialContradictions.length,
                                      })}
                            </span>
                        )}
                        {memory.similarMemories.length > 0 && (
                            <span className="text-primary">
                                {memory.similarMemories.length === 1
                                    ? t('frontend.memory.similarMemory', {
                                          count: memory.similarMemories.length,
                                      })
                                    : t('frontend.memory.similarMemories', {
                                          count: memory.similarMemories.length,
                                      })}
                            </span>
                        )}
                    </button>
                )}

                {expanded && (
                    <div className="space-y-2 pt-2 border-t border-border/40">
                        {memory.potentialContradictions.map((c, i) => (
                            <div key={i} className="p-2 rounded bg-warning/10 text-sm">
                                <span className="text-warning font-bold">
                                    {t('frontend.memory.contradictionLabel')}
                                </span>
                                <span className="text-muted-foreground">{c.existingContent}</span>
                                <p className="mt-1 text-warning-light/70">
                                    {c.conflictExplanation}
                                </p>
                            </div>
                        ))}
                        {memory.similarMemories.map((s, i) => (
                            <div key={i} className="p-2 rounded bg-primary/10 text-sm">
                                <span className="text-primary font-bold">
                                    {t('frontend.memory.similarLabel', {
                                        percent: (s.similarityScore * 100).toFixed(0),
                                    })}{' '}
                                </span>
                                <span className="text-muted-foreground">{s.content}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tags & Meta */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                        {memory.suggestedTags.map(tag => (
                            <span
                                key={tag}
                                className="flex items-center gap-1 text-sm bg-muted/30 px-2 py-0.5 rounded-full text-muted-foreground"
                            >
                                <IconTag className="w-3 h-3" />
                                {tag}
                            </span>
                        ))}
                    </div>
                    <span className="text-sm text-muted-foreground/50">
                        {t('frontend.memory.timeAgo', {
                            time: formatDistanceToNow(new Date(memory.extractedAt)),
                        })}
                    </span>
                </div>
            </div>
        </Card>
    );
};

