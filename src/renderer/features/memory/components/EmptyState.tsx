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
 * Empty State Component
 *
 * Displays an empty state when there are no items to display.
 */

import type { Icon } from '@tabler/icons-react';
import React from 'react';

/* Batch-02: Extracted Long Classes */
const C_EMPTYSTATE_1 = "flex flex-col items-center justify-center py-20 text-center gap-4 bg-muted/10 rounded-2xl border border-dashed border-border/30 sm:gap-5 lg:gap-6 sm:flex-row";


interface EmptyStateProps {
  icon: Icon;
  title: string;
  description: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
}) => (
  <div className={C_EMPTYSTATE_1}>
    <Icon className="w-12 h-12 text-muted-foreground/20" />
    <div className="space-y-1">
      <h3 className="font-bold text-muted-foreground">{title}</h3>
      <p className="typo-caption text-muted-foreground/50 max-w-xs">{description}</p>
    </div>
  </div>
);
