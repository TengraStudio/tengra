import { ArrowDown,ArrowUp } from 'lucide-react';

import { TrackingInfo } from './types';

interface TrackingStatusProps {
    trackingInfo: TrackingInfo | null;
    t: (key: string) => string;
}

export const GitTrackingStatus: React.FC<TrackingStatusProps> = ({ trackingInfo, t }) => {
    if (!trackingInfo?.tracking) {
        return <span className="text-muted-foreground">{t('projectDashboard.noRemote')}</span>;
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
                <span className="text-success">{t('projectDashboard.upToDate')}</span>
            )}
        </div>
    );
};
