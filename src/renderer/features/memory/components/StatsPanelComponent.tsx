/**
 * Stats Panel Component
 *
 * Displays detailed memory statistics and health metrics.
 */

import { MemoryCategory,MemoryStatistics } from '@shared/types/advanced-memory';
import { Gauge,Sparkles, Tag } from 'lucide-react';
import React from 'react';

import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

import { CATEGORY_CONFIG } from './constants';

interface StatsPanelProps {
  stats: MemoryStatistics;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats }) => (
  <StatsPanelContent stats={stats} />
);

const StatsPanelContent = ({ stats }: { stats: MemoryStatistics }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      {/* By Category */}
      <Card className="p-6 bg-muted/20 border-border/40">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" />
          {t('memory.stats.memoriesByCategory')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats.byCategory).map(([category, count]) => {
            const config = CATEGORY_CONFIG[category as MemoryCategory];
            return (
              <div key={category} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <config.icon className={cn('w-5 h-5', config.color.split(' ')[1])} />
                <div>
                  <p className="text-sm font-medium">{t(config.labelKey)}</p>
                  <p className="text-2xl font-black">{count}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* By Source */}
      <Card className="p-6 bg-muted/20 border-border/40">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          {t('memory.stats.memoriesBySource')}
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
          <Gauge className="w-4 h-4 text-primary" />
          {t('memory.stats.healthMetrics')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label={t('memory.stats.avgConfidence')}
            value={`${(stats.averageConfidence * 100).toFixed(1)}%`}
          />
          <MetricCard
            label={t('memory.stats.avgImportance')}
            value={`${(stats.averageImportance * 100).toFixed(1)}%`}
          />
          <MetricCard
            label={t('memory.stats.recentlyAccessed')}
            value={stats.recentlyAccessed}
            subtitle={t('memory.stats.last24h')}
          />
          <MetricCard
            label={t('memory.stats.recentlyCreated')}
            value={stats.recentlyCreated}
            subtitle={t('memory.stats.last24h')}
          />
        </div>
      </Card>
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
    <p className="text-xxs font-bold uppercase tracking-widest text-muted-foreground/60">
      {label}
    </p>
    <p className="text-xl font-black">{value}</p>
    {subtitle && <p className="text-xxs text-muted-foreground/50">{subtitle}</p>}
  </div>
);
