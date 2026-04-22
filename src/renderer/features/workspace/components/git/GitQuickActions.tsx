/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import React from 'react';
import { GitMerge, RefreshCw, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
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
                    className="flex-1 h-11 rounded-xl border-border/20 bg-background/40 hover:bg-muted/40 hover:border-indigo-500/30 transition-all font-semibold text-xs gap-2"
                    onClick={() => handlePull()}
                    disabled={isPulling || !hasRemotes}
                >
                    {isPulling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowDown className="w-4 h-4 text-indigo-400" />}
                    Pull
                    {trackingInfo && trackingInfo.behind > 0 && (
                        <span className="ml-1 text-[10px] text-indigo-400">({trackingInfo.behind})</span>
                    )}
                </Button>
                
                <Button 
                    variant="outline" 
                    className="flex-1 h-11 rounded-xl border-border/20 bg-background/40 hover:bg-muted/40 hover:border-indigo-500/30 transition-all font-semibold text-xs gap-2"
                    onClick={() => handlePush()}
                    disabled={isPushing || !hasRemotes}
                >
                    {isPushing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4 text-emerald-400" />}
                    Push
                    {trackingInfo && trackingInfo.ahead > 0 && (
                        <span className="ml-1 text-emerald-400">({trackingInfo.ahead})</span>
                    )}
                </Button>
            </div>

            {!hasRemotes && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/5 rounded-lg border border-amber-500/10">
                    <GitMerge className="w-3 h-3 text-amber-500/60" />
                    <span className="text-[10px] font-bold text-amber-500/60 uppercase tracking-tight">No remotes configured</span>
                </div>
            )}
        </div>
    );
};
