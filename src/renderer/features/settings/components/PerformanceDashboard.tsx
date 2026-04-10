import { Button } from '@renderer/components/ui/button';
import { ProcessMetric, ServiceResponse, StartupMetrics } from '@shared/types';
import { Activity, AlertTriangle, Cpu, MemoryStick, RefreshCw, Timer } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

interface PerformanceDashboardData {
    memory: {
        latestRss: number;
        latestHeapUsed: number;
        sampleCount: number;
    };
    processes: ProcessMetric[];
    startup: StartupMetrics;
    alerts: Array<{ timestamp: number; level: 'info' | 'warn' | 'error'; message: string }>;
    caches?: Record<string, unknown>; // SAFETY: Legacy dashboard data type
}

function formatBytes(bytes: number): string {
    if (bytes === 0) {
        return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(ms?: number): string {
    if (!ms) {
        return '-';
    }
    if (ms < 1000) {
        return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
}

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    subValue?: string;
    tone?: 'primary' | 'success' | 'warning' | 'destructive';
}

function resolveStatIconClass(tone: StatCardProps['tone']): string {
    if (tone === 'success') {
        return 'group-hover:border-success/20 text-success';
    }
    if (tone === 'warning') {
        return 'group-hover:border-warning/20 text-warning';
    }
    if (tone === 'destructive') {
        return 'group-hover:border-destructive/20 text-destructive';
    }
    return 'group-hover:border-primary/20 text-primary';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subValue, tone = 'primary' }) => (
    <div className="premium-glass p-4 group hover:bg-muted/5 transition-all duration-300">
        <div className="flex items-center gap-2.5 mb-2">
            <div
                className={cn(
                    'p-1.5 rounded-lg bg-muted/10 border border-border/40 transition-colors',
                    resolveStatIconClass(tone)
                )}
            >
                {icon}
            </div>
            <span className="text-xxxs font-bold text-muted-foreground">
                {label}
            </span>
        </div>
        <div className="text-xl font-bold text-foreground leading-none tabular-nums text-primary/90">
            {value}
        </div>
        {subValue && (
            <div className="text-xxxs text-muted-foreground/60 mt-1 font-medium">
                {subValue}
            </div>
        )}
    </div>
);

export const PerformanceDashboard: React.FC = () => {
    const { t } = useTranslation();
    const [data, setData] = useState<PerformanceDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const response = (await window.electron.performance.getDashboard()) as ServiceResponse<PerformanceDashboardData>;
            if (response.success && response.data) {
                setData(response.data);
                setError(null);
            } else {
                setError(response.error ?? t('settings.performanceDashboard.fetchError'));
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        void fetchData();
        const interval = setInterval(() => {
            void fetchData();
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleTriggerGC = async () => {
        try {
            await window.electron.performance.triggerGC();
            void fetchData();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : t('settings.performanceDashboard.gcError')
            );
        }
    };

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center p-8 animate-pulse">
                <div className="typo-caption font-bold text-muted-foreground flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {t('common.loading')}
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="p-4 premium-glass border-destructive/20 text-destructive typo-caption font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
            </div>
        );
    }

    if (!data) {
        return null;
    }

    const mainProcess = data.processes.find(p => p.type === 'main');
    const totalCpu = data.processes.reduce((sum: number, p) => sum + p.cpu, 0);
    const totalMem = data.processes.reduce((sum: number, p) => sum + p.memory, 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="typo-caption font-bold text-muted-foreground flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-primary" />
                        {t('settings.performanceDashboard.title')}
                    </h3>
                    <p className="text-xxxs text-muted-foreground/60 mt-1">
                        {t('settings.performanceDashboard.subtitle')}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        void handleTriggerGC();
                    }}
                    className="rounded-full px-4 h-8 text-xxs font-bold bg-muted/10 hover:bg-muted/20 border-border/40 transition-all flex items-center gap-1.5"
                >
                    <RefreshCw className="w-3 h-3" />
                    {t('settings.performanceDashboard.clearMemory')}
                </Button>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                    icon={<Cpu className="w-3.5 h-3.5" />}
                    label={t('settings.performanceDashboard.cards.totalCpu')}
                    value={`${totalCpu.toFixed(1)}%`}
                    subValue={t('settings.performanceDashboard.cards.activeProcesses').replace(
                        '{{count}}',
                        String(data.processes.length)
                    )}
                    tone="primary"
                />
                <StatCard
                    icon={<MemoryStick className="w-3.5 h-3.5" />}
                    label={t('settings.performanceDashboard.cards.totalMemory')}
                    value={formatBytes(totalMem)}
                    subValue={t('settings.performanceDashboard.cards.mainMemory').replace(
                        '{{memory}}',
                        formatBytes(mainProcess?.memory ?? 0)
                    )}
                    tone="primary"
                />
                <StatCard
                    icon={<Timer className="w-3.5 h-3.5" />}
                    label={t('settings.performanceDashboard.cards.startupTime')}
                    value={formatDuration(data.startup.totalTime)}
                    subValue={t('settings.performanceDashboard.cards.readyTime').replace(
                        '{{duration}}',
                        formatDuration(
                            data.startup.readyTime ? data.startup.readyTime - data.startup.startTime : 0
                        )
                    )}
                    tone="warning"
                />
                <StatCard
                    icon={<Activity className="w-3.5 h-3.5" />}
                    label={t('settings.performanceDashboard.cards.alerts')}
                    value={String(data.alerts.length)}
                    subValue={
                        data.alerts.length > 0
                            ? t('settings.performanceDashboard.cards.issuesDetected')
                            : t('settings.performanceDashboard.cards.healthOptimal')
                    }
                    tone={data.alerts.length > 0 ? 'destructive' : 'success'}
                />
            </div>

            {/* Processes Table */}
            <div className="premium-glass overflow-hidden border border-border/40">
                <div className="bg-muted/5 px-4 py-2 border-b border-border/40">
                    <span className="text-xxxs font-bold text-muted-foreground">
                        {t('settings.performanceDashboard.processTree')}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xxxs">
                        <thead className="text-muted-foreground border-b border-border/20">
                            <tr>
                                <th className="px-4 py-2 font-bold">
                                    {t('settings.performanceDashboard.table.type')}
                                </th>
                                <th className="px-4 py-2 font-bold">
                                    {t('settings.performanceDashboard.table.pid')}
                                </th>
                                <th className="px-4 py-2 font-bold text-right">
                                    {t('settings.performanceDashboard.table.cpu')}
                                </th>
                                <th className="px-4 py-2 font-bold text-right">
                                    {t('settings.performanceDashboard.table.memory')}
                                </th>
                                <th className="px-4 py-2 font-bold text-right">
                                    {t('settings.performanceDashboard.table.name')}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10 font-medium">
                            {data.processes
                                .sort((a, b) => b.cpu - a.cpu)
                                .map(p => (
                                    <tr key={p.pid} className="hover:bg-muted/5 transition-colors">
                                        <td className="px-4 py-2">
                                            <span
                                                className={cn(
                                                    'capitalize px-1.5 py-0.5 rounded-md text-xxxs font-bold border',
                                                    p.type === 'main'
                                                        ? 'bg-primary/10 text-primary border-primary/20'
                                                        : p.type === 'renderer'
                                                          ? 'bg-primary/10 text-primary border-primary/20'
                                                          : 'bg-muted/30 text-muted-foreground border-border/40'
                                                )}
                                            >
                                                {p.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 font-mono opacity-60 tabular-nums">
                                            {p.pid}
                                        </td>
                                        <td className="px-4 py-2 text-right tabular-nums">
                                            {p.cpu.toFixed(1)}%
                                        </td>
                                        <td className="px-4 py-2 text-right tabular-nums">
                                            {formatBytes(p.memory)}
                                        </td>
                                        <td className="px-4 py-2 text-right opacity-40">
                                            {p.name || t('common.notAvailable')}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Health Alerts */}
            {data.alerts.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xxxs font-bold text-muted-foreground flex items-center gap-2">
                        {t('settings.performanceDashboard.diagnosticAlerts')}
                    </h3>
                    <div className="space-y-1.5">
                        {data.alerts
                            .slice(-3)
                            .reverse()
                            .map((alert, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        'p-2 rounded-lg border text-xxxs font-medium flex items-center gap-2',
                                        alert.level === 'error'
                                            ? 'bg-destructive/10 border-destructive/20 text-destructive'
                                            : alert.level === 'warn'
                                              ? 'bg-warning/10 border-warning/20 text-warning'
                                              : 'bg-primary/10 border-primary/20 text-primary'
                                    )}
                                >
                                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                    <span className="flex-grow">{alert.message}</span>
                                    <span className="opacity-40 tabular-nums">
                                        {new Date(alert.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
};
