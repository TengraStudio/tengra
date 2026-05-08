/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconArrowDown, IconArrowUp, IconGitMerge, IconRefresh } from '@tabler/icons-react';
import React from 'react';

import { Button } from '@/components/ui/button';

import { Remote, TrackingInfo } from './types';

interface QuickActionsProps {
    isPulling: boolean;
    isPushing: boolean;
    remotes: Remote[];
    trackingInfo: TrackingInfo | null;
    handlePull: () => Promise<void>;
    handlePush: () => Promise<void>;
}

export const GitQuickActions: React.FC<QuickActionsProps> = ({
    isPulling,
    isPushing,
    remotes,
    trackingInfo,
    handlePull,
    handlePush,
}) => {
    const hasRemotes = remotes.length > 0;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl border-border/20 bg-background/40 hover:bg-muted/40 hover:border-indigo-500/30 transition-all font-semibold text-sm gap-2"
                    onClick={() => { void handlePull(); }}
                    disabled={isPulling || !hasRemotes}
                >
                    {isPulling ? <IconRefresh className="w-4 h-4 animate-spin" /> : <IconArrowDown className="w-4 h-4 text-indigo-400" />}
                    Pull
                    {trackingInfo && trackingInfo.behind > 0 && (
                        <span className="ml-1 typo-overline text-indigo-400">({trackingInfo.behind})</span>
                    )}
                </Button>

                <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl border-border/20 bg-background/40 hover:bg-muted/40 hover:border-indigo-500/30 transition-all font-semibold text-sm gap-2"
                    onClick={() => { void handlePush(); }}
                    disabled={isPushing || !hasRemotes}
                >
                    {isPushing ? <IconRefresh className="w-4 h-4 animate-spin" /> : <IconArrowUp className="w-4 h-4 text-emerald-400" />}
                    Push
                    {trackingInfo && trackingInfo.ahead > 0 && (
                        <span className="ml-1 text-emerald-400">({trackingInfo.ahead})</span>
                    )}
                </Button>
            </div>

            {!hasRemotes && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/5 rounded-lg border border-amber-500/10">
                    <IconGitMerge className="w-3 h-3 text-amber-500/60" />
                    <span className="typo-overline font-bold text-amber-500/60 uppercase ">No remotes configured</span>
                </div>
            )}
        </div>
    );
};

