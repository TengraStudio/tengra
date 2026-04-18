/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Briefcase, DownloadCloud, MessageSquare, Pause, Play, RefreshCcw, Rocket, ShoppingBag, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { UI_PRIMITIVES } from '@/constants/ui-primitives';
import { AppView } from '@/hooks/useAppState';
import { cn } from '@/lib/utils';
import { type DownloadHistoryItem, type DownloadStatus, downloadStore, type DownloadTaskState, useDownloadStore } from '@/store/download.store';
import { useExtensionStore } from '@/store/extension.store';
import { pushNotification } from '@/store/notification-center.store';
import { formatBytes, formatDuration } from '@/utils/format.util';
import { preloadViewResources } from '@/views/view-manager/view-loaders';

import { SidebarItem } from './SidebarItem';

interface SidebarNavigationProps {
    currentView: AppView
    onChangeView: (view: AppView) => void
    isCollapsed: boolean
    chatsCount: number
    t: (key: string) => string
}

const dateToDayKey = (timestamp: number): string => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const SIDEBAR_DAY_KEY = dateToDayKey(Date.now());

interface DownloadProgressPayload {
    downloadId: string;
    provider: 'ollama' | 'huggingface';
    modelRef: string;
    status: DownloadStatus;
    message?: string;
    received?: number;
    total?: number;
    speed?: number;
    eta?: number;
}

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
    currentView,
    onChangeView,
    isCollapsed,
    chatsCount,
    t
}) => {
    const modelDownloader = window.electron?.modelDownloader;
    const hasModelDownloader =
        typeof modelDownloader === 'object'
        && modelDownloader !== null
        && typeof modelDownloader.history === 'function'
        && typeof modelDownloader.retry === 'function';
    const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryItem[]>([]);
    const activeDownloads = useDownloadStore(s => s.activeDownloads);
    const refreshTimerRef = useRef<number | null>(null);
    const extensions = useExtensionStore(s => s.extensions);

    const navItems = useMemo(() => {
        const items: Array<{ view: AppView; icon: typeof MessageSquare; label: string; badge?: number; testId: string }> = [
            {
                view: 'chat',
                icon: MessageSquare,
                label: t('sidebar.chats'),
                badge: chatsCount > 0 ? chatsCount : undefined,
                testId: 'sidebar-nav-chat'
            },
            {
                view: 'workspace',
                icon: Rocket,
                label: t('sidebar.workspaces'),
                testId: 'sidebar-nav-workspace'
            },
            {
                view: 'marketplace',
                icon: ShoppingBag,
                label: t('sidebar.marketplace'),
                testId: 'sidebar-nav-marketplace'
            }
        ];

        // Inject active extension sidebar views
        extensions.forEach(ext => {
            if (ext.status === 'active' && ext.manifest.contributes?.views) {
                ext.manifest.contributes.views.forEach(view => {
                    if (view.type === 'sidebar') {
                        items.push({
                            view: view.id,
                            icon: view.icon === 'Briefcase' ? Briefcase : Rocket, // Basic icon mapping for now
                            label: view.title,
                            testId: `sidebar-nav-ext-${view.id}`
                        });
                    }
                });
            }
        });

        return items;
    }, [chatsCount, t, extensions]);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const preloadedViewsRef = useRef<Set<AppView>>(new Set());
    const activeDownloadCount = Object.values(activeDownloads).length;

    const isDownloadProgressPayload = (payload: unknown): payload is DownloadProgressPayload => {
        if (typeof payload !== 'object' || payload === null) {
            return false;
        }
        const candidate = payload as Partial<DownloadProgressPayload>;

        return Boolean(
            candidate.downloadId
            && candidate.provider
            && candidate.modelRef
            && candidate.status
        );
    };

    const getProgressPercent = (received: number | undefined, total: number | undefined): number => {
        if (!total || total <= 0) { return 0; }
        const percent = Math.floor(((received || 0) / total) * 100);
        return Math.min(100, Math.max(0, percent));
    };

    const refreshHistory = useCallback(() => {
        if (!hasModelDownloader) {
            return;
        }
        void modelDownloader.history(200)
            .then((response) => {
                const payload = response as {
                    success?: boolean;
                    items?: DownloadHistoryItem[];
                };
                if (payload.success && Array.isArray(payload.items)) {
                    setDownloadHistory(payload.items);

                    // Sync active downloads from history
                    const inProgressTasks: DownloadTaskState[] = [];
                    const activeStatuses: DownloadStatus[] = ['queued', 'starting', 'downloading', 'installing', 'paused'];

                    payload.items.forEach(item => {
                        if (activeStatuses.includes(item.status)) {
                            inProgressTasks.push({
                                downloadId: item.downloadId,
                                modelRef: item.modelRef,
                                provider: item.provider,
                                status: item.status,
                                message: item.message,
                                received: item.received,
                                total: item.total,
                                speed: item.speed,
                                eta: item.eta,
                            });
                        }
                    });

                    downloadStore.syncActiveDownloads(inProgressTasks);
                }
            })
            .catch(() => {
                // ignore sidebar history refresh failures
            });
    }, [hasModelDownloader, modelDownloader]);

    useEffect(() => {
        if (!hasModelDownloader) {
            return;
        }
        refreshHistory();

        const unsubscribe = window.electron.on('model-downloader:progress', (_event, raw) => {
            if (isDownloadProgressPayload(raw)) {
                downloadStore.updateActiveDownload(raw);

                // If it's a completion event, we also want to refresh history
                if (!['queued', 'starting', 'downloading', 'installing', 'paused'].includes(raw.status)) {
                    if (refreshTimerRef.current !== null) {
                        window.clearTimeout(refreshTimerRef.current);
                    }
                    refreshTimerRef.current = window.setTimeout(() => {
                        refreshHistory();
                    }, 500);
                }
            }
        });

        return () => {
            unsubscribe();
            if (refreshTimerRef.current !== null) {
                window.clearTimeout(refreshTimerRef.current);
            }
        };
    }, [hasModelDownloader, refreshHistory]);

    const todayHistory = useMemo(() => {
        return downloadHistory.filter(item => dateToDayKey(item.startedAt) === SIDEBAR_DAY_KEY).slice(0, 6);
    }, [downloadHistory]);

    const allHistoryPreview = useMemo(() => downloadHistory.slice(0, 10), [downloadHistory]);

    const handlePause = (downloadId: string) => {
        if (!hasModelDownloader) { return; }
        void modelDownloader.pause(downloadId)
            .then((res) => {
                const payload = res as { success?: boolean };
                if (!payload.success) {
                    pushNotification({ type: 'error', message: t('sidebar.downloadPauseFailed') });
                }
            })
            .catch(() => {
                pushNotification({ type: 'error', message: t('sidebar.downloadPauseFailed') });
            });
    };

    const handleResume = (downloadId: string) => {
        if (!hasModelDownloader) { return; }
        void modelDownloader.resume(downloadId)
            .then((res) => {
                const payload = res as { success?: boolean };
                if (!payload.success) {
                    pushNotification({ type: 'error', message: t('sidebar.downloadResumeFailed') });
                }
            })
            .catch(() => {
                pushNotification({ type: 'error', message: t('sidebar.downloadResumeFailed') });
            });
    };

    const handleCancel = (downloadId: string) => {
        if (!hasModelDownloader) { return; }
        void modelDownloader.cancel(downloadId)
            .then((res) => {
                const payload = res as { success?: boolean };
                if (!payload.success) {
                    pushNotification({ type: 'error', message: t('sidebar.downloadCancelFailed') });
                } else {
                    pushNotification({ type: 'info', message: t('sidebar.downloadCancelled') });
                }
            })
            .catch(() => {
                pushNotification({ type: 'error', message: t('sidebar.downloadCancelFailed') });
            });
    };

    const handleRetry = (historyId: string) => {
        if (!hasModelDownloader) {
            pushNotification({ type: 'error', message: t('sidebar.downloadRetryFailed') });
            return;
        }
        void modelDownloader.retry(historyId)
            .then((result) => {
                const payload = result as { success?: boolean };
                pushNotification({
                    type: payload.success ? 'success' : 'error',
                    message: payload.success ? t('sidebar.downloadRetryQueued') : t('sidebar.downloadRetryFailed'),
                });
            })
            .catch(() => {
                pushNotification({ type: 'error', message: t('sidebar.downloadRetryFailed') });
            });
    };

    const getStatusLabel = (status: DownloadStatus): string => {
        const map: Record<DownloadStatus, string> = {
            queued: t('common.pending'),
            starting: t('common.processing'),
            downloading: t('modelExplorer.downloading'),
            installing: t('common.processing'),
            paused: t('workspaceAgent.statePanel.status.paused'),
            cancelled: t('common.cancelled'),
            completed: t('common.completed'),
            error: t('common.error'),
        };
        return map[status] || status;
    };

    const preloadView = (view: AppView) => {
        if (preloadedViewsRef.current.has(view)) {
            return;
        }
        preloadedViewsRef.current.add(view);
        void preloadViewResources(view);
    };

    const handleRovingNav = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setFocusedIndex((index + 1) % navItems.length);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setFocusedIndex((index - 1 + navItems.length) % navItems.length);
            return;
        }
        if (event.key === 'Home') {
            event.preventDefault();
            setFocusedIndex(0);
            return;
        }
        if (event.key === 'End') {
            event.preventDefault();
            setFocusedIndex(navItems.length - 1);
        }
    };

    return (
        <nav className="flex flex-col gap-1 px-3" aria-label={t('aria.sidebarNavigation')}>
            {navItems.map((item, index) => (
                <SidebarItem
                    key={item.view}
                    icon={item.icon}
                    label={item.label}
                    active={currentView === item.view}
                    onClick={() => onChangeView(item.view)}
                    onMouseEnter={() => preloadView(item.view)}
                    badge={item.badge}
                    data-testid={item.testId}
                    isCollapsed={isCollapsed}
                    tabIndex={focusedIndex === index ? 0 : -1}
                    onFocus={() => {
                        setFocusedIndex(index);
                        preloadView(item.view);
                    }}
                    onKeyDown={(event) => handleRovingNav(event, index)}
                />
            ))}
            <div className="group/downloads relative">
                <SidebarItem
                    icon={DownloadCloud}
                    label={t('sidebar.downloads')}
                    active={false}
                    onClick={() => undefined}
                    isCollapsed={isCollapsed}
                    badge={activeDownloadCount > 0 ? activeDownloadCount : undefined}
                />
                <div className="absolute left-full top-0 h-full w-2" aria-hidden="true" />
                <div className="pointer-events-none invisible absolute left-full-plus-2 top-0 z-30 max-h-96 w-88 translate-y-1 overflow-y-auto rounded-xl border border-border/50 bg-card p-3 opacity-0 shadow-2xl transition-all duration-150 group-hover/downloads:pointer-events-auto group-hover/downloads:visible group-hover/downloads:translate-y-0 group-hover/downloads:opacity-100">
                    {activeDownloadCount > 0 && (
                        <div className="mb-3 space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{t('sidebar.activeDownloads')}</div>
                            <div className="space-y-3">
                                {Object.values(activeDownloads).map((task) => {
                                    const progressPercent = getProgressPercent(task.received, task.total);

                                    return (
                                        <div key={task.downloadId} className="rounded-lg border border-border/30 bg-muted/10 p-2.5">
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="typo-body font-semibold text-foreground truncate">{task.modelRef}</span>
                                                    <span className="typo-body text-muted-foreground/60 uppercase tracking-tight">{task.provider}</span>
                                                </div>
                                                <div className="flex flex-col items-end shrink-0">
                                                    <span className="typo-body font-medium text-primary">
                                                        {task.status === 'downloading' ? `${progressPercent}%` : getStatusLabel(task.status)}
                                                    </span>
                                                    {task.eta !== undefined && task.status === 'downloading' && (
                                                        <span className="typo-body text-muted-foreground/50">{formatDuration(task.eta)} {t('common.remaining')}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="h-1 w-full bg-muted/30 rounded-full overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full bg-primary transition-all duration-300",
                                                        task.status === 'paused' && "bg-muted-foreground/40"
                                                    )}
                                                    style={{ width: `${progressPercent}%` }}
                                                />
                                            </div>
                                            {task.received !== undefined && task.total !== undefined && (
                                                <div className="flex items-center justify-between mt-1 typo-body text-muted-foreground/40 font-medium">
                                                    <span>{formatBytes(task.received)} / {formatBytes(task.total)}</span>
                                                    {task.speed !== undefined && <span>{formatBytes(task.speed)}/s</span>}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 mt-2 group/task-actions overflow-hidden">
                                                {task.status === 'paused' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleResume(task.downloadId)}
                                                        className={cn(UI_PRIMITIVES.ITEM_OVERLAY, "p-1 px-2 rounded bg-primary/20 text-primary hover:bg-primary/30")}
                                                        title={t('common.resume')}
                                                    >
                                                        <Play className="w-2.5 h-2.5 fill-current" />
                                                        <span className="typo-body">{t('common.resume')}</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePause(task.downloadId)}
                                                        className={cn(UI_PRIMITIVES.ITEM_OVERLAY, "p-1 px-2 rounded bg-muted/30 text-muted-foreground hover:bg-muted/50")}
                                                        title={t('common.pause')}
                                                    >
                                                        <Pause className="w-2.5 h-2.5 fill-current" />
                                                        <span className="typo-body">{t('common.pause')}</span>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleCancel(task.downloadId)}
                                                    className={cn(UI_PRIMITIVES.ITEM_OVERLAY, "p-1 px-2 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 ml-auto")}
                                                    title={t('common.cancel')}
                                                >
                                                    <X className="w-2.5 h-2.5" />
                                                    <span className="typo-body">{t('common.cancel')}</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="mb-3 space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{t('sidebar.downloadsToday')}</div>
                        {todayHistory.length === 0 && activeDownloadCount === 0 && (
                            <div className="text-xs text-muted-foreground/60">{t('sidebar.downloadHistoryEmpty')}</div>
                        )}
                        {todayHistory.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-border/20 bg-muted/5 px-2 py-1.5">
                                <div className="min-w-0">
                                    <span className="block truncate text-xs font-medium">{item.modelRef}</span>
                                    <span className="block text-xxs text-muted-foreground/70">{getStatusLabel(item.status)}</span>
                                </div>
                                {item.status === 'error' && (
                                    <button
                                        type="button"
                                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                                        onClick={() => handleRetry(item.id)}
                                    >
                                        <RefreshCcw className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{t('sidebar.downloadsHistory')}</div>
                        {allHistoryPreview.slice(0, 4).map((item) => (
                            <div key={`history-${item.id}`} className="flex items-center justify-between gap-2 text-xs text-muted-foreground/80">
                                <span className="truncate">{item.modelRef}</span>
                                <span className="shrink-0">{getStatusLabel(item.status)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </nav>
    );
};

SidebarNavigation.displayName = 'SidebarNavigation';
