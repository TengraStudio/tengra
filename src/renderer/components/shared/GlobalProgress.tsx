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
 * Global thin progress bar rendered at the top of the application window.
 * Supports multiple concurrent operations with smooth CSS transitions.
 */
import React, { useMemo } from 'react';

import { useTranslation } from '@/i18n';
import { type ProgressItem,useProgressStore } from '@/store/progress.store';


/** Aggregate multiple progress items into a single percentage. */
function aggregatePercent(items: ProgressItem[]): number {
  if (items.length === 0) {return 0;}
  const sum = items.reduce((acc, item) => acc + item.percent, 0);
  return Math.round(sum / items.length);
}

export const GlobalProgress: React.FC = () => {
  const { t } = useTranslation();
  const items = useProgressStore((s) => Array.from(s.items.values()));

  const activeItems = useMemo(
    () => items.filter((i) => i.status !== 'done'),
    [items]
  );

  if (activeItems.length === 0) {return null;}

  const percent = aggregatePercent(activeItems);
  const label =
    activeItems.length === 1
      ? activeItems[0].label
      : t('common.operationsInProgress', { count: activeItems.length });

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-1 w-full bg-transparent overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default GlobalProgress;

