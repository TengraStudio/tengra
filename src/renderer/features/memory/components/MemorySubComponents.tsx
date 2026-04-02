import {
    AdvancedSemanticFragment,
    PendingMemory
} from '@shared/types/advanced-memory';
import { formatDistanceToNow } from 'date-fns';
import { Archive, CheckSquare, Edit3, LucideIcon, RefreshCw, Square, Trash2 } from 'lucide-react';
import { memo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { CATEGORY_CONFIG } from './constants';

export const StatCard = memo(({
    label,
    value,
    icon: Icon,
    color,
    highlight
}: {
    label: string;
    value: number | string;
    icon: LucideIcon;
    color: string;
    highlight?: boolean;
}) => (
    <Card className={cn(
        "p-4 bg-muted/30 border-border/40 flex flex-col gap-1 transition-all",
        highlight && "border-primary/30 bg-primary/5"
    )}>
        <p className="text-xxs font-bold text-muted-foreground/60">{label}</p>
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
    icon: LucideIcon;
    title: string;
    description: string;
}) => (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-muted/10 rounded-2xl border border-dashed border-border/40">
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
        <Card className="group p-4 bg-muted/20 border-border/40 hover:bg-muted/30 transition-all hover:border-warning/40 relative overflow-hidden">
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
                        <Badge className={cn("border-none text-xxs  font-bold", config.color)}>
                            <config.icon className="w-3 h-3 mr-1" />
                            {t(config.labelKey)}
                        </Badge>
                        {memory.requiresUserValidation && (
                            <Badge variant="outline" className="border-warning/40 text-warning text-xxs">
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
                        className="flex items-center gap-2 px-3 py-1 bg-success/10 text-success rounded-md text-xs font-bold"
                        onClick={onConfirm}
                    >
                        {t('memory.confirm')}
                    </button>
                    <button
                        type="button"
                        aria-label={t('memory.reject')}
                        className="flex items-center gap-2 px-3 py-1 bg-destructive/10 text-destructive rounded-md text-xs font-bold"
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
                            {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground/30" />}
                        </button>
                        <Badge className={cn("border-none text-xxs  font-bold", config.color)}>
                            <config.icon className="w-3 h-3 mr-1" />
                            {t(config.labelKey)}
                        </Badge>
                    </div>
                </div>
                <p className="text-sm leading-relaxed">{memory.content}</p>
                <div className="flex items-center justify-between mt-4">
                    <div className="text-xxs text-muted-foreground">{t('memory.storedAgo', { time: formatDistanceToNow(new Date(memory.createdAt)) })}</div>
                    <div className="flex gap-1">
                        <Button variant="ghost" size="sm" aria-label={t('common.edit')} onClick={onEdit}><Edit3 className="w-4 h-4" /></Button>
                        {!isArchived ? <Button variant="ghost" size="sm" aria-label={t('memory.archive')} onClick={onArchive}><Archive className="w-4 h-4" /></Button> : <Button variant="ghost" size="sm" aria-label={t('memory.restore')} onClick={onRestore}><RefreshCw className="w-4 h-4" /></Button>}
                        <Button variant="ghost" size="sm" aria-label={t('common.delete')} onClick={onDelete} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                </div>
            </div>
        </Card>
    );
});
ConfirmedMemoryCard.displayName = 'ConfirmedMemoryCard';
