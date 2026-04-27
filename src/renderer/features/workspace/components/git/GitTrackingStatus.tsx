/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { IconArrowDown, IconArrowUp, IconCircleCheck, IconCloudOff } from '@tabler/icons-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';

import { TrackingInfo } from './types';

interface TrackingStatusProps {
    trackingInfo: TrackingInfo | null;
}

export const GitTrackingStatus: React.FC<TrackingStatusProps> = ({ trackingInfo }) => {
    if (!trackingInfo?.tracking) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground/30 py-1">
                <IconCloudOff className="w-3.5 h-3.5" />
                <span className="typo-overline font-bold uppercase ">No remote detected</span>
            </div>
        );
    }

    const isUpToDate = trackingInfo.ahead === 0 && trackingInfo.behind === 0;

    return (
        <div className="flex items-center gap-4 w-full">
            <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                <span className="typo-overline font-bold text-muted-foreground/30 uppercase ">Origin</span>
                <span className="text-sm font-semibold text-foreground/60 truncate">{trackingInfo.tracking}</span>
            </div>

            <div className="flex items-center gap-1.5">
                {trackingInfo.ahead > 0 && (
                    <Badge variant="outline" className="h-5 px-1.5 border-none bg-emerald-500/10 text-emerald-500 font-bold typo-overline flex items-center gap-1">
                        <IconArrowUp className="w-2.5 h-2.5" /> {trackingInfo.ahead}
                    </Badge>
                )}
                {trackingInfo.behind > 0 && (
                    <Badge variant="outline" className="h-5 px-1.5 border-none bg-indigo-500/10 text-indigo-400 font-bold typo-overline flex items-center gap-1">
                        <IconArrowDown className="w-2.5 h-2.5" /> {trackingInfo.behind}
                    </Badge>
                )}
                {isUpToDate && (
                    <div className="flex items-center gap-1.5 text-emerald-500/60">
                        <IconCircleCheck className="w-3 h-3" />
                        <span className="typo-overline font-bold uppercase ">Synced</span>
                    </div>
                )}
            </div>
        </div>
    );
};
