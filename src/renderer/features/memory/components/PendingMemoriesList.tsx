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
import { IconCheck, IconClock, IconX } from '@tabler/icons-react';
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
        <div className="flex h-full min-h-0 flex-col gap-4">
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
            <ScrollArea className="flex-1 min-h-0">
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
    const config = CATEGORY_CONFIG[memory.suggestedCategory];
    const sourceLabel = t(`frontend.memory.sources.${memory.source}`);
    const extractedLabel = t('frontend.memory.storedAgo', {
        time: formatDistanceToNow(new Date(memory.extractedAt)),
    });

    return (
        <Card className={cn(
            'rounded-xl border border-border/30 bg-card p-4 transition-colors hover:border-border/40'
        )}>
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className={cn('text-xs font-medium', config.color)}>
                            <config.icon className="mr-1 h-3 w-3" />
                            {t(config.labelKey)}
                        </Badge>
                        {memory.requiresUserValidation && (
                            <span className="text-xs text-muted-foreground">
                                {t('frontend.memory.needsReview')}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onReject}
                            className="h-8 px-2 text-destructive hover:text-destructive"
                        >
                            <IconX className="h-4 w-4" />
                            <span className="sr-only">{t('frontend.memory.reject')}</span>
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={onConfirm}
                            className="h-8 px-3 gap-1"
                        >
                            <IconCheck className="h-4 w-4" />
                            {t('frontend.memory.confirm')}
                        </Button>
                    </div>
                </div>

                <p className="text-sm leading-6 text-foreground/90">{memory.content}</p>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border/30 bg-muted/20 px-2 py-1">
                        {t('frontend.memory.source')}: {sourceLabel}
                    </span>
                    <span className="rounded-full border border-border/30 bg-muted/20 px-2 py-1">
                        {extractedLabel}
                    </span>
                </div>
            </div>
        </Card>
    );
};

