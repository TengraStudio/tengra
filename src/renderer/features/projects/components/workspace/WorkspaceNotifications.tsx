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
    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
            {notifications.map(n => (
                <div key={n.id} className={cn(
                    "px-4 py-3 rounded-xl border shadow-2xl animate-in slide-in-from-right-10 fade-in pointer-events-auto min-w-[300px] flex items-center gap-3",
                    n.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                        n.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                            "bg-blue-500/10 border-blue-500/20 text-blue-400"
                )}>
                    {n.type === 'success' ? <Activity className="w-4 h-4" /> : n.type === 'error' ? <X className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                    <span className="text-xs font-bold tracking-tight">{n.message}</span>
                </div>
            ))}
        </div>
    );
};
