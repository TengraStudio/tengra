import { Activity, X } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

interface Notification {
    id: string
    type: 'success' | 'error' | 'info'
    message: string
}

interface WorkspaceNotificationsProps {
    notifications: Notification[]
}

export const WorkspaceNotifications: React.FC<WorkspaceNotificationsProps> = ({ notifications }) => {
    const visibleNotifications = React.useMemo(() => notifications.slice(-5), [notifications]);
    const groupedNotifications = React.useMemo(() => {
        const grouped = new Map<string, Notification & { count: number }>();
        visibleNotifications.forEach(notification => {
            const existing = grouped.get(notification.message);
            if (existing) {
                grouped.set(notification.message, { ...existing, count: existing.count + 1 });
                return;
            }
            grouped.set(notification.message, { ...notification, count: 1 });
        });
        return Array.from(grouped.values());
    }, [visibleNotifications]);
    const summary = React.useMemo(() => {
        if (visibleNotifications.length < 3) {
            return null;
        }
        const counts = visibleNotifications.reduce(
            (acc, notification) => ({
                success: acc.success + (notification.type === 'success' ? 1 : 0),
                error: acc.error + (notification.type === 'error' ? 1 : 0),
                info: acc.info + (notification.type === 'info' ? 1 : 0),
            }),
            { success: 0, error: 0, info: 0 }
        );
        return `${visibleNotifications.length} operations • ${counts.success} success • ${counts.error} error`;
    }, [visibleNotifications]);

    return (
        <div className="fixed bottom-6 right-6 tw-z-9999 flex flex-col gap-2 pointer-events-none">
            {summary && (
                <div className="px-4 py-3 rounded-xl border shadow-2xl pointer-events-auto tw-min-w-300 flex items-center gap-3 bg-primary/10 border-primary/20 text-primary">
                    <Activity className="w-4 h-4" />
                    <span className="typo-caption font-bold">{summary}</span>
                </div>
            )}
            {(summary ? groupedNotifications.slice(-1) : groupedNotifications).map(n => (
                <div key={n.id} className={cn(
                    "px-4 py-3 rounded-xl border shadow-2xl animate-in slide-in-from-right-10 fade-in pointer-events-auto tw-min-w-300 flex items-center gap-3",
                    n.type === 'success' ? "bg-success/10 border-success/20 text-success" :
                        n.type === 'error' ? "bg-destructive/10 border-destructive/20 text-destructive" :
                            "bg-primary/10 border-primary/20 text-primary"
                )}>
                    {n.type === 'success' ? <Activity className="w-4 h-4" /> : n.type === 'error' ? <X className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                    <span className="typo-caption font-bold">
                        {n.message}
                        {n.count > 1 ? ` (${n.count}x)` : ''}
                    </span>
                </div>
            ))}
        </div>
    );
};
