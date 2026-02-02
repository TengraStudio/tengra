
import { Activity, Clock, Cpu, HardDrive } from 'lucide-react';
import { useEffect, useState } from 'react';

import { appLogger } from '@main/logging/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n';
import { motion } from '@/lib/framer-motion-compat';

interface SystemStats {
    cpu: number
    memory: {
        total: number
        used: number
        percent: number
    }
    disk: number
    uptime: string
    error?: string
}

interface StatsDashboardProps {
    connectionId: string
}

export function StatsDashboard({ connectionId }: StatsDashboardProps) {
    const { t } = useTranslation();
    const [stats, setStats] = useState<SystemStats | null>(null);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            try {
                const data = await window.electron.ssh.getSystemStats(connectionId) as SystemStats;
                if (isMounted) {
                    setStats(data);
                }
            } catch (e) {
                appLogger.error('StatsDashboard', 'Failed to load stats', e as Error);
            }
        };

        void load();
        const interval = setInterval(() => void load(), 5000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [connectionId]);

    if (!stats) { return <div className="flex items-center justify-center p-8 text-muted-foreground/50">{t('ssh.loadingStats')}</div>; }

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4">
            {/* CPU */}
            <Card className="bg-card/40 border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground/80">{t('ssh.cpuUsage')}</CardTitle>
                    <Cpu size={16} className="text-primary" />
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-foreground">{stats.cpu}%</span>
                    </div>
                    <div className="mt-3 h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(stats.cpu, 100)}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* RAM */}
            <Card className="bg-card/40 border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground/80">{t('ssh.memoryUsage')}</CardTitle>
                    <Activity size={16} className="text-primary/80" />
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-foreground">{stats.memory.percent}%</span>
                        <span className="text-xs text-muted-foreground/40 mb-1">{stats.memory.used} / {stats.memory.total} MB</span>
                    </div>
                    <div className="mt-3 h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-primary/80"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(stats.memory.percent, 100)}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Disk */}
            <Card className="bg-card/40 border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground/80">{t('ssh.diskUsage')}</CardTitle>
                    <HardDrive size={16} className="text-success" />
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-foreground">{stats.disk}%</span>
                        <span className="text-xs text-muted-foreground/40 mb-1">{t('ssh.rootPartition')}</span>
                    </div>
                    <div className="mt-3 h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-success/80"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(stats.disk, 100)}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Uptime */}
            <Card className="bg-card/40 border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground/80">{t('ssh.uptime')}</CardTitle>
                    <Clock size={16} className="text-primary/70" />
                </CardHeader>
                <CardContent>
                    <div className="text-lg font-bold text-foreground truncate" title={stats.uptime}>
                        {stats.uptime !== '' ? stats.uptime : t('ssh.unknown')}
                    </div>
                    <p className="text-xs text-muted-foreground/40 mt-1">{t('ssh.serverUptime')}</p>
                </CardContent>
            </Card>
        </div>
    );
}
