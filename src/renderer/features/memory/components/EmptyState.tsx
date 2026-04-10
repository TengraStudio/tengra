/**
 * Empty State Component
 *
 * Displays an empty state when there are no items to display.
 */

import { LucideIcon } from 'lucide-react';
import React from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
}) => (
  <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-muted/10 rounded-2xl border border-dashed border-border/30">
    <Icon className="w-12 h-12 text-muted-foreground/20" />
    <div className="space-y-1">
      <h3 className="font-bold text-muted-foreground">{title}</h3>
      <p className="typo-caption text-muted-foreground/50 max-w-xs">{description}</p>
    </div>
  </div>
);
