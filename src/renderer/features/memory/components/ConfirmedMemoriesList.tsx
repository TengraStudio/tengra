/**
 * Confirmed Memories List Component
 *
 * Displays list of confirmed memories with edit, delete, and archive controls.
 */

import { AdvancedSemanticFragment } from '@shared/types/advanced-memory';
import { formatDistanceToNow } from 'date-fns';
import {
  Archive,
  Check,
  CheckCircle,
  CheckSquare,
  Clock,
  Edit3,
  Gauge,
  RotateCcw,
  Square,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  onArchiveSelected,
  onDeleteSelected,
}) => {
  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Bulk actions */}
      {memories.length > 0 && (
        <div className="flex gap-2">
          {selectedIds.size > 0 ? (
            <>
              <span className="text-sm text-muted-foreground flex items-center">
                {selectedIds.size} selected
              </span>
              <Button variant="ghost" size="sm" onClick={onClearSelection} className="gap-2">
                <X className="w-4 h-4" />
                Clear
              </Button>
              {!isArchiveTab && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onArchiveSelected}
                  className="gap-2"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={onDeleteSelected}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={onSelectAll} className="gap-2">
              <CheckSquare className="w-4 h-4" />
              Select All
            </Button>
          )}
        </div>
      )}

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 gap-4 pb-6">
          {memories.length === 0 ? (
            <EmptyState
              icon={isArchiveTab ? Archive : CheckCircle}
              title={isArchiveTab ? 'No Archived Memories' : 'No Confirmed Memories'}
              description={
                isArchiveTab
                  ? 'Low-importance memories will be archived over time.'
                  : 'Confirm pending memories to see them here.'
              }
            />
          ) : (
            memories.map((memory) => (
              <ConfirmedMemoryCard
                key={memory.id}
                memory={memory}
                isSelected={selectedIds.has(memory.id)}
                onToggleSelect={() => onToggleSelect(memory.id)}
                onEdit={() => onEdit(memory)}
                onDelete={() => onDelete(memory.id)}
                onArchive={() => onArchive(memory.id)}
                onRestore={() => onRestore(memory.id)}
              />
            ))
          )}
        </div>
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
}

const ConfirmedMemoryCard: React.FC<ConfirmedMemoryCardProps> = ({
  memory,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
}) => {
  const config = CATEGORY_CONFIG[memory.category];

  return (
    <Card
      className={cn(
        'group p-4 bg-muted/20 border-white/5 hover:bg-muted/30 transition-all relative overflow-hidden',
        memory.status === 'archived' && 'opacity-60',
        isSelected && 'border-primary/50 bg-primary/5'
      )}
    >
      {/* Importance indicator */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-t from-primary/20 to-primary"
        style={{ opacity: memory.importance }}
      />

      <div className="flex flex-col gap-2 pl-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Selection checkbox */}
            <button
              onClick={onToggleSelect}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 text-primary" />
              ) : (
                <Square className="w-4 h-4 text-muted-foreground/50" />
              )}
            </button>

            <Badge className={cn('border-none text-[10px] uppercase font-bold', config.color)}>
              <config.icon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
            {memory.status === 'archived' && (
              <Badge variant="secondary" className="text-[10px]">
                <Archive className="w-3 h-3 mr-1" />
                Archived
              </Badge>
            )}
            {memory.validatedBy === 'user' && (
              <Badge variant="outline" className="border-success/30 text-success text-[10px]">
                <Check className="w-3 h-3 mr-1" />
                User Verified
              </Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-7 w-7 p-0"
              title="Edit"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </Button>
            {memory.status === 'archived' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRestore}
                className="h-7 w-7 p-0"
                title="Restore"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onArchive}
                className="h-7 w-7 p-0"
                title="Archive"
              >
                <Archive className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <p className="text-sm leading-relaxed">{memory.content}</p>

        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Gauge className="w-3 h-3" />
            Importance: {(memory.importance * 100).toFixed(0)}%
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Confidence: {(memory.confidence * 100).toFixed(0)}%
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Accessed: {memory.accessCount}x
          </span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex flex-wrap gap-1">
            {memory.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-muted-foreground"
              >
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground/50">
            {formatDistanceToNow(new Date(memory.createdAt))} ago • {memory.source}
          </span>
        </div>
      </div>
    </Card>
  );
};
