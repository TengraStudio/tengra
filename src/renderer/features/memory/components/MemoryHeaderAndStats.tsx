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
    const runtimeTone = runtime.status === 'healthy' ? 'text-success' : runtime.status === 'degraded' ? 'text-warning' : 'text-muted-foreground';
    const overallTone = healthStatus === 'healthy' ? 'text-success' : 'text-warning';
    const statusLabel = healthStatus === 'healthy' ? 'Ready' : 'Needs attention';
    const runtimeLabel = runtime.status === 'healthy'
        ? 'Fast lookups'
        : runtime.status === 'degraded'
            ? 'Slow or failed lookups'
            : 'Lookup status unknown';

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-primary/10 via-background to-background p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em]', overallTone, healthStatus === 'healthy' ? 'border-success/30 bg-success/10' : 'border-warning/30 bg-warning/10')}>
                        {statusLabel}
                    </span>
                    <span className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', runtimeTone, runtime.status === 'healthy' ? 'border-success/20 bg-success/5' : runtime.status === 'degraded' ? 'border-warning/20 bg-warning/5' : 'border-border/40 bg-muted/20')}>
                        {runtimeLabel}
                    </span>
                </div>
                <h1 className="mt-3 text-3xl font-bold">{t('frontend.memory.title')}</h1>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                    What Tengra saves about you, your work, and past conversations.
                    Review new memories, search what is already stored, and check whether memory lookup is working.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/30 bg-background/70 p-3">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Average lookup</p>
                        <p className="mt-1 text-2xl font-semibold">{runtime.averageLookupDurationMs}ms</p>
                    </div>
                    <div className="rounded-xl border border-border/30 bg-background/70 p-3">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Cache hit rate</p>
                        <p className="mt-1 text-2xl font-semibold">{runtime.cacheHitRate}%</p>
                    </div>
                    <div className="rounded-xl border border-border/30 bg-background/70 p-3">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Timeouts / failures</p>
                        <p className="mt-1 text-2xl font-semibold">{runtime.lookupTimeoutCount} / {runtime.lookupFailureCount}</p>
                    </div>
                </div>
            </div>
            <div className="flex flex-wrap items-start gap-3 lg:max-w-[18rem] lg:justify-end">
                <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
                    <IconRefresh className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                    {t('common.refresh')}
                </Button>
                <Button variant="outline" size="sm" onClick={onRunDecay} className="gap-2">
                    <IconTrendingDown className="w-4 h-4" />
                    {t('frontend.memory.runDecay')}
                </Button>
                <Button variant="outline" size="sm" onClick={onRecategorize} className="gap-2">
                    <IconSparkles className="w-4 h-4 text-primary" />
                    {t('frontend.memory.recategorizeAll')}
                </Button>
                <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
                    <IconDownload className="w-4 h-4" />
                    {t('frontend.memory.export')}
                </Button>
                <Button variant="outline" size="sm" onClick={onImport} className="gap-2">
                    <IconUpload className="w-4 h-4" />
                    {t('frontend.memory.import')}
                </Button>
                <Button size="sm" onClick={onAddMemory} className="gap-2">
                    <IconPlus className="w-4 h-4" />
                    {t('frontend.memory.addAction')}
                </Button>
            </div>
        </div>
    );
};

// Error display
interface ErrorDisplayProps {
    error: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error }) => (
    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3">
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
            'p-4 bg-muted/30 border-border/40 flex flex-col gap-1 transition-all',
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
                <span className="typo-caption font-bold text-muted-foreground/60">
                    {t(label)}
                </span>
            </div>
            <div className={cn('text-2xl font-bold', color)}>{value}</div>
        </>
    );
};

// Stats Overview
interface StatsOverviewProps {
    stats: MemoryStatistics;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard
            label="frontend.memory.stats.pending"
            value={stats.pendingValidation}
            icon={IconCircleCheck}
            color="text-warning"
            highlight={stats.pendingValidation > 0}
        />
        <StatCard
            label="frontend.memory.stats.confirmed"
            value={stats.byStatus.confirmed}
            icon={IconCircleCheck}
            color="text-success"
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
        <StatCard
            label="frontend.memory.stats.contradictions"
            value={stats.contradictions}
            icon={IconAlertTriangle}
            color="text-warning"
            highlight={stats.contradictions > 0}
        />
    </div>
);

