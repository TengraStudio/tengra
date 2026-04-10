import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';

interface SSHDashboardProps {
    connectionId: string
    active: boolean
}

import { SSHDiskStat, SSHSystemStats } from '@/types';

export const SSHDashboard: React.FC<SSHDashboardProps> = ({ connectionId, active }) => {
    const { t } = useTranslation();
    const [stats, setStats] = useState<SSHSystemStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            const data = await window.electron.ssh.getSystemStats(connectionId);
            setStats(data);
            setError(null);
        } catch (error) {
            setError(error instanceof Error ? error.message : t('ssh.failedStats'));
        } finally {
            setLoading(false);
        }
    }, [connectionId, t]);

    useEffect(() => {
        if (active) {
            void fetchStats();
            const interval = setInterval(() => void fetchStats(), 5000); // Poll every 5s
            return () => clearInterval(interval);
        }
        return undefined;
    }, [fetchStats, active]);

    if (!active) { return null; }
    if (loading && !stats) { return <div className="p-8 text-center text-muted-foreground/60">{t('ssh.loadingStats')}</div>; }
    if (error) { return <div className="p-8 text-center text-destructive">{t('ssh.connectionError', { error })}</div>; }
    if (!stats) { return null; }

    return (
        <div className="p-6 space-y-6 h-full overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{t('ssh.systemDashboard')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CPU Usage */}
                <div className="bg-card/40 border border-border/50 rounded-xl p-4 shadow-sm">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('ssh.cpuUsage')}</h4>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-bold text-foreground">{stats.cpu}%</span>
                        <span className="text-sm text-muted-foreground mb-1">{t('ssh.load')}</span>
                    </div>
                    <div className="w-full bg-muted/30 h-2 rounded-full mt-3 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${stats.cpu > 80 ? 'bg-destructive' : stats.cpu > 50 ? 'bg-warning' : 'bg-primary'}`}
                            style={{ width: `${stats.cpu}%` }}
                        />
                    </div>
                </div>

                {/* Memory Usage */}
                <div className="bg-card/40 border border-border/50 rounded-xl p-4 shadow-sm">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('ssh.memoryUsage')}</h4>
                    <div className="flex items-end gap-2">
                        <span className="text-4xl font-bold text-foreground">{Math.round((stats.memory.used / stats.memory.total) * 100)}%</span>
                        <span className="text-sm text-muted-foreground mb-1">
                            {stats.memory.used}{t('ssh.memoryUnitMb')} / {stats.memory.total}{t('ssh.memoryUnitMb')}
                        </span>
                    </div>
                    <div className="w-full bg-muted/30 h-2 rounded-full mt-3 overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${(stats.memory.used / stats.memory.total) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Disk Usage */}
            <div className="bg-card/40 border border-border/50 rounded-xl p-4 shadow-sm">
                <h4 className="text-sm font-medium text-muted-foreground mb-4">{t('ssh.diskUsage')}</h4>
                <div className="space-y-4">
                    {Array.isArray(stats.disk) && stats.disk.map((disk: SSHDiskStat, idx: number) => (
                        <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="font-mono typo-caption text-muted-foreground">{disk.filesystem}</span>
                                <span className="text-foreground">{disk.used} / {disk.total} ({disk.percent})</span>
                            </div>
                            <div className="w-full bg-muted/30 h-1.5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary/80 rounded-full"
                                    style={{ width: disk.percent }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="typo-caption text-muted-foreground text-right">
                {t('ssh.uptime')}: {stats.uptime}
            </div>
        </div>
    );
};
