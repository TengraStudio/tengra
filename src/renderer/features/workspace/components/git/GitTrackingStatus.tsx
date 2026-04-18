/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { ArrowDown,ArrowUp } from 'lucide-react';

import { TrackingInfo } from './types';

interface TrackingStatusProps {
    trackingInfo: TrackingInfo | null;
    t: (key: string) => string;
}

export const GitTrackingStatus: React.FC<TrackingStatusProps> = ({ trackingInfo, t }) => {
    if (!trackingInfo?.tracking) {
        return <span className="text-muted-foreground">{t('workspaceDashboard.noRemote')}</span>;
    }
    return (
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            {trackingInfo.ahead > 0 && (
                <span className="text-warning flex items-center gap-1">
                    <ArrowUp className="w-3 h-3" /> {trackingInfo.ahead}
                </span>
            )}
            {trackingInfo.behind > 0 && (
                <span className="text-primary flex items-center gap-1">
                    <ArrowDown className="w-3 h-3" /> {trackingInfo.behind}
                </span>
            )}
            {trackingInfo.ahead === 0 && trackingInfo.behind === 0 && (
                <span className="text-success">{t('workspaceDashboard.upToDate')}</span>
            )}
        </div>
    );
};
