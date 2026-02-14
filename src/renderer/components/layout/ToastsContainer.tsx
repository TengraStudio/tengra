import { CalendarClock, CheckCheck, Clock3, History, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useBreakpoint } from '@/lib/responsive';
import { cn } from '@/lib/utils';
import {
    clearNotificationHistory,
    dismissNotification,
    getUnreadNotificationCount,
    markAllNotificationsRead,
    markNotificationRead,
    runNotificationAction,
    scheduleNotification,
    setNotificationPreferences,
    useNotificationCenterStore,
} from '@/store/notification-center.store';
import { Toast } from '@/types';

interface ToastsContainerProps {
    toasts: Toast[];
    removeToast: (id: string) => void;
}

const notificationTypes: Array<Toast['type']> = ['info', 'success', 'warning', 'error'];

function formatTime(timestamp: number): string {
    try {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

export function ToastsContainer({ toasts, removeToast }: ToastsContainerProps) {
    const [isCenterOpen, setIsCenterOpen] = useState(false);
    const breakpoint = useBreakpoint();
    const snapshot = useNotificationCenterStore(state => state);
    const activeNotifications = snapshot.active;
    const history = snapshot.history.slice(0, 50);
    // const unreadCount = useMemo(() => getUnreadNotificationCount(snapshot), [snapshot]);

    const visibleToasts = activeNotifications.length > 0 ? activeNotifications : toasts;
    // const scheduledCount = snapshot.scheduled.length;

    return (
        <>
            <div
                className={cn(
                    'fixed z-[9999] flex flex-col items-end gap-2 pointer-events-none',
                    breakpoint === 'mobile' ? 'bottom-3 left-3 right-3' : 'bottom-6 right-6'
                )}
            >

                {visibleToasts.map(toast => {
                    const icon =
                        toast.type === 'success' ? 'OK' : toast.type === 'error' ? 'ERR' : 'INFO';
                    const normalizedToast = activeNotifications.find(item => item.id === toast.id);
                    return (
                        <div
                            key={toast.id}
                            className={cn(
                                'px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-full duration-300 pointer-events-auto flex flex-col gap-2',
                                breakpoint === 'mobile' ? 'w-full' : 'min-w-[280px] max-w-[420px]',
                                toast.type === 'success'
                                    ? 'bg-success/20 border-success/30 text-success'
                                    : toast.type === 'error'
                                        ? 'bg-destructive/20 border-destructive/30 text-destructive'
                                        : toast.type === 'warning'
                                            ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                                            : 'bg-muted/80 border-white/10 text-foreground'
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold tracking-wide opacity-80">
                                    {icon}
                                </span>
                                <div className="text-sm font-medium">{toast.message}</div>
                                <button
                                    onClick={() => {
                                        dismissNotification(toast.id);
                                        removeToast(toast.id);
                                    }}
                                    className="ms-auto opacity-60 hover:opacity-100"
                                >
                                    x
                                </button>
                            </div>
                            {normalizedToast && normalizedToast.actions.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                    {normalizedToast.actions.map(action => (
                                        <button
                                            key={action.id}
                                            onClick={() => {
                                                runNotificationAction(normalizedToast.id, action.id);
                                            }}
                                            className={cn(
                                                'px-2 py-1 rounded border text-[10px] font-semibold',
                                                action.tone === 'primary'
                                                    ? 'border-primary/40 text-primary'
                                                    : action.tone === 'destructive'
                                                        ? 'border-destructive/40 text-destructive'
                                                        : 'border-border/50 text-foreground/80'
                                            )}
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => {
                                            scheduleNotification(
                                                {
                                                    type: normalizedToast.type,
                                                    title: normalizedToast.title,
                                                    message: normalizedToast.message,
                                                    source: normalizedToast.source,
                                                    actions: normalizedToast.actions,
                                                },
                                                Date.now() + 5 * 60 * 1000
                                            );
                                            dismissNotification(normalizedToast.id);
                                        }}
                                        className="px-2 py-1 rounded border border-border/50 text-[10px] font-semibold text-foreground/80"
                                        title="Remind in 5 minutes"
                                    >
                                        <Clock3 className="w-3 h-3 inline mr-1" />
                                        Snooze
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {isCenterOpen && (
                <div
                    className={cn(
                        'fixed z-[10000] rounded-xl border border-border/70 bg-card/95 backdrop-blur shadow-2xl',
                        breakpoint === 'mobile'
                            ? 'left-3 right-3 top-16'
                            : 'top-20 right-6 w-[390px] max-w-[95vw]'
                    )}
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                        <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">Notification Center</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => {
                                    markAllNotificationsRead();
                                }}
                                className="p-1.5 rounded hover:bg-accent/50 text-muted-foreground"
                                title="Mark all read"
                            >
                                <CheckCheck className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    clearNotificationHistory();
                                }}
                                className="p-1.5 rounded hover:bg-accent/50 text-muted-foreground"
                                title="Clear history"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    setIsCenterOpen(false);
                                }}
                                className="p-1.5 rounded hover:bg-accent/50 text-muted-foreground"
                                title="Close"
                            >
                                x
                            </button>
                        </div>
                    </div>

                    <div className="px-4 py-3 border-b border-border/60">
                        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            Preferences
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {notificationTypes.map(type => (
                                <label
                                    key={type}
                                    className="flex items-center justify-between rounded border border-border/50 bg-background/40 px-2 py-1.5 text-xs"
                                >
                                    <span className="capitalize">{type}</span>
                                    <input
                                        type="checkbox"
                                        checked={snapshot.preferences[type]}
                                        onChange={event => {
                                            setNotificationPreferences({ [type]: event.target.checked });
                                        }}
                                    />
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="px-4 py-2 border-b border-border/60 text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                        <span>Delivered: {snapshot.analytics.deliveredTotal}</span>
                        <span>Dismissed: {snapshot.analytics.dismissedTotal}</span>
                        <span>Actions: {snapshot.analytics.actionClicksTotal}</span>
                        <span>Suppressed: {snapshot.analytics.suppressedTotal}</span>
                        <span>Scheduled: {snapshot.analytics.scheduledTotal}</span>
                        <span>Pending: {snapshot.scheduled.length}</span>
                    </div>

                    {snapshot.scheduled.length > 0 && (
                        <div className="px-4 py-2 border-b border-border/60">
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                Scheduled
                            </div>
                            <div className="space-y-1.5 max-h-24 overflow-auto">
                                {snapshot.scheduled.slice(0, 6).map(item => (
                                    <div
                                        key={item.id}
                                        className="rounded border border-border/50 bg-background/30 px-2 py-1 text-xs text-muted-foreground"
                                    >
                                        <CalendarClock className="w-3.5 h-3.5 inline mr-1" />
                                        {item.payload.message}
                                        <span className="ml-2 opacity-70">
                                            {formatTime(item.deliverAt)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="max-h-[340px] overflow-auto px-4 py-2 space-y-2">
                        {history.length === 0 && (
                            <div className="py-6 text-center text-xs text-muted-foreground">
                                No notifications yet.
                            </div>
                        )}
                        {history.map(item => (
                            <div
                                key={item.id}
                                className={cn(
                                    'rounded-lg border px-3 py-2',
                                    item.readAt ? 'border-border/50 bg-background/30' : 'border-primary/40 bg-primary/5'
                                )}
                            >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                        {item.type}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                        {formatTime(item.createdAt)}
                                    </div>
                                </div>
                                {item.title && (
                                    <div className="text-xs font-semibold text-foreground mb-0.5">
                                        {item.title}
                                    </div>
                                )}
                                <div className="text-xs text-foreground/90">{item.message}</div>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    {!item.readAt && (
                                        <button
                                            onClick={() => {
                                                markNotificationRead(item.id);
                                            }}
                                            className="px-2 py-1 rounded border border-border/50 text-[10px] text-muted-foreground"
                                        >
                                            Mark Read
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            dismissNotification(item.id);
                                        }}
                                        className="px-2 py-1 rounded border border-border/50 text-[10px] text-muted-foreground"
                                    >
                                        Dismiss
                                    </button>
                                    {item.actions.map(action => (
                                        <button
                                            key={`${item.id}-${action.id}`}
                                            onClick={() => {
                                                runNotificationAction(item.id, action.id);
                                            }}
                                            className={cn(
                                                'px-2 py-1 rounded border text-[10px]',
                                                action.tone === 'primary'
                                                    ? 'border-primary/40 text-primary'
                                                    : action.tone === 'destructive'
                                                        ? 'border-destructive/40 text-destructive'
                                                        : 'border-border/50 text-muted-foreground'
                                            )}
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
