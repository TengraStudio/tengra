/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { WorkspaceAgentSessionSummary } from '@shared/types/workspace-agent-session';
import { IconArchive, IconArchiveOff, IconDots, IconHistory, IconPlus, IconTrash } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface WorkspaceAgentPanelHeaderProps {
    recentSessions?: WorkspaceAgentSessionSummary[];
    currentSession: WorkspaceAgentSessionSummary | null;
    onSelectSession?: (sessionId: string | null) => void;
    onArchiveSession: (sessionId: string, archived: boolean) => void;
    onDeleteSession: (sessionId: string) => void;
    onOpenSessionPicker: () => void;
    onCreateSession: () => void;
    t: (key: string) => string;
}

function formatTokens(value: number | undefined): string {
    if (!value) {
        return '0';
    }
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}k`;
    }
    return `${Math.round(value)}`;
}

function getContextUsagePercent(session: WorkspaceAgentSessionSummary | null): number {
    const usedTokens = session?.usageStats?.usedTokens ?? 0;
    const contextWindow = session?.usageStats?.contextWindow ?? 0;
    if (contextWindow <= 0) {
        return 0;
    }
    return Math.min(100, (usedTokens / contextWindow) * 100);
}

export const WorkspaceAgentPanelHeader: React.FC<WorkspaceAgentPanelHeaderProps> = ({
    currentSession,
    onArchiveSession,
    onDeleteSession,
    onCreateSession,
    onOpenSessionPicker,
}) => {
    const usageStats = currentSession?.usageStats;
    const usagePercent = getContextUsagePercent(currentSession);

    return (
        <div className="border-b border-border bg-background px-3 py-2">
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                        {currentSession?.title || 'New session'}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCreateSession} title="New session">
                        <IconPlus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenSessionPicker} title="History">
                        <IconHistory className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="More">
                                <IconDots className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 border-border/60">
                            <DropdownMenuItem onClick={onCreateSession}>
                                <IconPlus className="mr-2 h-4 w-4" />
                                New session
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onOpenSessionPicker}>
                                <IconHistory className="mr-2 h-4 w-4" />
                                Open history
                            </DropdownMenuItem>
                            {currentSession ? (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => void onArchiveSession(currentSession.id, !currentSession.archived)}
                                    >
                                        {currentSession.archived ? (
                                            <IconArchiveOff className="mr-2 h-4 w-4" />
                                        ) : (
                                            <IconArchive className="mr-2 h-4 w-4" />
                                        )}
                                        {currentSession.archived ? 'Restore session' : 'Archive session'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => void onDeleteSession(currentSession.id)}
                                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                    >
                                        <IconTrash className="mr-2 h-4 w-4" />
                                        Delete session
                                    </DropdownMenuItem>
                                </>
                            ) : null}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {currentSession ? (
                <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>Context</span>
                        <span>
                            {formatTokens(usageStats?.usedTokens)} / {formatTokens(usageStats?.contextWindow)}
                        </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full bg-foreground/70 transition-all"
                            style={{ width: `${usagePercent}%` }}
                        />
                    </div>
                </div>
            ) : null}
        </div>
    );
};

