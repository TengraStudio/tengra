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
  <div className="flex flex-col items-center justify-center py-20 px-4 text-center gap-4 bg-muted/10 border border-dashed border-border/50 rounded-2xl">
    {icon && (
      <div className="text-muted-foreground/20">
        {icon}
      </div>
    )}
    <div className="flex flex-col gap-1">
      <h3 className="font-bold text-muted-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground/50 max-w-72 line-clamp-3">{description}</p>
      )}
    </div>
    {action && (
      <button
        onClick={action.onClick}
        className="mt-2 py-2 px-4 bg-primary/20 text-primary border border-primary/30 rounded-lg text-sm font-bold hover:bg-primary/30 transition-colors"
      >
        {action.label}
      </button>
    )}
  </div>
));

EmptyState.displayName = 'EmptyState';

