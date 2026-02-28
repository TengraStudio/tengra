/**
 * Global thin progress bar rendered at the top of the application window.
 * Supports multiple concurrent operations with smooth CSS transitions.
 */
import React, { useMemo } from 'react'
import { useTranslation } from '@/i18n'
import { useProgressStore, type ProgressItem } from '@/store/progress.store'

/** Aggregate multiple progress items into a single percentage. */
function aggregatePercent(items: ProgressItem[]): number {
  if (items.length === 0) return 0
  const sum = items.reduce((acc, item) => acc + item.percent, 0)
  return Math.round(sum / items.length)
}

export const GlobalProgress: React.FC = () => {
  const { t } = useTranslation()
  const items = useProgressStore((s) => Array.from(s.items.values()))

  const activeItems = useMemo(
    () => items.filter((i) => i.status !== 'done'),
    [items]
  )

  if (activeItems.length === 0) return null

  const percent = aggregatePercent(activeItems)
  const label =
    activeItems.length === 1
      ? activeItems[0].label
      : t('common.operationsInProgress', { count: activeItems.length })

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999]"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-[3px] w-full bg-transparent">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export default GlobalProgress
