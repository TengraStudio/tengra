import { Download, RefreshCw,Upload } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Remote, TrackingInfo } from './types';

interface QuickActionsProps {
    isPulling: boolean;
    isPushing: boolean;
    remotes: Remote[];
    trackingInfo: TrackingInfo | null;
    handlePull: () => Promise<void>;
    handlePush: () => Promise<void>;
    t: (key: string) => string;
}

export const GitQuickActions: React.FC<QuickActionsProps> = ({ isPulling, isPushing, remotes, trackingInfo, handlePull, handlePush, t }) => (
    <div className="flex items-center gap-2 flex-wrap mb-4">
        <button
            onClick={() => { void handlePull(); }}
            disabled={isPulling || remotes.length === 0}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                "bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30",
                "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
        >
            {isPulling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {t('projectDashboard.pull')}
        </button>
        <button
            onClick={() => { void handlePush(); }}
            disabled={isPushing || remotes.length === 0 || (trackingInfo?.ahead ?? 0) === 0}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                "bg-success/20 border border-success/30 text-success hover:bg-success/30",
                "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
        >
            {isPushing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {t('projectDashboard.push')}
        </button>
    </div>
);
