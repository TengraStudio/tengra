import { MemoryStatistics } from '@shared/types/advanced-memory';
import { Archive, CheckCircle, Clock, Gauge, X } from 'lucide-react';
import React from 'react';

import { StatCard } from './MemorySubComponents';

export const StatsSection = ({ stats }: { stats: MemoryStatistics | null }) => {
    if (!stats) { return null; }
    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Pending" value={stats.pendingValidation} icon={Clock} color="text-yellow" highlight={stats.pendingValidation > 0} />
            <StatCard label="Confirmed" value={stats.byStatus.confirmed} icon={CheckCircle} color="text-success" />
            <StatCard label="Archived" value={stats.byStatus.archived} icon={Archive} color="text-muted-foreground" />
            <StatCard label="Avg. Confidence" value={`${(stats.averageConfidence * 100).toFixed(0)}%`} icon={Gauge} color="text-primary" />
            <StatCard label="Contradictions" value={stats.contradictions} icon={X} color="text-orange" highlight={stats.contradictions > 0} />
        </div>
    );
};
