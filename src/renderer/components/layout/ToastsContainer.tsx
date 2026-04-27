/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconAlertCircle, IconAlertTriangle, IconCalendarClock, IconChecks, IconClock, IconHistory, IconInfoCircle, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';

import { useTranslation } from '@/i18n';
import { useBreakpoint } from '@/lib/responsive';
import { cn } from '@/lib/utils';
import {
    clearNotificationHistory,
    dismissNotification,
    // getUnreadNotificationCount,
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
    const { t } = useTranslation();
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
                className={cn('fixed z-100 flex flex-col gap-2 pointer-events-none', breakpoint === 'mobile' ? 'top-4 left-4 right-4' : 'top-6 right-6 w-80')}
            >

                {visibleToasts.map(toast => {
                    const icon =
                        toast.type === 'success'
                            ? <IconChecks className="w-3 h-3" />
                            : toast.type === 'error'
                                ? <IconAlertCircle className="w-3 h-3" />
                                : toast.type === 'warning'
                                    ? <IconAlertTriangle className="w-3 h-3" />
                                    : <IconInfoCircle className="w-3 h-3" />;
                    const normalizedToast = activeNotifications.find(item => item.id === toast.id);
                    return (
                        <div
                            key={toast.id}
                            className={cn('pointer-events-auto flex flex-col gap-2 px-3 py-2.5 rounded-lg border shadow-lg backdrop-blur-md animate-in slide-in-from-right-full duration-300 transition-all font-sans', breakpoint === 'mobile' ? 'w-full' : 'w-full min-w-300', toast.type === 'success' ? 'bg-success/15 border-success/30 text-success-foreground shadow-success/10' : toast.type === 'error' ? 'bg-destructive/15 border-destructive/30 text-destructive-foreground shadow-destructive/10' : toast.type === 'warning' ? 'bg-warning/15 border-warning/30 text-warning-foreground shadow-warning/10' : 'bg-primary/15 border-primary/30 text-primary-foreground shadow-primary/10')}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold opacity-80">
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
                                                'px-2 py-1 rounded border text-sm font-semibold',
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
                                        className="px-2 py-1 rounded border border-border/50 text-sm font-semibold text-foreground/80"
                                        title={t('common.remindInMinutes', { minutes: 5 })}
                                    >
                                        <IconClock className="w-3 h-3 inline mr-1" />
                                        {t('common.snooze')}
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
                        'fixed z-50 rounded-xl border border-border/70 bg-card/95 backdrop-blur shadow-2xl',
                        breakpoint === 'mobile'
                            ? 'left-3 right-3 top-16'
                            : 'top-20 right-6 w-96 max-w-screen-lg'
                    )}
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                        <div className="flex items-center gap-2">
                            <IconHistory className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">{t('notifications.center.title')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => {
                                    markAllNotificationsRead();
                                }}
                                className="p-1.5 rounded hover:bg-accent/50 text-muted-foreground"
                                title={t('common.markRead')}
                            >
                                <IconChecks className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    clearNotificationHistory();
                                }}
                                className="p-1.5 rounded hover:bg-accent/50 text-muted-foreground"
                                title={t('notifications.center.clearHistory')}
                            >
                                <IconTrash className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    setIsCenterOpen(false);
                                }}
                                className="p-1.5 rounded hover:bg-accent/50 text-muted-foreground"
                                title={t('common.close')}
                            >
                                x
                            </button>
                        </div>
                    </div>

                    <div className="px-4 py-3 border-b border-border/60">
                        <div className="text-sm font-semibold text-muted-foreground mb-2">
                            {t('notifications.center.preferences')}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {notificationTypes.map(type => (
                                <label
                                    key={type}
                                    className="flex items-center justify-between rounded border border-border/50 bg-background/40 px-2 py-1.5 typo-caption"
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

                    <div className="px-4 py-2 border-b border-border/60 text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                        <span>{t('notifications.center.analytics.delivered')}: {snapshot.analytics.deliveredTotal}</span>
                        <span>{t('notifications.center.analytics.dismissed')}: {snapshot.analytics.dismissedTotal}</span>
                        <span>{t('notifications.center.analytics.actions')}: {snapshot.analytics.actionClicksTotal}</span>
                        <span>{t('notifications.center.analytics.suppressed')}: {snapshot.analytics.suppressedTotal}</span>
                        <span>{t('notifications.center.analytics.scheduled')}: {snapshot.analytics.scheduledTotal}</span>
                        <span>{t('notifications.center.analytics.pending')}: {snapshot.scheduled.length}</span>
                    </div>

                    {snapshot.scheduled.length > 0 && (
                        <div className="px-4 py-2 border-b border-border/60">
                            <div className="text-sm font-semibold text-muted-foreground mb-1">
                                {t('notifications.center.scheduled')}
                            </div>
                            <div className="space-y-1.5 max-h-24 overflow-auto">
                                {snapshot.scheduled.slice(0, 6).map(item => (
                                    <div
                                        key={item.id}
                                        className="rounded border border-border/50 bg-background/30 px-2 py-1 typo-caption text-muted-foreground"
                                    >
                                        <IconCalendarClock className="w-3.5 h-3.5 inline mr-1" />
                                        {item.payload.message}
                                        <span className="ml-2 opacity-70">
                                            {formatTime(item.deliverAt)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="max-h-80 overflow-auto px-4 py-2 space-y-2">
                        {history.length === 0 && (
                            <div className="py-6 text-center typo-caption text-muted-foreground">
                                {t('notifications.center.noNotifications')}
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
                                    <div className="text-sm text-muted-foreground">
                                        {item.type}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {formatTime(item.createdAt)}
                                    </div>
                                </div>
                                {item.title && (
                                    <div className="typo-caption font-semibold text-foreground mb-0.5">
                                        {item.title}
                                    </div>
                                )}
                                <div className="typo-caption text-foreground/90">{item.message}</div>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    {!item.readAt && (
                                        <button
                                            onClick={() => {
                                                markNotificationRead(item.id);
                                            }}
                                            className="px-2 py-1 rounded border border-border/50 text-sm text-muted-foreground"
                                        >
                                            {t('common.markRead')}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            dismissNotification(item.id);
                                        }}
                                        className="px-2 py-1 rounded border border-border/50 text-sm text-muted-foreground"
                                    >
                                        {t('common.dismiss')}
                                    </button>
                                    {item.actions.map(action => (
                                        <button
                                            key={`${item.id}-${action.id}`}
                                            onClick={() => {
                                                runNotificationAction(item.id, action.id);
                                            }}
                                            className={cn(
                                                'px-2 py-1 rounded border text-sm',
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
