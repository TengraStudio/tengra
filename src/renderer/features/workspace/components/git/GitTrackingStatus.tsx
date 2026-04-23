/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { Badge } from '@renderer/components/ui/badge';
import { ArrowDown, ArrowUp, CheckCircle2, CloudOff } from 'lucide-react';
import React from 'react';

import { TrackingInfo } from './types';

interface TrackingStatusProps {
    trackingInfo: TrackingInfo | null;
}

export const GitTrackingStatus: React.FC<TrackingStatusProps> = ({ trackingInfo }) => {
    if (!trackingInfo?.tracking) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground/30 py-1">
                <CloudOff className="w-3.5 h-3.5" />
                <span className="typo-overline font-bold uppercase tracking-tight">No remote detected</span>
            </div>
        );
    }

    const isUpToDate = trackingInfo.ahead === 0 && trackingInfo.behind === 0;

    return (
        <div className="flex items-center gap-4 w-full">
            <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                <span className="typo-overline font-bold text-muted-foreground/30 uppercase tracking-widest">Origin</span>
                <span className="text-xs font-semibold text-foreground/60 truncate">{trackingInfo.tracking}</span>
            </div>

            <div className="flex items-center gap-1.5">
                {trackingInfo.ahead > 0 && (
                    <Badge variant="outline" className="h-5 px-1.5 border-none bg-emerald-500/10 text-emerald-500 font-bold typo-overline flex items-center gap-1">
                        <ArrowUp className="w-2.5 h-2.5" /> {trackingInfo.ahead}
                    </Badge>
                )}
                {trackingInfo.behind > 0 && (
                    <Badge variant="outline" className="h-5 px-1.5 border-none bg-indigo-500/10 text-indigo-400 font-bold typo-overline flex items-center gap-1">
                        <ArrowDown className="w-2.5 h-2.5" /> {trackingInfo.behind}
                    </Badge>
                )}
                {isUpToDate && (
                    <div className="flex items-center gap-1.5 text-emerald-500/60">
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="typo-overline font-bold uppercase tracking-tighter">Synced</span>
                    </div>
                )}
            </div>
        </div>
    );
};
