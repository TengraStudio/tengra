/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */


import { IconActivity, IconClock, IconCpu, IconDatabase } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n';
import { motion } from '@/lib/framer-motion-compat';
import { appLogger } from '@/utils/renderer-logger';

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

    if (!stats) { return <div className="flex items-center justify-center p-8 text-muted-foreground/50">{t('frontend.ssh.loadingStats')}</div>; }

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4">
            {/* CPU */}
            <Card className="bg-card/40 border-border/50 transition-premium hover:shadow-md hover:border-primary/30">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground/80">{t('frontend.ssh.cpuUsage')}</CardTitle>
                    <IconCpu size={16} className="text-primary" />
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
            <Card className="bg-card/40 border-border/50 transition-premium hover:shadow-md hover:border-primary/30">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground/80">{t('frontend.ssh.memoryUsage')}</CardTitle>
                    <IconActivity size={16} className="text-primary/80" />
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-foreground">{stats.memory.percent}%</span>
                        <span className="typo-caption text-muted-foreground/40 mb-1">{stats.memory.used} / {stats.memory.total} MB</span>
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
            <Card className="bg-card/40 border-border/50 transition-premium hover:shadow-md hover:border-success/30">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground/80">{t('frontend.ssh.diskUsage')}</CardTitle>
                    <IconDatabase size={16} className="text-success" />
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-foreground">{stats.disk}%</span>
                        <span className="typo-caption text-muted-foreground/40 mb-1">{t('frontend.ssh.rootPartition')}</span>
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
            <Card className="bg-card/40 border-border/50 transition-premium hover:shadow-md hover:border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground/80">{t('frontend.ssh.uptime')}</CardTitle>
                    <IconClock size={16} className="text-primary/70" />
                </CardHeader>
                <CardContent>
                    <div className="text-lg font-bold text-foreground truncate" title={stats.uptime}>
                        {stats.uptime !== '' ? stats.uptime : t('frontend.ssh.unknown')}
                    </div>
                    <p className="typo-caption text-muted-foreground/40 mt-1">{t('frontend.ssh.serverUptime')}</p>
                </CardContent>
            </Card>
        </div>
    );
}

