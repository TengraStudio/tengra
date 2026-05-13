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
 * Confirmed Memories List Component
 *
 * Displays list of confirmed memories with edit, delete, and archive controls.
 */

import { AdvancedSemanticFragment } from '@shared/types/advanced-memory';
import { IconArchive, IconCheck, IconCircleCheck, IconClock, IconEdit, IconGauge, IconHistory, IconRotate, IconShare2, IconSquare, IconSquareCheck, IconTag, IconTrash, IconX } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { CATEGORY_CONFIG } from './constants';
import { EmptyState } from './EmptyState';

interface ConfirmedMemoriesListProps {
  memories: AdvancedSemanticFragment[];
  selectedIds: Set<string>;
  isArchiveTab: boolean;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onEdit: (memory: AdvancedSemanticFragment) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onShowHistory: (id: string) => void;
  onShare: (id: string) => void;
  onArchiveSelected: () => void;
  onDeleteSelected: () => void;
}

export const ConfirmedMemoriesList: React.FC<ConfirmedMemoriesListProps> = ({
  memories,
  selectedIds,
  isArchiveTab,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
  onShowHistory,
  onShare,
  onArchiveSelected,
  onDeleteSelected,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Bulk actions */}
      {memories.length > 0 && (
        <div className="flex gap-2">
          {selectedIds.size > 0 ? (
            <>
              <span className="text-sm text-muted-foreground flex items-center">
                {t('frontend.memory.selectedCount', { count: selectedIds.size })}
              </span>
              <Button variant="ghost" size="sm" onClick={onClearSelection} className="gap-2">
                <IconX className="w-4 h-4" />
                {t('common.clear')}
              </Button>
              {!isArchiveTab && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onArchiveSelected}
                  className="gap-2"
                >
                  <IconArchive className="w-4 h-4" />
                  {t('frontend.memory.archive')}
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={onDeleteSelected}
                className="gap-2"
              >
                <IconTrash className="w-4 h-4" />
                {t('common.delete')}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={onSelectAll} className="gap-2">
              <IconSquareCheck className="w-4 h-4" />
              {t('common.selectAll')}
            </Button>
          )}
        </div>
      )}

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        {memories.length === 0 ? (
          <EmptyState
            icon={isArchiveTab ? IconArchive : IconCircleCheck}
            title={isArchiveTab ? t('frontend.memory.noArchivedTitle') : t('frontend.memory.noConfirmedTitle')}
            description={
              isArchiveTab
                ? t('frontend.memory.noArchivedDesc')
                : t('frontend.memory.noConfirmedDesc')
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 pb-6">
            {memories.map(memory => (
              <ConfirmedMemoryCard
                key={memory.id}
                memory={memory}
                isSelected={selectedIds.has(memory.id)}
                onToggleSelect={() => onToggleSelect(memory.id)}
                onEdit={() => onEdit(memory)}
                onDelete={() => onDelete(memory.id)}
                onArchive={() => onArchive(memory.id)}
                onRestore={() => onRestore(memory.id)}
                onShowHistory={() => onShowHistory(memory.id)}
                onShare={() => onShare(memory.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

interface ConfirmedMemoryCardProps {
  memory: AdvancedSemanticFragment;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onShowHistory: () => void;
  onShare: () => void;
}

const ConfirmedMemoryCard: React.FC<ConfirmedMemoryCardProps> = ({
  memory,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
  onShowHistory,
  onShare,
}) => {
  const { t } = useTranslation();
  const config = CATEGORY_CONFIG[memory.category];
  const sourceLabel = t(`frontend.memory.sources.${memory.source}`);
  const createdLabel = t('frontend.memory.storedAgo', {
    time: formatDistanceToNow(new Date(memory.createdAt)),
  });

  return (
    <Card
      className={cn(
        'rounded-xl border border-border/30 bg-card p-4 transition-colors hover:border-border/40',
        memory.status === 'archived' && 'opacity-60',
        isSelected && 'border-primary/40 bg-primary/5'
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleSelect}
              className="rounded-md border border-border/30 p-1.5 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              aria-label={t('frontend.memory.select')}
            >
              {isSelected ? <IconSquareCheck className="h-4 w-4 text-primary" /> : <IconSquare className="h-4 w-4" />}
            </button>
            <Badge variant="secondary" className={cn('text-xs font-medium', config.color)}>
              <config.icon className="mr-1 h-3 w-3" />
              {t(config.labelKey)}
            </Badge>
            {memory.status === 'archived' && (
              <Badge variant="secondary" className="text-xs font-medium">
                <IconArchive className="mr-1 h-3 w-3" />
                {t('frontend.memory.archived')}
              </Badge>
            )}
            {memory.validatedBy === 'user' && (
              <Badge variant="outline" className="border-success/30 text-xs font-medium text-success">
                <IconCheck className="mr-1 h-3 w-3" />
                {t('frontend.memory.userVerified')}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0" title={t('common.edit')}>
              <IconEdit className="h-4 w-4" />
            </Button>
            {memory.status === 'archived' ? (
              <Button variant="ghost" size="sm" onClick={onRestore} className="h-8 w-8 p-0" title={t('frontend.memory.restore')}>
                <IconRotate className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={onArchive} className="h-8 w-8 p-0" title={t('frontend.memory.archive')}>
                <IconArchive className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 text-destructive hover:text-destructive" title={t('common.delete')}>
              <IconTrash className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <p className="text-sm leading-6 text-foreground/90">{memory.content}</p>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border/40 bg-muted/20 px-2 py-1">
            {t('frontend.memory.source')}: {sourceLabel}
          </span>
          <span className="rounded-full border border-border/40 bg-muted/20 px-2 py-1">
            {createdLabel}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-border/30 pt-3">
          <div className="flex flex-wrap gap-1">
            {memory.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border/30 bg-muted/20 px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={onShowHistory} className="h-8 px-2 text-xs text-muted-foreground" title={t('frontend.memory.showHistory')}>
            <IconHistory className="mr-1 h-3.5 w-3.5" />
            {t('frontend.memory.showHistory')}
          </Button>
        </div>
      </div>
    </Card>
  );
};

