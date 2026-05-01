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
 * Stats Panel Component
 *
 * Displays detailed memory statistics and health metrics.
 */

import { AdvancedMemoryHealthSummary, MemoryCategory, MemoryStatistics } from '@shared/types/advanced-memory';
import { IconGauge, IconSparkles, IconTag } from '@tabler/icons-react';
import React from 'react';

import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { CATEGORY_CONFIG } from './constants';

interface StatsPanelProps {
  stats: MemoryStatistics;
  health?: AdvancedMemoryHealthSummary | null;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, health }) => (
  <StatsPanelContent stats={stats} health={health} />
);

const StatsPanelContent = ({
  stats,
  health
}: {
  stats: MemoryStatistics;
  health?: AdvancedMemoryHealthSummary | null;
}) => {
  const { t } = useTranslation();
  const memoryContext = health?.memoryContext;
  const hitRate = memoryContext && memoryContext.lookupCount > 0
    ? (memoryContext.cacheHits / memoryContext.lookupCount) * 100
    : 0;
  return (
    <div className="space-y-6">
      {/* By Category */}
      <Card className="p-6 bg-muted/20 border-border/40">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
          <IconTag className="w-4 h-4 text-primary" />
          {t('frontend.memory.stats.memoriesByCategory')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats.byCategory).map(([category, count]) => {
            const config = CATEGORY_CONFIG[category as MemoryCategory];
            return (
              <div key={category} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <config.icon className={cn('w-5 h-5', config.color.split(' ')[1])} />
                <div>
                  <p className="text-sm font-medium">{t(config.labelKey)}</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* By Source */}
      <Card className="p-6 bg-muted/20 border-border/40">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
          <IconSparkles className="w-4 h-4 text-primary" />
          {t('frontend.memory.stats.memoriesBySource')}
        </h3>
        <div className="space-y-2">
          {Object.entries(stats.bySource).map(([source, count]) => (
            <div key={source} className="flex items-center justify-between p-2 rounded bg-muted/30">
              <span className="text-sm capitalize">{source.replace(/_/g, ' ')}</span>
              <span className="font-bold">{count}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Health Metrics */}
      <Card className="p-6 bg-muted/20 border-border/40">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
          <IconGauge className="w-4 h-4 text-primary" />
          {t('frontend.memory.stats.healthMetrics')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label={t('frontend.memory.stats.avgConfidence')}
            value={`${(stats.averageConfidence * 100).toFixed(1)}%`}
          />
          <MetricCard
            label={t('frontend.memory.stats.avgImportance')}
            value={`${(stats.averageImportance * 100).toFixed(1)}%`}
          />
          <MetricCard
            label={t('frontend.memory.stats.recentlyAccessed')}
            value={stats.recentlyAccessed}
            subtitle={t('frontend.memory.stats.last24h')}
          />
          <MetricCard
            label={t('frontend.memory.stats.recentlyCreated')}
            value={stats.recentlyCreated}
            subtitle={t('frontend.memory.stats.last24h')}
          />
        </div>
      </Card>

      {memoryContext && (
        <Card className="p-6 bg-muted/20 border-border/40">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <IconGauge className="w-4 h-4 text-primary" />
            {t('frontend.memory.stats.runtime.title')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label={t('frontend.memory.stats.runtime.cacheHitRate')} value={`${hitRate.toFixed(1)}%`} />
            <MetricCard label={t('frontend.memory.stats.runtime.avgLookupMs')} value={memoryContext.averageLookupDurationMs} />
            <MetricCard label={t('frontend.memory.stats.runtime.timeoutsFailures')} value={`${memoryContext.lookupTimeoutCount} / ${memoryContext.lookupFailureCount}`} />
            <MetricCard label={t('frontend.memory.stats.runtime.cacheInflight')} value={`${memoryContext.cacheSize} / ${memoryContext.inflightSize}`} />
          </div>
        </Card>
      )}
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, subtitle }) => (
  <div className="p-3 rounded-lg bg-muted/30">
    <p className="text-sm font-bold text-muted-foreground/60">
      {label}
    </p>
    <p className="text-xl font-bold">{value}</p>
    {subtitle && <p className="text-sm text-muted-foreground/50">{subtitle}</p>}
  </div>
);
