import { MemoryStatistics } from '@shared/types/advanced-memory';
import {
    AlertTriangle,
    Archive,
    CheckCircle,
    Download,
    Gauge,
    Plus,
    RefreshCw,
    Sparkles,
    TrendingDown,
    Upload,
} from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

// Header component
interface MemoryHeaderProps {
    isLoading: boolean;
    onRefresh: () => void;
    onRunDecay: () => void;
    onAddMemory: () => void;
    onExport: () => void;
    onImport: () => void;
    onRecategorize: () => void;
}

export const MemoryHeader: React.FC<MemoryHeaderProps> = ({
    isLoading,
    onRefresh,
    onRunDecay,
    onAddMemory,
    onExport,
    onImport,
    onRecategorize
}) => {
    const { t } = useTranslation();
    return (
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('memory.title')}</h1>
                <p className="text-muted-foreground mt-1">{t('memory.subtitle')}</p>
            </div>
            <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
                    <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                    {t('common.refresh')}
                </Button>
                <Button variant="outline" size="sm" onClick={onRunDecay} className="gap-2">
                    <TrendingDown className="w-4 h-4" />
                    {t('memory.runDecay')}
                </Button>
                <Button variant="outline" size="sm" onClick={onRecategorize} className="gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    {t('memory.recategorizeAll')}
                </Button>
                <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
                    <Download className="w-4 h-4" />
                    {t('memory.export')}
                </Button>
                <Button variant="outline" size="sm" onClick={onImport} className="gap-2">
                    <Upload className="w-4 h-4" />
                    {t('memory.import')}
                </Button>
                <Button size="sm" onClick={onAddMemory} className="gap-2">
                    <Plus className="w-4 h-4" />
                    {t('memory.addAction')}
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
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
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
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
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
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
            label="memory.stats.pending"
            value={stats.pendingValidation}
            icon={CheckCircle}
            color="text-warning"
            highlight={stats.pendingValidation > 0}
        />
        <StatCard
            label="memory.stats.confirmed"
            value={stats.byStatus.confirmed}
            icon={CheckCircle}
            color="text-success"
        />
        <StatCard
            label="memory.stats.archived"
            value={stats.byStatus.archived}
            icon={Archive}
            color="text-muted-foreground"
        />
        <StatCard
            label="memory.stats.avgConfidence"
            value={`${(stats.averageConfidence * 100).toFixed(0)}%`}
            icon={Gauge}
            color="text-primary"
        />
        <StatCard
            label="memory.stats.contradictions"
            value={stats.contradictions}
            icon={AlertTriangle}
            color="text-warning"
            highlight={stats.contradictions > 0}
        />
    </div>
);
