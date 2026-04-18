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
import { Archive, CheckCircle, Clock, Gauge, X } from 'lucide-react';

import { useTranslation } from '@/i18n';

import { StatCard } from './MemorySubComponents';

export const StatsSection = ({ stats }: { stats: MemoryStatistics | null }) => {
    const { t } = useTranslation();
    if (!stats) {
        return null;
    }
    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
                label={t('memory.stats.pending')}
                value={stats.pendingValidation}
                icon={Clock}
                color="text-warning"
                highlight={stats.pendingValidation > 0}
            />
            <StatCard
                label={t('memory.stats.confirmed')}
                value={stats.byStatus.confirmed}
                icon={CheckCircle}
                color="text-success"
            />
            <StatCard
                label={t('memory.stats.archived')}
                value={stats.byStatus.archived}
                icon={Archive}
                color="text-muted-foreground"
            />
            <StatCard
                label={t('memory.stats.avgConfidence')}
                value={`${(stats.averageConfidence * 100).toFixed(0)}%`}
                icon={Gauge}
                color="text-primary"
            />
            <StatCard
                label={t('memory.stats.contradictions')}
                value={stats.contradictions}
                icon={X}
                color="text-warning"
                highlight={stats.contradictions > 0}
            />
        </div>
    );
};
