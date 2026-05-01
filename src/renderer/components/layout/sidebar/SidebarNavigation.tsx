/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconBriefcase, IconCloudDownload, IconHistory, IconInbox, IconMessage, IconPlayerPause, IconPlayerPlay, IconRefresh, IconRocket, IconShoppingBag, IconX } from '@tabler/icons-react';
import { IconPhoto } from '@tabler/icons-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
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
        const items: Array<{ view: AppView; icon: typeof IconMessage; label: string; badge?: number; testId: string }> = [
            {
                view: 'chat',
                icon: IconMessage,
                label: t('frontend.sidebar.chats'),
                badge: chatsCount > 0 ? chatsCount : undefined,
                testId: 'sidebar-nav-chat'
            },
            {
                view: 'workspace',
                icon: IconRocket,
                label: t('frontend.sidebar.workspaces'),
                testId: 'sidebar-nav-workspace'
            },
            {
                view: 'images',
                icon: IconPhoto,
                label: t('frontend.sidebar.images'),
                testId: 'sidebar-nav-images'
            },
            {
                view: 'marketplace',
                icon: IconShoppingBag,
                label: t('frontend.sidebar.marketplace'),
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
                            icon: view.icon === 'Briefcase' ? IconBriefcase : IconRocket, // Basic icon mapping for now
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
                    pushNotification({ type: 'error', message: t('frontend.sidebar.downloadPauseFailed') });
                }
            })
            .catch(() => {
                pushNotification({ type: 'error', message: t('frontend.sidebar.downloadPauseFailed') });
            });
    };

    const handleResume = (downloadId: string) => {
        if (!hasModelDownloader) { return; }
        void modelDownloader.resume(downloadId)
            .then((res) => {
                const payload = res as { success?: boolean };
                if (!payload.success) {
                    pushNotification({ type: 'error', message: t('frontend.sidebar.downloadResumeFailed') });
                }
            })
            .catch(() => {
                pushNotification({ type: 'error', message: t('frontend.sidebar.downloadResumeFailed') });
            });
    };

    const handleCancel = (downloadId: string) => {
        if (!hasModelDownloader) { return; }
        void modelDownloader.cancel(downloadId)
            .then((res) => {
                const payload = res as { success?: boolean };
                if (!payload.success) {
                    pushNotification({ type: 'error', message: t('frontend.sidebar.downloadCancelFailed') });
                } else {
                    pushNotification({ type: 'info', message: t('frontend.sidebar.downloadCancelled') });
                }
            })
            .catch(() => {
                pushNotification({ type: 'error', message: t('frontend.sidebar.downloadCancelFailed') });
            });
    };

    const handleRetry = (historyId: string) => {
        if (!hasModelDownloader) {
            pushNotification({ type: 'error', message: t('frontend.sidebar.downloadRetryFailed') });
            return;
        }
        void modelDownloader.retry(historyId)
            .then((result) => {
                const payload = result as { success?: boolean };
                pushNotification({
                    type: payload.success ? 'success' : 'error',
                    message: payload.success ? t('frontend.sidebar.downloadRetryQueued') : t('frontend.sidebar.downloadRetryFailed'),
                });
            })
            .catch(() => {
                pushNotification({ type: 'error', message: t('frontend.sidebar.downloadRetryFailed') });
            });
    };

    const getStatusLabel = (status: DownloadStatus): string => {
        const map: Record<DownloadStatus, string> = {
            queued: t('common.pending'),
            starting: t('common.processing'),
            downloading: t('frontend.modelExplorer.downloading'),
            installing: t('common.processing'),
            paused: t('frontend.workspaceAgent.statePanel.status.paused'),
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
        <nav className="flex flex-col gap-1 px-3" aria-label={t('frontend.aria.sidebarNavigation')}>
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
            <Popover>
                <PopoverTrigger asChild>
                    <SidebarItem
                        icon={IconCloudDownload}
                        label={t('frontend.sidebar.downloads')}
                        active={false}
                        isCollapsed={isCollapsed}
                        badge={activeDownloadCount > 0 ? activeDownloadCount : undefined}
                        className="w-full"
                    />
                </PopoverTrigger>
                <PopoverContent
                    side="right"
                    align="start"
                    sideOffset={12}
                    className="w-96 p-0 overflow-hidden border-border/50 bg-popover/95 backdrop-blur-xl shadow-2xl"
                >
                    <div className="flex flex-col h-480">
                        <div className="p-4 border-b border-border/40 bg-muted/20">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <h3 className="text-sm font-semibold ">{t('frontend.sidebar.downloads')}</h3>
                                    <p className="typo-overline text-muted-foreground/60 uppercase font-bold">
                                        {activeDownloadCount} {t('frontend.sidebar.activeDownloads')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Badge variant="outline" className="h-5 px-1.5 typo-overline bg-background/50">
                                        {downloadHistory.length} {t('frontend.agent.history')}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="p-3 space-y-6">
                                {/* Active Downloads Section */}
                                {activeDownloadCount > 0 && (
                                    <section className="space-y-3">
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                            <span className="typo-overline font-bold uppercase text-muted-foreground">
                                                {t('frontend.sidebar.activeDownloads')}
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            {Object.values(activeDownloads).map((task) => {
                                                const progressPercent = getProgressPercent(task.received, task.total);
                                                const isPaused = task.status === 'paused';

                                                return (
                                                    <div key={task.downloadId} className="group relative rounded-xl border border-border/40 bg-muted/10 p-3 transition-all hover:bg-muted/20 hover:border-border/60">
                                                        <div className="flex items-start justify-between gap-3 mb-2.5">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-sm font-bold truncate text-foreground/90 mb-0.5">
                                                                    {task.modelRef}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="secondary" className="h-4 px-1 typo-overline uppercase font-bold bg-primary/10 text-primary border-none">
                                                                        {task.provider}
                                                                    </Badge>
                                                                    <span className="typo-overline font-medium text-muted-foreground/50">
                                                                        {getStatusLabel(task.status)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <div className="text-sm font-bold text-primary">
                                                                    {task.status === 'downloading' ? `${progressPercent}%` : ''}
                                                                </div>
                                                                {task.eta !== undefined && task.status === 'downloading' && (
                                                                    <div className="typo-overline font-medium text-muted-foreground/40">
                                                                        {formatDuration(task.eta)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <AnimatedProgressBar
                                                            value={progressPercent}
                                                            size="sm"
                                                            variant={isPaused ? 'default' : 'gradient'}
                                                            className="mb-2"
                                                        />

                                                        <div className="flex items-center justify-between gap-2">
                                                            {task.received !== undefined && task.total !== undefined && (
                                                                <div className="typo-overline font-bold text-muted-foreground/40 tabular-nums">
                                                                    {formatBytes(task.received)} / {formatBytes(task.total)}
                                                                    {task.speed !== undefined && <span className="ml-2 font-medium opacity-60">· {formatBytes(task.speed)}/s</span>}
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 rounded-md hover:bg-background/80"
                                                                    onClick={() => isPaused ? handleResume(task.downloadId) : handlePause(task.downloadId)}
                                                                >
                                                                    {isPaused ? <IconPlayerPlay className="h-2.5 w-2.5 fill-current" /> : <IconPlayerPause className="h-2.5 w-2.5 fill-current" />}
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 rounded-md hover:bg-destructive/10 hover:text-destructive"
                                                                    onClick={() => handleCancel(task.downloadId)}
                                                                >
                                                                    <IconX className="h-2.5 w-2.5" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                {/* Today History Section */}
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                        <IconHistory className="w-3 h-3 text-muted-foreground/60" />
                                        <span className="typo-overline font-bold uppercase text-muted-foreground">
                                            {t('frontend.sidebar.downloadsToday')}
                                        </span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {todayHistory.length === 0 && activeDownloadCount === 0 && (
                                            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                                                <IconInbox className="w-6 h-6 text-muted-foreground/20 mb-2" />
                                                <p className="text-sm font-medium text-muted-foreground/40 ">
                                                    {t('frontend.sidebar.downloadHistoryEmpty')}
                                                </p>
                                            </div>
                                        )}
                                        {todayHistory.map((item) => (
                                            <div key={item.id} className="group flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted/10 transition-colors border border-transparent hover:border-border/30">
                                                <div className="min-w-0">
                                                    <div className="typo-overline font-semibold truncate text-foreground/80">
                                                        {item.modelRef}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className={cn(
                                                            "w-1 h-1 rounded-full",
                                                            item.status === 'completed' && "bg-success",
                                                            item.status === 'error' && "bg-destructive",
                                                            item.status === 'cancelled' && "bg-muted-foreground/40"
                                                        )} />
                                                        <span className="typo-overline font-bold text-muted-foreground/50 uppercase ">
                                                            {getStatusLabel(item.status)}
                                                        </span>
                                                    </div>
                                                </div>
                                                {item.status === 'error' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => handleRetry(item.id)}
                                                    >
                                                        <IconRefresh className="w-3 h-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* Older History Preview Section */}
                                {allHistoryPreview.length > todayHistory.length && (
                                    <section className="space-y-3 pt-2">
                                        <div className="flex items-center gap-2 px-1">
                                            <IconHistory className="w-3 h-3 text-muted-foreground/30" />
                                            <span className="typo-overline font-bold uppercase text-muted-foreground/40">
                                                {t('frontend.sidebar.downloadsHistory')}
                                            </span>
                                        </div>
                                        <div className="space-y-1 px-1">
                                            {allHistoryPreview.filter(h => !todayHistory.some(t => t.id === h.id)).slice(0, 5).map((item) => (
                                                <div key={`history-${item.id}`} className="flex items-center justify-between gap-4 py-1">
                                                    <span className="truncate typo-overline font-medium text-muted-foreground/60">
                                                        {item.modelRef}
                                                    </span>
                                                    <span className="shrink-0 typo-overline font-bold text-muted-foreground/30 uppercase ">
                                                        {getStatusLabel(item.status)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}
                            </div>
                        </ScrollArea>

                        <div className="p-3 border-t border-border/40 bg-muted/10">
                            <Button
                                variant="outline"
                                className="w-full h-8 text-sm font-bold border-border/40 hover:bg-background"
                                onClick={() => onChangeView('marketplace')} // Redirect to marketplace or something relevant
                            >
                                <IconShoppingBag className="w-3 h-3 mr-2" />
                                {t('frontend.nav.marketplace')}
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </nav>
    );
};

SidebarNavigation.displayName = 'SidebarNavigation';
