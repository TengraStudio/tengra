/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconCircleCheck, IconCircleX,IconCloudDownload, IconHistory, IconTrash } from '@tabler/icons-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_DOWNLOADHISTORYLIST_1 = "flex flex-col items-center justify-center py-20 text-center border border-dashed border-border/30 rounded-2xl bg-muted/5 animate-in fade-in duration-500 sm:flex-row";
const C_DOWNLOADHISTORYLIST_2 = "h-5 rounded-md border-border/20 px-2 py-0 typo-body font-bold typo-body uppercase text-muted-foreground/60";
const C_DOWNLOADHISTORYLIST_3 = "h-8 w-8 rounded-lg text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all p-0";


type DownloadHistoryItemStatus =
    | 'queued'
    | 'starting'
    | 'downloading'
    | 'installing'
    | 'paused'
    | 'cancelled'
    | 'completed'
    | 'error';

export interface DownloadHistoryItem {
    id: string;
    downloadId: string;
    provider: 'ollama' | 'huggingface';
    modelRef: string;
    status: DownloadHistoryItemStatus;
    message?: string;
    outputPath?: string;
    received?: number;
    total?: number;
    speed?: number;
    eta?: number;
    startedAt: number;
    updatedAt: number;
    endedAt?: number;
}

interface DownloadHistoryListProps {
    history: DownloadHistoryItem[];
    onClear?: () => void;
    onDelete?: (id: string) => void;
    t: (key: string) => string;
}

export const DownloadHistoryList: React.FC<DownloadHistoryListProps> = ({
    history,
    onClear,
    onDelete,
    t,
}) => {
    if (history.length === 0) {
        return (
            <div className={C_DOWNLOADHISTORYLIST_1}>
                <IconHistory className="w-12 h-12 text-muted-foreground/20 mb-4" />
                <h3 className="text-sm font-semibold text-foreground/70">{t('frontend.modelsPage.noDownloadHistory')}</h3>
                <p className="typo-caption text-muted-foreground/50 mt-1 max-w-240">
                    {t('frontend.modelsPage.noDownloadHistoryDescription')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        <IconHistory className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground">{t('frontend.modelsPage.downloadHistory')}</h3>
                        <p className="typo-body text-muted-foreground/60 font-medium">
                            {history.length} {t('frontend.modelsPage.historyItems')}
                        </p>
                    </div>
                </div>
                {onClear && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClear}
                        className="h-9 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive px-4 typo-caption font-bold"
                    >
                        <IconTrash className="w-3.5 h-3.5 mr-2" />
                        {t('common.clear')}
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-3 overflow-hidden rounded-2xl border border-border/30 bg-card shadow-sm">
                {history.map((item, idx) => {
                    const isSuccess = item.status === 'completed';
                    const isFailed = item.status === 'error';
                    const date = item.endedAt || item.startedAt;

                    return (
                        <div
                            key={item.id || idx}
                            className={cn(
                                "group relative flex items-center justify-between p-4 transition-colors hover:bg-muted/30",
                                idx < history.length - 1 && "border-b border-border/30"
                            )}
                        >
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={cn(
                                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                                    isSuccess ? "border-success/20 bg-success/5 text-success" :
                                        isFailed ? "border-destructive/20 bg-destructive/5 text-destructive" :
                                            "border-muted-foreground/20 bg-muted/20 text-muted-foreground"
                                )}>
                                    {isSuccess ? <IconCircleCheck className="w-5 h-5" /> :
                                        isFailed ? <IconCircleX className="w-5 h-5" /> :
                                            <IconCloudDownload className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="truncate text-sm font-bold text-foreground">
                                            {item.modelRef}
                                        </span>
                                        <Badge variant="outline" className={C_DOWNLOADHISTORYLIST_2}>
                                            {item.provider}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 typo-caption text-muted-foreground/50 font-medium">
                                        <span className="flex items-center gap-1">
                                            <span className={cn(
                                                "h-1.5 w-1.5 rounded-full",
                                                isSuccess ? "bg-success" : isFailed ? "bg-destructive" : "bg-muted-foreground/30"
                                            )} />
                                            {t(`marketplace.${item.status === 'error' ? 'failed' : item.status}`)}
                                        </span>
                                        <span className="h-1 w-1 rounded-full bg-muted-foreground/10" />
                                        <span>{new Date(date).toLocaleDateString()} {new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        {item.message && (
                                            <>
                                                <span className="h-1 w-1 rounded-full bg-muted-foreground/10" />
                                                <span className="text-destructive truncate max-w-200" title={item.message}>{item.message}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {onDelete && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onDelete(item.id || '')}
                                    className={C_DOWNLOADHISTORYLIST_3}
                                >
                                    <IconTrash className="w-3.5 h-3.5" />
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
