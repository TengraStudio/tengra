/**
 * Tab Navigation Component
 *
 * Renders the tab navigation for switching between pending, confirmed, archived memories and stats.
 */

import { Archive, CheckCircle, Clock, Gauge, LayoutGrid } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import React from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

type TabType = 'pending' | 'confirmed' | 'archived' | 'stats' | 'visualization';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  pendingCount: number;
  confirmedCount: number;
  archivedCount: number;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
  pendingCount,
  confirmedCount,
  archivedCount,
}) => {
  const { t } = useTranslation();
  const tabs: Array<{
    id: TabType;
    label: string;
    icon: LucideIcon;
    count?: number;
  }> = [
      { id: 'pending', label: t('memory.tabs.pending'), icon: Clock, count: pendingCount },
      { id: 'confirmed', label: t('memory.tabs.confirmed'), icon: CheckCircle, count: confirmedCount },
      { id: 'archived', label: t('memory.tabs.archived'), icon: Archive, count: archivedCount },
      { id: 'visualization', label: t('memory.tabs.visualization'), icon: LayoutGrid },
      { id: 'stats', label: t('memory.tabs.stats'), icon: Gauge },
    ];

  return (
    <div className="flex gap-1 p-1 bg-muted/30 rounded-lg w-fit border border-border/40">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2',
            activeTab === tab.id
              ? 'bg-primary text-primary-foreground shadow-lg'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
          )}
        >
          <tab.icon className="w-4 h-4" />
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span
              className={cn(
                'ml-1 px-1.5 py-0.5 rounded-full text-xxs font-bold',
                activeTab === tab.id ? 'bg-muted/50' : 'bg-primary/20 text-primary'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};
