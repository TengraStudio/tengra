/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { GitFileHistoryItem } from '@renderer/features/workspace/components/git/types';
import { History, Loader2, X } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

/* Batch-02: Extracted Long Classes */
const C_WORKSPACEEXPLORERGITHISTORY_1 = "flex items-center gap-2 rounded-lg border border-border/40 bg-background/60 px-3 py-2 typo-caption text-muted-foreground";


interface WorkspaceExplorerGitHistoryProps {
    fileName: string;
    commits: GitFileHistoryItem[];
    loading: boolean;
    onClose: () => void;
    t: (key: string) => string;
}

export function WorkspaceExplorerGitHistory({
    fileName,
    commits,
    loading,
    onClose,
    t,
}: WorkspaceExplorerGitHistoryProps): React.ReactElement | null {
    if (!loading && commits.length === 0) {
        return null;
    }

    return (
        <div className="border-b border-border/40 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 typo-overline font-bold tracking-24 text-muted-foreground/50">
                        <History className="h-3 w-3" />
                        <span>{t('agent.history')}</span>
                    </div>
                    <div className="mt-1 truncate typo-caption font-semibold text-foreground">
                        {fileName}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                    title={t('common.close')}
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {loading ? (
                    <div className={C_WORKSPACEEXPLORERGITHISTORY_1}>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>{t('common.loading')}</span>
                    </div>
                ) : (
                    commits.map(commit => (
                        <div
                            key={`${commit.hash}-${commit.date}`}
                            className="rounded-lg border border-border/40 bg-background/60 px-3 py-2"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className="font-mono typo-overline text-primary">{commit.hash}</span>
                                <span className="typo-overline tracking-16 text-muted-foreground/60">
                                    {commit.relativeTime}
                                </span>
                            </div>
                            <div className={cn('mt-1 truncate typo-caption font-medium text-foreground')}>
                                {commit.message}
                            </div>
                            <div className="mt-1 truncate typo-overline text-muted-foreground">
                                {commit.author}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
