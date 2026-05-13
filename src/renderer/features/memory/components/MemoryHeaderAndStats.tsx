/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { MemoryStatistics } from '@shared/types/advanced-memory';
import { IconAlertTriangle, IconArchive, IconCircleCheck, IconDownload, IconGauge, IconPlus, IconRefresh, IconSparkles, IconTrendingDown, IconUpload } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

// Header component
interface MemoryHeaderProps {
    isLoading: boolean;
    healthStatus: 'healthy' | 'degraded';
    runtime: {
        status: 'healthy' | 'degraded' | 'unknown';
        averageLookupDurationMs: number;
        lookupTimeoutCount: number;
        lookupFailureCount: number;
        cacheHitRate: number;
    };
    onRefresh: () => void;
    onRunDecay: () => void;
    onAddMemory: () => void;
    onExport: () => void;
    onImport: () => void;
    onRecategorize: () => void;
}

export const MemoryHeader: React.FC<MemoryHeaderProps> = ({
    isLoading,
    healthStatus,
    runtime,
    onRefresh,
    onRunDecay,
    onAddMemory,
    onExport,
    onImport,
    onRecategorize
}) => {
    const { t } = useTranslation();
    const runtimeLabel =
        runtime.status === 'healthy'
            ? t('frontend.memory.status.healthy')
            : runtime.status === 'degraded'
                ? t('frontend.memory.status.degraded')
                : t('frontend.memory.status.unknown');

    return (
        <section className="rounded-2xl border border-border/40 bg-card/80 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                    <span className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium',
                        healthStatus === 'healthy'
                            ? 'border-success/20 bg-success/5 text-success'
                            : 'border-warning/20 bg-warning/5 text-warning'
                    )}>
                        {healthStatus === 'healthy'
                            ? t('frontend.memory.status.ready')
                            : t('frontend.memory.status.needsAttention')}
                    </span>
                    <span className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium',
                        runtime.status === 'healthy'
                            ? 'border-success/20 bg-success/5 text-success'
                            : runtime.status === 'degraded'
                                ? 'border-warning/20 bg-warning/5 text-warning'
                                : 'border-border/40 bg-muted/20 text-muted-foreground'
                    )}>
                        {runtimeLabel}
                    </span>
                    <span className="rounded-full border border-border/40 bg-muted/20 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {t('frontend.memory.header.lookupDuration', { value: runtime.averageLookupDurationMs })}
                    </span>
                    <span className="rounded-full border border-border/40 bg-muted/20 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {t('frontend.memory.header.cacheHitRate', { value: runtime.cacheHitRate })}
                    </span>
                    <span className="rounded-full border border-border/40 bg-muted/20 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {t('frontend.memory.header.lookupIssues', {
                            timeouts: runtime.lookupTimeoutCount,
                            failures: runtime.lookupFailureCount,
                        })}
                    </span>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
                        <IconRefresh className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                        {t('common.refresh')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={onRunDecay} className="gap-2">
                        <IconTrendingDown className="h-4 w-4" />
                        {t('frontend.memory.runDecay')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={onRecategorize} className="gap-2">
                        <IconSparkles className="h-4 w-4" />
                        {t('frontend.memory.recategorizeAll')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
                        <IconDownload className="h-4 w-4" />
                        {t('frontend.memory.export')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={onImport} className="gap-2">
                        <IconUpload className="h-4 w-4" />
                        {t('frontend.memory.import')}
                    </Button>
                    <Button size="sm" onClick={onAddMemory} className="gap-2">
                        <IconPlus className="h-4 w-4" />
                        {t('frontend.memory.addAction')}
                    </Button>
                </div>
            </div> 
        </section>
    );
};

// Error display
interface ErrorDisplayProps {
    error: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error }) => (
    <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive">
        <IconAlertTriangle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm font-medium">{error}</p>
    </div>
);

// Stat Card
interface StatCardProps {
    label: string;
    value: number | string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    highlight?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, color, highlight }) => (
    <Card
        className={cn(
            'flex flex-col gap-1 border-border/40 bg-card/80 p-4 transition-colors',
            highlight && 'border-primary/30 bg-primary/5'
        )}
    >
        <StatCardContent label={label} value={value} icon={Icon} color={color} />
    </Card>
);

const StatCardContent = ({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string;
    value: number | string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
}) => {
    const { t } = useTranslation();
    return (
        <>
            <div className="flex items-center gap-2">
                <Icon className={cn('w-4 h-4', color)} />
                <span className="text-xs font-medium text-muted-foreground/70">
                    {t(label)}
                </span>
            </div>
            <div className={cn('text-2xl font-semibold', color)}>{value}</div>
        </>
    );
};

// Stats Overview
interface StatsOverviewProps {
    stats: MemoryStatistics;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
            label="frontend.memory.stats.confirmed"
            value={stats.byStatus.confirmed}
            icon={IconCircleCheck}
            color="text-success"
            highlight={stats.byStatus.confirmed > 0}
        />
        <StatCard
            label="frontend.memory.stats.pending"
            value={stats.pendingValidation}
            icon={IconCircleCheck}
            color="text-warning"
            highlight={stats.pendingValidation > 0}
        />
        <StatCard
            label="frontend.memory.stats.archived"
            value={stats.byStatus.archived}
            icon={IconArchive}
            color="text-muted-foreground"
        />
        <StatCard
            label="frontend.memory.stats.avgConfidence"
            value={`${(stats.averageConfidence * 100).toFixed(0)}%`}
            icon={IconGauge}
            color="text-primary"
        />
    </div>
);
