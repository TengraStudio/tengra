/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
    AdvancedSemanticFragment,
    PendingMemory
} from '@shared/types/advanced-memory';
import { type Icon,IconArchive, IconEdit, IconRefresh, IconSquare, IconSquareCheck, IconTrash } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import { memo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { CATEGORY_CONFIG } from './constants';

/* Batch-02: Extracted Long Classes */
const C_MEMORYSUBCOMPONENTS_1 = "flex flex-col items-center justify-center py-20 text-center space-y-4 bg-muted/10 rounded-2xl border border-dashed border-border/40 sm:flex-row";
const C_MEMORYSUBCOMPONENTS_2 = "group p-4 bg-muted/20 border-border/40 hover:bg-muted/30 transition-all hover:border-warning/40 relative overflow-hidden sm:p-5 lg:p-6";


export const StatCard = memo(({
    label,
    value,
    icon: Icon,
    color,
    highlight
}: {
    label: string;
    value: number | string;
    icon: Icon;
    color: string;
    highlight?: boolean;
}) => (
    <Card className={cn(
        "p-4 bg-muted/30 border-border/40 flex flex-col gap-1 transition-all",
        highlight && "border-primary/30 bg-primary/5"
    )}>
        <p className="text-sm font-bold text-muted-foreground/60">{label}</p>
        <div className="flex items-end gap-2">
            <span className="text-2xl font-bold">{value}</span>
            <Icon className={cn("w-4 h-4 mb-1", color)} />
        </div>
    </Card>
));
StatCard.displayName = 'StatCard';

export const EmptyState = memo(({
    icon: Icon,
    title,
    description
}: {
    icon: Icon;
    title: string;
    description: string;
}) => (
    <div className={C_MEMORYSUBCOMPONENTS_1}>
        <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
            <Icon className="w-8 h-8 text-muted-foreground/40" />
        </div>
        <div className="space-y-1">
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-sm text-muted-foreground max-w-64">{description}</p>
        </div>
    </div>
));
EmptyState.displayName = 'EmptyState';

export const PendingMemoryCard = memo(({
    memory,
    onConfirm,
    onReject
}: {
    memory: PendingMemory;
    onConfirm: () => void;
    onReject: () => void;
}) => {
    const { t } = useTranslation();
    const config = CATEGORY_CONFIG[memory.suggestedCategory];

    return (
        <Card className={C_MEMORYSUBCOMPONENTS_2}>
            <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{
                    background: `linear-gradient(to top,
                        hsl(${memory.extractionConfidence * 120}, 70%, 50%) 0%,
                        hsl(${memory.extractionConfidence * 120}, 70%, 50%) ${memory.extractionConfidence * 100}%,
                        transparent ${memory.extractionConfidence * 100}%)`
                }}
            />
            <div className="flex flex-col gap-3 pl-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Badge className={cn("border-none text-sm font-bold", config.color)}>
                            <config.icon className="w-3 h-3 mr-1" />
                            {t(config.labelKey)}
                        </Badge>
                        {memory.requiresUserValidation && (
                            <Badge variant="outline" className="border-warning/40 text-warning text-sm">
                                {t('memory.needsReview')}
                            </Badge>
                        )}
                    </div>
                </div>
                <p className="text-sm leading-relaxed">{memory.content}</p>
                <div className="flex items-center justify-between mt-2">
                    <button
                        type="button"
                        aria-label={t('memory.confirm')}
                        className="flex items-center gap-2 px-3 py-1 bg-success/10 text-success rounded-md typo-caption font-bold"
                        onClick={onConfirm}
                    >
                        {t('memory.confirm')}
                    </button>
                    <button
                        type="button"
                        aria-label={t('memory.reject')}
                        className="flex items-center gap-2 px-3 py-1 bg-destructive/10 text-destructive rounded-md typo-caption font-bold"
                        onClick={onReject}
                    >
                        {t('memory.reject')}
                    </button>
                </div>
            </div>
        </Card>
    );
});
PendingMemoryCard.displayName = 'PendingMemoryCard';

export const ConfirmedMemoryCard = memo(({
    memory,
    isSelected,
    onToggleSelect,
    onEdit,
    onDelete,
    onArchive,
    onRestore
}: {
    memory: AdvancedSemanticFragment;
    isSelected: boolean;
    onToggleSelect: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onArchive: () => void;
    onRestore: () => void;
}) => {
    const { t } = useTranslation();
    const config = CATEGORY_CONFIG[memory.category];
    const isArchived = memory.status === 'archived';

    return (
        <Card className={cn(
            "group p-4 transition-all relative overflow-hidden",
            isSelected ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-border/40 hover:bg-muted/30",
            isArchived && "opacity-60"
        )}>
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button type="button" aria-label={t('memory.select')} onClick={onToggleSelect}>
                            {isSelected ? <IconSquareCheck className="w-4 h-4 text-primary" /> : <IconSquare className="w-4 h-4 text-muted-foreground/30" />}
                        </button>
                        <Badge className={cn("border-none text-sm font-bold", config.color)}>
                            <config.icon className="w-3 h-3 mr-1" />
                            {t(config.labelKey)}
                        </Badge>
                    </div>
                </div>
                <p className="text-sm leading-relaxed">{memory.content}</p>
                <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">{t('memory.storedAgo', { time: formatDistanceToNow(new Date(memory.createdAt)) })}</div>
                    <div className="flex gap-1">
                        <Button variant="ghost" size="sm" aria-label={t('common.edit')} onClick={onEdit}><IconEdit className="w-4 h-4" /></Button>
                        {!isArchived ? <Button variant="ghost" size="sm" aria-label={t('memory.archive')} onClick={onArchive}><IconArchive className="w-4 h-4" /></Button> : <Button variant="ghost" size="sm" aria-label={t('memory.restore')} onClick={onRestore}><IconRefresh className="w-4 h-4" /></Button>}
                        <Button variant="ghost" size="sm" aria-label={t('common.delete')} onClick={onDelete} className="text-destructive"><IconTrash className="w-4 h-4" /></Button>
                    </div>
                </div>
            </div>
        </Card>
    );
});
ConfirmedMemoryCard.displayName = 'ConfirmedMemoryCard';
