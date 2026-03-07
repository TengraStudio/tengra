import { Database, FolderOpen, HardDrive, MessageSquare } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';

interface StorageStats {
    dbSize: number
    chatCount: number
    messageCount: number
    workspaceCount: number
}

/** Formats bytes into a human-readable string (KB, MB, GB) */
function formatBytes(bytes: number): string {
    if (bytes < 1024) {return `${bytes} B`;}
    if (bytes < 1048576) {return `${(bytes / 1024).toFixed(1)} KB`;}
    if (bytes < 1073741824) {return `${(bytes / 1048576).toFixed(1)} MB`;}
    return `${(bytes / 1073741824).toFixed(2)} GB`;
}

interface StatItemProps {
    icon: React.ReactNode
    label: string
    value: string
    ratio?: number
}

const StatItem: React.FC<StatItemProps> = ({ icon, label, value, ratio }) => (
    <div className="premium-glass p-5 group hover:bg-muted/5 transition-all duration-300">
        <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-muted/10 border border-border/40 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                {icon}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
        </div>
        <div className="text-2xl font-black text-foreground leading-none tracking-tighter tabular-nums">{value}</div>
        {ratio !== undefined && (
            <div className="mt-3 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                    style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                />
            </div>
        )}
    </div>
);

/** Dashboard showing database size, chat count, storage usage */
export const StorageDashboard: React.FC = () => {
    const { t } = useTranslation();
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [loading, setLoading] = useState(true);

    const loadStats = useCallback(async () => {
        setLoading(true);
        try {
            const [dbStats, workspacesList] = await Promise.all([
                window.electron.db.getStats(),
                window.electron.db.getWorkspaces(),
            ]);
            setStats({
                dbSize: dbStats.dbSize,
                chatCount: dbStats.chatCount,
                messageCount: dbStats.messageCount,
                workspaceCount: workspacesList.length,
            });
        } catch {
            setStats(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadStats();
    }, [loadStats]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="p-4 text-sm text-destructive">{t('storageDashboard.loadError')}</div>
        );
    }

    const maxSize = 1073741824;
    const sizeRatio = stats.dbSize / maxSize;

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    {t('storageDashboard.title')}
                </h3>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {t('storageDashboard.subtitle')}
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatItem
                    icon={<HardDrive className="w-3.5 h-3.5 text-primary" />}
                    label={t('storageDashboard.dbSize')}
                    value={formatBytes(stats.dbSize)}
                    ratio={sizeRatio}
                />
                <StatItem
                    icon={<MessageSquare className="w-3.5 h-3.5 text-primary" />}
                    label={t('storageDashboard.totalChats')}
                    value={String(stats.chatCount)}
                />
                <StatItem
                    icon={<Database className="w-3.5 h-3.5 text-primary" />}
                    label={t('storageDashboard.totalMessages')}
                    value={String(stats.messageCount)}
                />
                <StatItem
                    icon={<FolderOpen className="w-3.5 h-3.5 text-primary" />}
                    label={t('storageDashboard.totalProjects')}
                    value={String(stats.workspaceCount)}
                />
            </div>
        </div>
    );
};
