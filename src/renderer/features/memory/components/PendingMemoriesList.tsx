/**
 * Pending Memories List Component
 *
 * Displays list of pending memories with validation controls and bulk actions.
 */

import { PendingMemory } from '@shared/types/advanced-memory';
import { formatDistanceToNow } from 'date-fns';
import { Check, ChevronDown, Clock, Gauge, Lightbulb, Sparkles, Tag, X } from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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
            <Check className="w-4 h-4" />
            Confirm All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void onRejectAll()}
            disabled={isLoading}
            className="gap-2 text-destructive hover:text-destructive"
          >
            <X className="w-4 h-4" />
            Reject All
          </Button>
        </div>
      )}

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-1 gap-4 pb-6">
          {memories.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No Pending Memories"
              description="Extracted facts will appear here for your validation."
            />
          ) : (
            memories.map((memory) => (
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
  const [expanded, setExpanded] = useState(false);
  const config = CATEGORY_CONFIG[memory.suggestedCategory];

  return (
    <Card className="group p-4 bg-muted/20 border-white/5 hover:bg-muted/30 transition-all hover:border-yellow/30 relative overflow-hidden">
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
            <Badge className={cn('border-none text-[10px] uppercase font-bold', config.color)}>
              <config.icon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
            {memory.requiresUserValidation && (
              <Badge variant="outline" className="border-yellow/30 text-yellow text-[10px]">
                Needs Review
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
              <X className="w-4 h-4" />
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onConfirm}
              className="h-8 px-3 gap-1"
            >
              <Check className="w-4 h-4" />
              Confirm
            </Button>
          </div>
        </div>

        {/* Content */}
        <p className="text-sm leading-relaxed">{memory.content}</p>

        {/* Scores */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Gauge className="w-3 h-3" />
            Confidence: {(memory.extractionConfidence * 100).toFixed(0)}%
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Relevance: {(memory.relevanceScore * 100).toFixed(0)}%
          </span>
          <span className="flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            Novelty: {(memory.noveltyScore * 100).toFixed(0)}%
          </span>
        </div>

        {/* Expandable details */}
        {(memory.potentialContradictions.length > 0 || memory.similarMemories.length > 0) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
            {memory.potentialContradictions.length > 0 && (
              <span className="text-orange">
                {memory.potentialContradictions.length} potential contradiction(s)
              </span>
            )}
            {memory.similarMemories.length > 0 && (
              <span className="text-primary">
                {memory.similarMemories.length} similar memor
                {memory.similarMemories.length === 1 ? 'y' : 'ies'}
              </span>
            )}
          </button>
        )}

        {expanded && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            {memory.potentialContradictions.map((c, i) => (
              <div key={i} className="p-2 rounded bg-orange/10 text-[11px]">
                <span className="text-orange font-bold">Contradiction: </span>
                <span className="text-muted-foreground">{c.existingContent}</span>
                <p className="mt-1 text-orange-300/70 italic">{c.conflictExplanation}</p>
              </div>
            ))}
            {memory.similarMemories.map((s, i) => (
              <div key={i} className="p-2 rounded bg-primary/10 text-[11px]">
                <span className="text-primary font-bold">
                  Similar ({(s.similarityScore * 100).toFixed(0)}%):{' '}
                </span>
                <span className="text-muted-foreground">{s.content}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tags & Meta */}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {memory.suggestedTags.map((tag) => (
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
            {formatDistanceToNow(new Date(memory.extractedAt))} ago
          </span>
        </div>
      </div>
    </Card>
  );
};
