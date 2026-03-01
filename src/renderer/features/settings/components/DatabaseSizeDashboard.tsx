import { Database, FileText, FolderOpen, HardDrive, Layers,MessageSquare } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useTranslation } from '@/i18n';

/** Statistics shape returned by the db:size-stats IPC handler. */
interface DatabaseSizeStats {
    dbSize: number
    chatCount: number
    messageCount: number
    projectCount: number
    folderCount: number
    promptCount: number
}

/** Formats bytes into a human-readable string. */
function formatBytes(bytes: number): string {
    if (bytes < 1024) {return `${bytes} B`;}
    if (bytes < 1048576) {return `${(bytes / 1024).toFixed(1)} KB`;}
    if (bytes < 1073741824) {return `${(bytes / 1048576).toFixed(1)} MB`;}
    return `${(bytes / 1073741824).toFixed(2)} GB`;
}

interface StatCardProps {
    icon: React.ReactNode
    label: string
    value: string
    ratio?: number
    color: string
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, ratio, color }) => (
    <div className="premium-glass p-4 group hover:bg-muted/5 transition-all duration-300">
        <div className="flex items-center gap-2.5 mb-2">
            <div className={`p-1.5 rounded-lg bg-muted/10 border border-border/40 group-hover:border-${color}/20 transition-colors`}>
                {icon}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {label}
            </span>
        </div>
        <div className="text-xl font-black text-foreground leading-none tracking-tighter tabular-nums">
            {value}
        </div>
        {ratio !== undefined && (
            <div className="mt-2 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                    style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                />
            </div>
        )}
    </div>
);

/** Dashboard displaying detailed database size and record breakdown. */
export const DatabaseSizeDashboard: React.FC = () => {
    const { t } = useTranslation();
    const [stats, setStats] = useState<DatabaseSizeStats | null>(null);
    const [loading, setLoading] = useState(true);

    const loadStats = useCallback(async () => {
        setLoading(true);
        try {
            const result = await window.electron.ipcRenderer.invoke('db:size-stats');
            setStats(result as DatabaseSizeStats);
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
            <div className="p-4 text-sm text-destructive">
                {t('databaseSizeDashboard.loadError')}
            </div>
        );
    }

    const maxSize = 1073741824;
    const sizeRatio = stats.dbSize / maxSize;
    const totalRecords = stats.chatCount + stats.messageCount + stats.promptCount;

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    {t('databaseSizeDashboard.title')}
                </h3>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {t('databaseSizeDashboard.subtitle')}
                </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <StatCard
                    icon={<HardDrive className="w-3.5 h-3.5 text-primary" />}
                    label={t('databaseSizeDashboard.dbSize')}
                    value={formatBytes(stats.dbSize)}
                    ratio={sizeRatio}
                    color="primary"
                />
                <StatCard
                    icon={<MessageSquare className="w-3.5 h-3.5 text-blue-500" />}
                    label={t('databaseSizeDashboard.chats')}
                    value={String(stats.chatCount)}
                    ratio={stats.chatCount / Math.max(totalRecords, 1)}
                    color="blue-500"
                />
                <StatCard
                    icon={<Database className="w-3.5 h-3.5 text-green-500" />}
                    label={t('databaseSizeDashboard.messages')}
                    value={String(stats.messageCount)}
                    ratio={stats.messageCount / Math.max(totalRecords, 1)}
                    color="green-500"
                />
                <StatCard
                    icon={<FolderOpen className="w-3.5 h-3.5 text-yellow-500" />}
                    label={t('databaseSizeDashboard.projects')}
                    value={String(stats.projectCount)}
                    color="yellow-500"
                />
                <StatCard
                    icon={<Layers className="w-3.5 h-3.5 text-purple-500" />}
                    label={t('databaseSizeDashboard.folders')}
                    value={String(stats.folderCount)}
                    color="purple-500"
                />
                <StatCard
                    icon={<FileText className="w-3.5 h-3.5 text-orange-500" />}
                    label={t('databaseSizeDashboard.prompts')}
                    value={String(stats.promptCount)}
                    color="orange-500"
                />
            </div>
        </div>
    );
};
