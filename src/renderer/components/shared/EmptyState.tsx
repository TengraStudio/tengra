/**
 * Reusable Empty State Component
 *
 * Displays a centered empty state with optional icon, title, description, and action button.
 * Title and description should be passed as already-translated strings.
 */

import React, { memo } from 'react';

/** Props for the EmptyState component */
interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  /** Optional icon element displayed above the title */
  icon?: React.ReactNode;
  /** Primary message (should be pre-translated) */
  title: string;
  /** Secondary explanatory text (should be pre-translated) */
  description?: string;
  /** Optional call-to-action button */
  action?: EmptyStateAction;
}

/**
 * A reusable empty state component for when there are no items to display.
 * Renders a centered layout with an optional icon, title, description, and action button.
 */
export const EmptyState: React.FC<EmptyStateProps> = memo(({
  icon,
  title,
  description,
  action,
}) => (
  <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-muted/10 rounded-2xl border border-dashed border-border/50">
    {icon && (
      <div className="text-muted-foreground/20">
        {icon}
      </div>
    )}
    <div className="space-y-1">
      <h3 className="font-bold text-muted-foreground">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground/50 max-w-72">{description}</p>
      )}
    </div>
    {action && (
      <button
        onClick={action.onClick}
        className="mt-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-xs font-bold transition-all border border-primary/30"
      >
        {action.label}
      </button>
    )}
  </div>
));

EmptyState.displayName = 'EmptyState';
